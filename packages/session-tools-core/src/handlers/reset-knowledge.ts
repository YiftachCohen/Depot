/**
 * Reset Knowledge Handler
 * Resets the agent's knowledge store, optionally scoped to a specific domain.
 */

import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { successResponse, errorResponse } from '../response.ts';

export interface ResetKnowledgeArgs {
  confirm: boolean;
  domain?: string;
}

/**
 * Handle the reset_knowledge tool call.
 *
 * Validates the confirmation flag and forwards the reset request
 * to the context-provided resetKnowledge callback.
 */
export async function handleResetKnowledge(
  ctx: SessionToolContext,
  args: ResetKnowledgeArgs
): Promise<ToolResult> {
  if (!ctx.resetKnowledge) {
    return errorResponse('Knowledge store is not available. This tool only works with knowledge-enabled agents.');
  }

  if (!args.confirm) {
    return errorResponse('You must pass confirm: true to reset knowledge.');
  }

  try {
    ctx.resetKnowledge(args.domain);

    if (args.domain) {
      return successResponse(`Knowledge for domain '${args.domain}' has been reset.`);
    }

    return successResponse('Knowledge store has been reset.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to reset knowledge: ${message}`);
  }
}
