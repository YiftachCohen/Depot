/**
 * Knowledge Observation Guards
 *
 * Extracted guard logic for knowledge observation sessions.
 * Checks concurrency, token budget, and entity limits before
 * allowing an observation session to proceed.
 */

import { createLogger } from '@depot/shared/utils/debug'
import {
  loadAgentState,
  saveAgentState,
  type AgentState,
} from '@depot/shared/skills'
import {
  DEFAULT_DAILY_TOKEN_BUDGET,
  ENTITY_HARD_LIMIT_BLOCK,
} from '@depot/shared/skills/knowledge'

const log = createLogger('knowledge-guards')

// ============================================================
// Types
// ============================================================

export interface ObservationGuardResult {
  allowed: boolean
  reason?: string
}

// ============================================================
// Guard Checks
// ============================================================

/**
 * Check all guards before creating an observation session.
 * Returns { allowed: true } if observation may proceed, or
 * { allowed: false, reason } if blocked.
 */
export async function checkObservationGuards(
  workspaceRootPath: string,
  skillSlug: string,
  skillPath?: string,
  tokenBudgetPerDay?: number,
): Promise<ObservationGuardResult> {
  // 0. Pause check — user can temporarily pause observations
  let state: AgentState | null = null
  try {
    state = loadAgentState(workspaceRootPath, skillSlug, skillPath)
  } catch (e) {
    log.warn(`[Knowledge] Failed to load agent state for ${skillSlug}, treating as empty:`, e)
  }

  if (state?.observationPaused) {
    return { allowed: false, reason: 'observations paused by user' }
  }

  // 1. Concurrency — is another observation already running?
  if (state?.observationInProgress && state.observationStartedAt) {
    const elapsed = Date.now() - state.observationStartedAt
    if (elapsed < 3_600_000) {
      return { allowed: false, reason: 'observation already in progress' }
    }
    // Stale flag (>1 hour) — auto-clear and continue
    log.warn(`[Knowledge] Clearing stale observation flag for ${skillSlug} (${Math.round(elapsed / 60_000)}m old)`)
    try {
      state.observationInProgress = false
      state.observationStartedAt = undefined
      saveAgentState(workspaceRootPath, skillSlug, state, skillPath)
    } catch {
      // Non-critical
    }
  }

  // 2. Token budget — daily cap
  if (state?.knowledgeTokenUsage) {
    const today = new Intl.DateTimeFormat('en-CA').format(new Date())
    const usage = state.knowledgeTokenUsage
    if (usage.date === today) {
      const budget = tokenBudgetPerDay ?? DEFAULT_DAILY_TOKEN_BUDGET
      if (usage.tokensUsed >= budget) {
        return {
          allowed: false,
          reason: `daily token budget exhausted (${usage.tokensUsed}/${budget})`,
        }
      }
      log.debug(`[Knowledge] Token budget for ${skillSlug}: ${usage.tokensUsed}/${budget} used`)
    }
  }

  // 3. Entity limit — hard cap
  try {
    const { KnowledgeStoreManager } = await import('@depot/shared/skills/knowledge')
    const manager = KnowledgeStoreManager.getInstance()
    const store = await manager.open(workspaceRootPath, skillSlug, skillPath)
    const stats = store.getStats()
    if (stats.entityCount >= ENTITY_HARD_LIMIT_BLOCK) {
      return {
        allowed: false,
        reason: `entity limit reached (${stats.entityCount}/${ENTITY_HARD_LIMIT_BLOCK})`,
      }
    }
  } catch (e) {
    // Fail open — if we can't check entities, allow observation
    log.warn(`[Knowledge] Failed to check entity count for ${skillSlug}, failing open:`, e)
  }

  // 4. All guards passed
  return { allowed: true }
}

// ============================================================
// State Mutations
// ============================================================

/**
 * Set or clear the observationInProgress flag in agent state.
 */
export function setObservationFlag(
  workspaceRootPath: string,
  skillSlug: string,
  inProgress: boolean,
  skillPath?: string,
): void {
  try {
    const state = loadAgentState(workspaceRootPath, skillSlug, skillPath)
    if (!state) return

    state.observationInProgress = inProgress
    state.observationStartedAt = inProgress ? Date.now() : undefined
    saveAgentState(workspaceRootPath, skillSlug, state, skillPath)
  } catch (e) {
    log.warn(`[Knowledge] Failed to ${inProgress ? 'set' : 'clear'} observation flag for ${skillSlug}:`, e)
  }
}


/**
 * Increment or reset consecutive failure counter.
 * Returns { shouldNotify: true } when counter reaches 3.
 */
export function trackObservationFailure(
  workspaceRootPath: string,
  skillSlug: string,
  failed: boolean,
  skillPath?: string,
): { shouldNotify: boolean } {
  try {
    const state = loadAgentState(workspaceRootPath, skillSlug, skillPath)
    if (!state) return { shouldNotify: false }

    const prev = state.consecutiveObservationFailures ?? 0

    if (failed) {
      const next = prev + 1
      state.consecutiveObservationFailures = next
      saveAgentState(workspaceRootPath, skillSlug, state, skillPath)
      return { shouldNotify: next === 3 }
    } else {
      if (prev > 0) {
        state.consecutiveObservationFailures = 0
        saveAgentState(workspaceRootPath, skillSlug, state, skillPath)
      }
      return { shouldNotify: false }
    }
  } catch (e) {
    log.warn(`[Knowledge] Failed to track observation failure for ${skillSlug}:`, e)
    return { shouldNotify: false }
  }
}
