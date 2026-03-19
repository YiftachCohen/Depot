/**
 * Save Agent Memory Handler
 *
 * Saves facts to the current agent's persistent memory.
 * Uses an injected saveAgentMemory callback to avoid depending on @depot/shared.
 */

import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { successResponse, errorResponse } from '../response.ts';

export interface SaveAgentMemoryArgs {
  facts: string[];
}

/**
 * Handle the save_agent_memory tool call.
 *
 * Validates and forwards facts to the context-provided saveAgentMemory
 * callback for persistence in agent-state.json.
 */
export async function handleSaveAgentMemory(
  ctx: SessionToolContext,
  args: SaveAgentMemoryArgs
): Promise<ToolResult> {
  if (!ctx.saveAgentMemory) {
    return errorResponse('Agent memory is not available. This tool only works in sessions linked to a skill/agent.');
  }

  try {
    const facts = args.facts.filter(f => typeof f === 'string' && f.trim() !== '');

    if (facts.length === 0) {
      return successResponse('No facts were saved (all entries were empty).');
    }

    ctx.saveAgentMemory(facts);
    return successResponse(`Saved ${facts.length} fact(s) to agent memory. These will be available in future sessions with this agent.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to save agent memory: ${message}`);
  }
}
