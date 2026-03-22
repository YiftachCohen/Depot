/**
 * Query Knowledge Handler
 * Queries the agent's knowledge store for entities, relationships,
 * patterns, and observations.
 */

import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { successResponse, errorResponse } from '../response.ts';

export interface QueryKnowledgeArgs {
  domain?: string;
  entity_type?: string;
  tags?: string[];
  query?: string;
  include_relationships?: boolean;
  limit?: number;
}

/**
 * Handle the query_knowledge tool call.
 *
 * Forwards the query to the context-provided queryKnowledge callback
 * and returns the formatted results.
 */
export async function handleQueryKnowledge(
  ctx: SessionToolContext,
  args: QueryKnowledgeArgs
): Promise<ToolResult> {
  if (!ctx.queryKnowledge) {
    return errorResponse('Knowledge store is not available. This tool only works with knowledge-enabled agents.');
  }

  try {
    const result = ctx.queryKnowledge({
      domain: args.domain,
      entityType: args.entity_type,
      tags: args.tags,
      query: args.query,
      includeRelationships: args.include_relationships,
      limit: args.limit,
    });
    return successResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to query knowledge: ${message}`);
  }
}
