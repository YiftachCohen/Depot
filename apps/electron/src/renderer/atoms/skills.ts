/**
 * Skills Atom
 *
 * Simple atom for storing workspace skills.
 * Used by NavigationContext for auto-selection when navigating to skills view.
 */

import { atom } from 'jotai'
import { isAgent } from '../../shared/types'
import type { LoadedSkill } from '../../shared/types'

/**
 * Atom to store the current workspace's skills.
 * AppShell populates this when skills are loaded.
 * NavigationContext reads from it for auto-selection.
 */
export const skillsAtom = atom<LoadedSkill[]>([])

/** Skills that have a depot.yaml manifest with quick_commands */
export const agentsAtom = atom<LoadedSkill[]>((get) =>
  get(skillsAtom).filter((s) => isAgent(s)),
)

/** Skills that are plain SKILL.md without quick_commands */
export const plainSkillsAtom = atom<LoadedSkill[]>((get) =>
  get(skillsAtom).filter((s) => !isAgent(s)),
)
