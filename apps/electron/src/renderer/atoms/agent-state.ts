/**
 * Agent State Atom
 *
 * Stores agent state (memory, source status) per skill slug.
 * Populated by SkillDashboard on mount, updated via onAgentStateChanged listener.
 */

import { atom } from 'jotai'
import type { AgentState } from '@depot/shared/skills'

/** Map of skillSlug → AgentState for agents in the current workspace. */
export const agentStateMapAtom = atom<Map<string, AgentState>>(new Map())
