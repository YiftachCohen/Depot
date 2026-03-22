/**
 * Save Knowledge Handler
 * Saves structured knowledge (entities, relationships, patterns, observations)
 * to the agent's knowledge store.
 */

import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { successResponse, errorResponse } from '../response.ts';

export interface SaveKnowledgeArgs {
  entities?: Array<{
    type: string;
    name: string;
    domain: string;
    properties?: Record<string, unknown>;
    tags?: string[];
  }>;
  relationships?: Array<{
    source: string;
    target: string;
    source_domain?: string;
    target_domain?: string;
    relation: string;
    properties?: Record<string, unknown>;
  }>;
  patterns?: Array<{
    description: string;
    related_entities?: string[];
    pattern_type?: 'recurring' | 'correlation' | 'trend' | 'anomaly';
  }>;
  observations?: string[];
}

// Limits to prevent runaway storage from misbehaving LLM tool calls
const MAX_ENTITIES_PER_CALL = 100;
const MAX_RELATIONSHIPS_PER_CALL = 200;
const MAX_PATTERNS_PER_CALL = 50;
const MAX_OBSERVATIONS_PER_CALL = 50;
const MAX_NAME_LENGTH = 500;
const MAX_TAGS_PER_ENTITY = 50;
const MAX_OBSERVATION_BYTES = 10_240; // 10 KB

/**
 * Handle the save_knowledge tool call.
 *
 * Validates and forwards structured knowledge to the context-provided
 * saveKnowledge callback for persistence in the knowledge store.
 */
export async function handleSaveKnowledge(
  ctx: SessionToolContext,
  args: SaveKnowledgeArgs
): Promise<ToolResult> {
  if (!ctx.saveKnowledge) {
    return errorResponse('Knowledge store is not available. This tool only works with knowledge-enabled agents.');
  }

  try {
    // Enforce size limits
    if (args.entities && args.entities.length > MAX_ENTITIES_PER_CALL) {
      return errorResponse(`Too many entities: ${args.entities.length} exceeds limit of ${MAX_ENTITIES_PER_CALL} per call.`);
    }
    if (args.relationships && args.relationships.length > MAX_RELATIONSHIPS_PER_CALL) {
      return errorResponse(`Too many relationships: ${args.relationships.length} exceeds limit of ${MAX_RELATIONSHIPS_PER_CALL} per call.`);
    }
    if (args.patterns && args.patterns.length > MAX_PATTERNS_PER_CALL) {
      return errorResponse(`Too many patterns: ${args.patterns.length} exceeds limit of ${MAX_PATTERNS_PER_CALL} per call.`);
    }

    // Validate entity field lengths
    for (const entity of args.entities ?? []) {
      if (entity.name.length > MAX_NAME_LENGTH) {
        return errorResponse(`Entity name too long (${entity.name.length} chars, max ${MAX_NAME_LENGTH}): "${entity.name.slice(0, 80)}..."`);
      }
      if (entity.tags && entity.tags.length > MAX_TAGS_PER_ENTITY) {
        return errorResponse(`Too many tags for entity "${entity.name}": ${entity.tags.length} exceeds limit of ${MAX_TAGS_PER_ENTITY}.`);
      }
    }

    // Filter out empty observations and enforce size limits
    const filteredObs = args.observations
      ?.filter(o => typeof o === 'string' && o.trim() !== '')
      .slice(0, MAX_OBSERVATIONS_PER_CALL)
      .map(o => o.length > MAX_OBSERVATION_BYTES ? o.slice(0, MAX_OBSERVATION_BYTES) : o);

    // Map snake_case from Zod schema to camelCase for context callback
    const result = ctx.saveKnowledge({
      entities: args.entities,
      relationships: args.relationships?.map(r => ({
        source: r.source,
        target: r.target,
        sourceDomain: r.source_domain,
        targetDomain: r.target_domain,
        relation: r.relation,
        properties: r.properties,
      })),
      patterns: args.patterns?.map(p => ({
        description: p.description,
        relatedEntities: p.related_entities,
        patternType: p.pattern_type,
      })),
      observations: filteredObs,
    });

    const parts: string[] = [];
    if (result.entities > 0) parts.push(`${result.entities} entit${result.entities === 1 ? 'y' : 'ies'}`);
    if (result.relationships > 0) parts.push(`${result.relationships} relationship${result.relationships === 1 ? '' : 's'}`);
    if (result.patterns > 0) parts.push(`${result.patterns} pattern${result.patterns === 1 ? '' : 's'}`);
    if (result.observations > 0) parts.push(`${result.observations} observation${result.observations === 1 ? '' : 's'}`);

    if (parts.length === 0) {
      return successResponse('No knowledge was saved (all inputs were empty).');
    }

    return successResponse(`Saved ${parts.join(', ')} to knowledge store. These will be available in future sessions.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to save knowledge: ${message}`);
  }
}
