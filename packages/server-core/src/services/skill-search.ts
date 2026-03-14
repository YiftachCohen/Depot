/**
 * Skill-scoped Session Search Service
 *
 * Searches session content across all sessions belonging to a specific skill.
 * Reads JSONL headers to filter by skillSlug, then scans message lines for query matches.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillSearchMatch {
  messageIndex: number;
  role: 'user' | 'assistant';
  snippet: string;
  timestamp?: number;
}

export interface SkillSearchResult {
  sessionId: string;
  sessionName: string;
  skillSlug: string;
  matches: SkillSearchMatch[];
}

export interface SkillSearchOptions {
  /** Maximum total results across all sessions. Default: 50 */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the first line (header) of a session JSONL file.
 * Returns null if the file cannot be read or parsed.
 */
function readHeaderLine(jsonlPath: string): Record<string, unknown> | null {
  try {
    const content = readFileSync(jsonlPath, 'utf-8');
    const newlineIdx = content.indexOf('\n');
    const firstLine = newlineIdx === -1 ? content : content.slice(0, newlineIdx);
    if (!firstLine.trim()) return null;
    return JSON.parse(firstLine);
  } catch {
    return null;
  }
}

/**
 * Extract a context snippet around the match position.
 */
function extractSnippet(text: string, matchIndex: number, maxLength = 150): string {
  const halfLength = Math.floor(maxLength / 2);
  const start = Math.max(0, matchIndex - halfLength);
  const end = Math.min(text.length, start + maxLength);

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

/**
 * Try to extract a readable content string from a raw JSONL message line
 * without a full JSON.parse (fast path). Falls back to JSON.parse for
 * complex structures.
 */
function extractContentFromLine(rawLine: string): string | null {
  // Fast regex extraction for simple string content
  const contentMatch = rawLine.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (contentMatch) {
    return contentMatch[1]!
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  // Fallback: try to extract text block content (array content format)
  const textBlockMatch = rawLine.match(/"type"\s*:\s*"text"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (textBlockMatch) {
    return textBlockMatch[1]!
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  return null;
}

/**
 * Extract message role from a raw JSONL line without full parse.
 */
function extractRole(rawLine: string): 'user' | 'assistant' | null {
  const roleMatch = rawLine.match(/"type"\s*:\s*"(user|assistant)"/);
  return roleMatch ? (roleMatch[1] as 'user' | 'assistant') : null;
}

/**
 * Extract timestamp from a raw JSONL line without full parse.
 */
function extractTimestamp(rawLine: string): number | undefined {
  const tsMatch = rawLine.match(/"timestamp"\s*:\s*(\d+)/);
  return tsMatch ? Number(tsMatch[1]) : undefined;
}

// ---------------------------------------------------------------------------
// Main search function
// ---------------------------------------------------------------------------

/**
 * Search across all sessions belonging to a specific skill.
 *
 * Implementation:
 * 1. List all session directories
 * 2. Read each session's JSONL header (first line) to check skillSlug
 * 3. For matching sessions, scan message lines for the query (case-insensitive)
 * 4. Return matches with surrounding context snippets
 *
 * @param sessionsDir - Path to the workspace sessions directory
 * @param skillSlug - The skill slug to filter sessions by
 * @param query - The search query string (case-insensitive)
 * @param options - Optional search options
 */
export async function searchSessionsBySkill(
  sessionsDir: string,
  skillSlug: string,
  query: string,
  options?: SkillSearchOptions
): Promise<SkillSearchResult[]> {
  const limit = options?.limit ?? 50;

  if (!query.trim() || !skillSlug.trim()) {
    return [];
  }

  if (!existsSync(sessionsDir)) {
    return [];
  }

  const results: SkillSearchResult[] = [];
  let totalMatches = 0;
  const lowerQuery = query.toLowerCase();

  // List all session directories
  let entries: import('fs').Dirent[];
  try {
    entries = readdirSync(sessionsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (totalMatches >= limit) break;

    const sessionId = entry.name;
    const jsonlPath = join(sessionsDir, sessionId, 'session.jsonl');

    if (!existsSync(jsonlPath)) continue;

    // Read header (first line) to check skillSlug — skip non-matching sessions early
    const header = readHeaderLine(jsonlPath);
    if (!header || header.skillSlug !== skillSlug) continue;

    const sessionName = (header.name as string) ?? '';

    // Read entire file and scan message lines (lines 2+)
    let fileContent: string;
    try {
      fileContent = readFileSync(jsonlPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = fileContent.split('\n');
    const matches: SkillSearchMatch[] = [];

    // Lines 2+ are messages (index 0 is header)
    for (let i = 1; i < lines.length; i++) {
      if (totalMatches >= limit) break;

      const line = lines[i]!;
      if (!line.trim()) continue;

      // Skip intermediate messages
      if (line.includes('"isIntermediate":true')) continue;

      // Only match user/assistant messages
      const role = extractRole(line);
      if (!role) continue;

      // Extract content and check for query match (case-insensitive)
      const content = extractContentFromLine(line);
      if (!content) continue;

      const lowerContent = content.toLowerCase();
      const matchIndex = lowerContent.indexOf(lowerQuery);
      if (matchIndex === -1) continue;

      const snippet = extractSnippet(content, matchIndex);
      const timestamp = extractTimestamp(line);

      matches.push({
        messageIndex: i - 1, // 0-based message index (excluding header)
        role,
        snippet,
        timestamp,
      });

      totalMatches++;
    }

    if (matches.length > 0) {
      results.push({
        sessionId,
        sessionName,
        skillSlug,
        matches,
      });
    }
  }

  return results;
}
