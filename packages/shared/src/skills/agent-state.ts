/**
 * Agent State Storage
 *
 * Manages persistent agent state including cross-session memory.
 * State is stored as a JSON sidecar file alongside the skill directory.
 *
 * Storage: {workspace}/skills/{slug}/agent-state.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';

// ============================================================
// Types
// ============================================================

/** A single fact learned by an agent */
export interface AgentMemoryFact {
  /** Unique identifier */
  id: string;
  /** The fact text */
  content: string;
  /** When this fact was recorded (epoch ms) */
  createdAt: number;
  /** Which session learned this fact */
  sourceSessionId: string;
  /** Confidence score 0-1, used during consolidation to drop low-value facts */
  confidence?: number;
}

/** Agent memory state */
export interface AgentMemory {
  /** Discrete learned facts */
  facts: AgentMemoryFact[];
  /** When memory was last updated (epoch ms) */
  updatedAt: number;
  /** When LLM consolidation last ran (epoch ms) */
  consolidatedAt?: number;
}

/** Persistent agent state stored on disk */
export interface AgentState {
  /** Stable agent ID (survives renames) */
  agentId: string;
  /** When this agent was first created (epoch ms) */
  createdAt: number;
  /** When this agent was last active (epoch ms) */
  lastActiveAt: number;
  /** Status of source setup per slug */
  sourceSetupStatus: Record<string, 'configured' | 'auth_pending' | 'failed'>;
  /** Cross-session memory */
  memory: AgentMemory;
}

// ============================================================
// Paths
// ============================================================

const AGENT_STATE_FILE = 'agent-state.json';

/**
 * Get the path to an agent's state file.
 */
export function getAgentStatePath(workspaceRootPath: string, skillSlug: string): string {
  return join(workspaceRootPath, 'skills', skillSlug, AGENT_STATE_FILE);
}

// ============================================================
// Load / Save
// ============================================================

/**
 * Load agent state from disk.
 * Returns null if the file doesn't exist or is invalid.
 */
export function loadAgentState(workspaceRootPath: string, skillSlug: string): AgentState | null {
  const filePath = getAgentStatePath(workspaceRootPath, skillSlug);

  if (!existsSync(filePath)) return null;

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as AgentState;
    // Basic shape validation
    if (!data.agentId || !data.memory) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Save agent state to disk.
 */
export function saveAgentState(workspaceRootPath: string, skillSlug: string, state: AgentState): void {
  const filePath = getAgentStatePath(workspaceRootPath, skillSlug);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Initialize a fresh agent state.
 */
export function initAgentState(workspaceRootPath: string, skillSlug: string): AgentState {
  const now = Date.now();
  const state: AgentState = {
    agentId: randomUUID(),
    createdAt: now,
    lastActiveAt: now,
    sourceSetupStatus: {},
    memory: {
      facts: [],
      updatedAt: now,
    },
  };
  saveAgentState(workspaceRootPath, skillSlug, state);
  return state;
}

// ============================================================
// Memory Operations
// ============================================================

/**
 * Add memory facts to an agent's state.
 * Creates the agent state if it doesn't exist yet.
 */
export function addMemoryFacts(
  workspaceRootPath: string,
  skillSlug: string,
  sessionId: string,
  facts: string[],
): void {
  if (facts.length === 0) return;

  let state = loadAgentState(workspaceRootPath, skillSlug);
  if (!state) {
    state = initAgentState(workspaceRootPath, skillSlug);
  }

  const now = Date.now();
  for (const content of facts) {
    state.memory.facts.push({
      id: randomUUID().slice(0, 8),
      content: content.trim(),
      createdAt: now,
      sourceSessionId: sessionId,
    });
  }

  state.memory.updatedAt = now;
  state.lastActiveAt = now;
  saveAgentState(workspaceRootPath, skillSlug, state);
}

/**
 * Delete a single memory fact by ID.
 * Returns true if the fact was found and removed.
 */
export function deleteMemoryFact(
  workspaceRootPath: string,
  skillSlug: string,
  factId: string,
): boolean {
  let state = loadAgentState(workspaceRootPath, skillSlug);
  if (!state) return false;

  const before = state.memory.facts.length;
  state.memory.facts = state.memory.facts.filter(f => f.id !== factId);
  if (state.memory.facts.length === before) return false;

  state.memory.updatedAt = Date.now();
  saveAgentState(workspaceRootPath, skillSlug, state);
  return true;
}

/**
 * Replace all memory facts (used after LLM consolidation).
 */
export function replaceMemoryFacts(
  workspaceRootPath: string,
  skillSlug: string,
  consolidatedFacts: AgentMemoryFact[],
): void {
  let state = loadAgentState(workspaceRootPath, skillSlug);
  if (!state) return;

  const now = Date.now();
  state.memory.facts = consolidatedFacts;
  state.memory.updatedAt = now;
  state.memory.consolidatedAt = now;
  state.lastActiveAt = now;
  saveAgentState(workspaceRootPath, skillSlug, state);
}

/**
 * Update the lastActiveAt timestamp for an agent.
 */
export function touchAgentState(workspaceRootPath: string, skillSlug: string): void {
  let state = loadAgentState(workspaceRootPath, skillSlug);
  if (!state) return;
  state.lastActiveAt = Date.now();
  saveAgentState(workspaceRootPath, skillSlug, state);
}

// ============================================================
// Prompt Formatting
// ============================================================

/** Maximum number of facts before consolidation is recommended */
export const MEMORY_CONSOLIDATION_THRESHOLD = 50;

/**
 * Format agent memory for injection into the system prompt.
 * Returns empty string if no memories exist.
 */
export function formatAgentMemoryForPrompt(state: AgentState | null, skillSlug?: string): string {
  if (!state || state.memory.facts.length === 0) return '';

  const slug = skillSlug ?? 'agent';
  const lines = [`<agent_memory skill="${slug}">`];
  for (const fact of state.memory.facts) {
    lines.push(`- ${fact.content}`);
  }
  lines.push('</agent_memory>');
  return lines.join('\n');
}
