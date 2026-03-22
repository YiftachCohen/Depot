/**
 * Knowledge Fabric — Smart Context Loading & Morning Briefing
 *
 * Builds contextual XML blocks from the knowledge store to inject into
 * agent system prompts, enabling domain-aware conversations.
 */

import type { KnowledgeStore } from './store.ts';
import type { KnowledgeEntity, KnowledgeRelationship, KnowledgePattern } from './types.ts';
import { extractKeywords } from './extraction.ts';

// ============================================================
// XML Escaping
// ============================================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================
// Relative Time Formatting
// ============================================================

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

// ============================================================
// buildKnowledgeContext
// ============================================================

/**
 * Build a context block from the knowledge store, seeded by the user's
 * prompt keywords and the skill's configured domains.
 *
 * Returns an XML string suitable for injection into the system prompt,
 * or empty string if the store has no entities.
 */
export function buildKnowledgeContext(
  store: KnowledgeStore,
  userPrompt: string,
  skillSlug: string,
  domains: string[],
): string {
  // Bail early if the store is empty
  if (store.getEntityCount() === 0) {
    return '';
  }

  // 1. Extract keywords from the user prompt
  const keywords = extractKeywords(userPrompt);

  // 2. Query by tags (keywords)
  const tagMatches: KnowledgeEntity[] =
    keywords.length > 0 ? store.queryEntities({ tags: keywords }) : [];

  // 3. Query by domain
  const domainMatches: KnowledgeEntity[] = [];
  for (const domain of domains) {
    const results = store.queryEntities({ domain });
    domainMatches.push(...results);
  }

  // 4. Merge and deduplicate by entity ID
  const seenIds = new Set<string>();
  const merged: KnowledgeEntity[] = [];

  for (const entity of [...tagMatches, ...domainMatches]) {
    if (!seenIds.has(entity.id)) {
      seenIds.add(entity.id);
      merged.push(entity);
    }
  }

  // 5. Fallback: load top entities if no matches
  const entities = merged.length > 0 ? merged : store.getTopEntities(20);

  // 6. Load relationships for each entity
  // Build ID → name lookup for readable rendering
  const entityNameById = new Map<string, string>();
  for (const entity of entities) {
    entityNameById.set(entity.id, entity.name);
  }

  const relationshipsByEntity = new Map<string, KnowledgeRelationship[]>();
  for (const entity of entities) {
    const rels = store.queryRelationshipsForEntity(entity.id);
    if (rels.length > 0) {
      relationshipsByEntity.set(entity.id, rels);
    }
  }

  // 7. Load patterns
  const patterns = store.queryPatterns(10);

  // 8. Format as XML
  const domainStr = escapeXml(domains.join(', '));
  const lines: string[] = [];

  lines.push(
    `<agent_knowledge skill="${escapeXml(skillSlug)}" domain="${domainStr}" entries="${entities.length}">`,
  );

  // Entities section
  lines.push('## Entities');
  for (const entity of entities) {
    const relTime = formatRelativeTime(entity.lastSeen);
    lines.push(
      `- ${escapeXml(entity.type)}: ${escapeXml(entity.name)} (confidence: ${entity.confidence}, last seen: ${relTime})`,
    );
    const rels = relationshipsByEntity.get(entity.id);
    if (rels) {
      for (const rel of rels) {
        const targetName = entityNameById.get(rel.targetEntityId) ?? rel.targetEntityId;
        lines.push(
          `  - ${escapeXml(rel.relationType)} -> ${escapeXml(targetName)} (confidence: ${rel.confidence})`,
        );
      }
    }
  }

  // Patterns section
  if (patterns.length > 0) {
    lines.push('');
    lines.push('## Patterns');
    for (const pattern of patterns) {
      lines.push(
        `- ${escapeXml(pattern.description)} (confidence: ${pattern.confidence}, seen ${pattern.occurrenceCount} times)`,
      );
    }
  }

  lines.push('</agent_knowledge>');

  return lines.join('\n');
}

// ============================================================
// buildBriefingContext
// ============================================================

/**
 * Build a briefing block summarizing knowledge changes since the user's
 * last session. Returns empty string if there is nothing new or if
 * lastUserSessionTimestamp is null.
 */
export function buildBriefingContext(
  store: KnowledgeStore,
  lastUserSessionTimestamp: number | null,
): string {
  if (lastUserSessionTimestamp === null) {
    return '';
  }

  const newEntities = store.getEntitiesSince(lastUserSessionTimestamp);
  const newPatterns = store.getPatternsSince(lastUserSessionTimestamp);
  const scheduledObs = store.getScheduledObservationsSince(lastUserSessionTimestamp);

  // Nothing new — skip the briefing
  if (newEntities.length === 0 && newPatterns.length === 0 && scheduledObs.length === 0) {
    return '';
  }

  const sinceDate = new Date(lastUserSessionTimestamp).toISOString();
  const lines: string[] = [];

  lines.push(`<agent_briefing since="${escapeXml(sinceDate)}">`);
  lines.push('## New since your last session');

  // Entities summary
  if (newEntities.length > 0) {
    const nameList = newEntities
      .slice(0, 10)
      .map((e) => escapeXml(e.name))
      .join(', ');
    const suffix = newEntities.length > 10 ? ', ...' : '';
    lines.push(`- ${newEntities.length} new entities discovered (${nameList}${suffix})`);
  }

  // Patterns summary
  if (newPatterns.length > 0) {
    const patternSummaries = newPatterns
      .slice(0, 5)
      .map((p) => escapeXml(p.description))
      .join('; ');
    const suffix = newPatterns.length > 5 ? '; ...' : '';
    lines.push(`- ${newPatterns.length} new patterns: ${patternSummaries}${suffix}`);
  }

  // Scheduled observations summary
  if (scheduledObs.length > 0) {
    lines.push(`- ${scheduledObs.length} scheduled observations ran`);
  }

  lines.push('</agent_briefing>');

  return lines.join('\n');
}
