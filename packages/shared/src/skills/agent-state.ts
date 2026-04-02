/**
 * Agent State Storage
 *
 * Manages persistent agent state including cross-session memory.
 * State is stored as a JSON sidecar file alongside the skill directory.
 *
 * Storage: {workspace}/skills/{slug}/agent-state.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { join, dirname, resolve, sep } from 'path';
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

/** Token usage tracking for knowledge observation budget */
export interface KnowledgeTokenUsage {
  /** Calendar date string (YYYY-MM-DD in local timezone) */
  date: string;
  /** Total tokens used on this date */
  tokensUsed: number;
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
  /** @deprecated Cross-session memory — migrated to Knowledge Fabric */
  memory?: AgentMemory;
  /** Whether memory facts have been migrated to the knowledge store */
  memoryMigrated?: boolean;

  // --- Knowledge Fabric fields (v3) ---

  /** When the last user-initiated session ended (epoch ms). Used for morning briefing. */
  lastUserSessionTimestamp?: number;
  /** Daily token budget tracking for observation loops */
  knowledgeTokenUsage?: KnowledgeTokenUsage;
  /** Whether an observation loop is currently in progress */
  observationInProgress?: boolean;
  /** Timestamp when observation_in_progress was set (for stale flag detection) */
  observationStartedAt?: number;
  /** Whether the first-knowledge celebration toast has been shown */
  firstKnowledgeSeen?: boolean;
  /** Consecutive observation session failures (for notification threshold) */
  consecutiveObservationFailures?: number;
  /** Whether observations are paused by the user (skips scheduled observations) */
  observationPaused?: boolean;
  /** Recent observation session history (capped at 20 entries, newest first) */
  observationHistory?: ObservationRun[];
}

/** A single observation session run record */
export interface ObservationRun {
  timestamp: number;
  durationMs: number;
  entitiesAdded: number;
  /** Number of patterns added during this observation (optional for backward compat) */
  patternsAdded?: number;
  tokensUsed: number;
  outcome: 'success' | 'failure' | 'partial';
}

// ============================================================
// Paths
// ============================================================

const AGENT_STATE_FILE = 'agent-state.json';

/** Validate that a skill slug is safe for filesystem path construction. */
function assertValidSkillSlug(skillSlug: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(skillSlug)) {
    throw new Error(`Invalid skill slug: ${skillSlug}`);
  }
  return skillSlug;
}

/**
 * Get the path to an agent's state file.
 * When `skillDir` is provided (the resolved skill's absolute path), state is
 * stored alongside that skill. Otherwise falls back to the workspace skills dir.
 */
export function getAgentStatePath(workspaceRootPath: string, skillSlug: string, skillDir?: string): string {
  if (skillDir) return join(skillDir, AGENT_STATE_FILE);
  const safeSlug = assertValidSkillSlug(skillSlug);
  const skillsRoot = resolve(workspaceRootPath, 'skills');
  const target = resolve(skillsRoot, safeSlug, AGENT_STATE_FILE);
  if (!target.startsWith(`${skillsRoot}${sep}`)) {
    throw new Error(`Resolved path escaped skills root for slug: ${skillSlug}`);
  }
  return target;
}

// ============================================================
// Load / Save
// ============================================================

/**
 * Load agent state from disk.
 * Returns null if the file doesn't exist or is invalid.
 */
export function loadAgentState(workspaceRootPath: string, skillSlug: string, skillDir?: string): AgentState | null {
  const filePath = getAgentStatePath(workspaceRootPath, skillSlug, skillDir);

  if (!existsSync(filePath)) return null;

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as Partial<AgentState>;
    // Shape validation — only agentId is required (memory is now optional)
    if (!data || typeof data.agentId !== 'string') {
      return null;
    }
    return data as AgentState;
  } catch {
    return null;
  }
}

/**
 * Save agent state to disk.
 */
export function saveAgentState(workspaceRootPath: string, skillSlug: string, state: AgentState, skillDir?: string): void {
  const filePath = getAgentStatePath(workspaceRootPath, skillSlug, skillDir);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
  renameSync(tempPath, filePath);
}

/**
 * Initialize a fresh agent state.
 */
export function initAgentState(workspaceRootPath: string, skillSlug: string, skillDir?: string): AgentState {
  const now = Date.now();
  const state: AgentState = {
    agentId: randomUUID(),
    createdAt: now,
    lastActiveAt: now,
    sourceSetupStatus: {},
  };
  saveAgentState(workspaceRootPath, skillSlug, state, skillDir);
  return state;
}

// ============================================================
// Memory Operations (removed — migrated to Knowledge Fabric)
// ============================================================

/**
 * Update the lastActiveAt timestamp for an agent.
 */
export function touchAgentState(workspaceRootPath: string, skillSlug: string, skillDir?: string): void {
  let state = loadAgentState(workspaceRootPath, skillSlug, skillDir);
  if (!state) return;
  state.lastActiveAt = Date.now();
  saveAgentState(workspaceRootPath, skillSlug, state, skillDir);
}

// ============================================================
// Knowledge Token Budget
// ============================================================

/**
 * Update daily knowledge token usage.
 * Resets the counter when the calendar date changes (local timezone).
 */
export function updateKnowledgeTokenUsage(
  workspaceRootPath: string,
  skillSlug: string,
  tokensUsed: number,
  skillDir?: string,
): void {
  try {
    let state = loadAgentState(workspaceRootPath, skillSlug, skillDir);
    if (!state) return;

    const today = new Intl.DateTimeFormat('en-CA').format(new Date());
    const usage = state.knowledgeTokenUsage;

    if (usage && usage.date === today) {
      usage.tokensUsed += tokensUsed;
    } else {
      state.knowledgeTokenUsage = { date: today, tokensUsed };
    }

    saveAgentState(workspaceRootPath, skillSlug, state, skillDir);
  } catch {
    // Non-critical — worst case is budget not tracked
  }
}

// ============================================================
// Prompt Formatting (removed — migrated to Knowledge Fabric)
// ============================================================
