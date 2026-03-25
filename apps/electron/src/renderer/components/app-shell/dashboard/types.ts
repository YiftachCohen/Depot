/**
 * Agent Detail Page Types
 *
 * Shared types for the two-column "Living Dossier" agent detail view.
 */
import type { LoadedSkill } from '../../../../shared/types'
import type { AgentState, ObservationRun } from '@depot/shared/skills'
import type { AutomationListItem } from '../../automations/types'

// ============================================================================
// Page Mode — determines layout, hero card variant, and content order
// ============================================================================

export type AgentPageMode =
  | 'knowledge-enabled'
  | 'automation-only'
  | 'chat-first'
  | 'new-agent'

/**
 * Determine the page mode from the agent's capabilities and usage history.
 *
 * Priority: knowledge > automations > sessions > new
 */
export function determinePageMode(
  skill: LoadedSkill,
  agentState: AgentState | undefined,
  automations: AutomationListItem[],
  sessionCount: number,
): AgentPageMode {
  const hasKnowledge = skill.manifest?.knowledge?.enabled === true
  if (hasKnowledge) return 'knowledge-enabled'

  const hasAutomations = automations.length > 0
  if (hasAutomations) return 'automation-only'

  if (sessionCount > 0) return 'chat-first'

  return 'new-agent'
}

// ============================================================================
// Unified Timeline Event
// ============================================================================

export interface AgentEvent {
  type: 'observation' | 'session' | 'memory' | 'automation'
  timestamp: number
  summary: string
  detail?: string
  /** Unique key for React list rendering */
  id: string
  /** Session ID for navigation (session + automation types) */
  sessionId?: string
  /** Base name for automation grouping (internal) */
  _groupBase?: string
  /** Count of grouped consecutive events (internal) */
  _groupCount?: number
}

// ============================================================================
// Knowledge Stats (renderer-safe mirror)
// ============================================================================

export interface KnowledgeStatsData {
  entityCount: number
  relationshipCount: number
  patternCount: number
  lastObservation: number | null
  observationHealth: 'green' | 'yellow' | 'red' | 'gray'
}

// ============================================================================
// Skill Session Stats
// ============================================================================

export interface SkillSessionStats {
  sessionCount: number
  lastUsedAt?: number
}
