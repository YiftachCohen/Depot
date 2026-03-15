/**
 * SessionListPropsContext
 *
 * Provides session-list-specific data from AppShellContent to MainContentPanel.
 * This carries the filtered items, search/filter/grouping state, and handlers
 * that are computed locally in AppShellContent but needed by SessionList.
 *
 * Most callbacks (onDelete, onFlag, etc.) already live in AppShellContext —
 * this context only provides what's missing there.
 */

import { createContext, useContext } from 'react'
import type { SessionMeta } from '@/atoms/sessions'
import type { SessionStatus } from '@/config/session-status-config'
import type { ChatGroupingMode } from '@/components/app-shell/SessionList'
import type { FilterMode } from '@/hooks/useSessionSearch'
import type { SessionOptions } from '@/hooks/useSessionOptions'
import type { ViewConfig } from '@depot/shared/views'
import type { LabelConfig } from '@depot/shared/labels'
import type { LoadedSkill } from '../../shared/types'

export interface SessionListPropsContextType {
  /** Title for the current view (e.g., "All Chats", "Flagged", "Archived") */
  listTitle: string
  /** Filtered session metas for the current view (or all workspace metas when searching) */
  items: SessionMeta[]
  /** Whether search is active */
  searchActive: boolean
  /** Current search query */
  searchQuery: string
  /** Update search query */
  onSearchChange: (query: string) => void
  /** Close search */
  onSearchClose: () => void
  /** Activate search */
  onSearchOpen: () => void
  /** How to group sessions */
  groupingMode: ChatGroupingMode
  /** Workspace ID for content search */
  workspaceId?: string
  /** Secondary status filter */
  statusFilter: Map<string, FilterMode>
  /** Secondary label filter */
  labelFilterMap: Map<string, FilterMode>
  /** Override which session is highlighted (multi-panel) */
  focusedSessionId: string | null | undefined
  /** Override navigation target (multi-panel) */
  onNavigateToSession?: (sessionId: string) => void
  /** Check if session has pending permission prompt */
  hasPendingPrompt: (sessionId: string) => boolean
  /** Available skills */
  skills: LoadedSkill[]
  /** Active skill filter slug */
  skillFilter: string | null
  /** Update skill filter */
  onSkillFilterChange: (slug: string | null) => void
  /** Focus chat input for a session */
  onFocusChatInput: (sessionId?: string) => void
  /** Open session in new window */
  onOpenInNewWindow: (session: SessionMeta) => void
  /** Session options map */
  sessionOptions: Map<string, SessionOptions>
  /** View evaluator */
  evaluateViews: (meta: SessionMeta) => ViewConfig[]
  /** Session statuses config */
  sessionStatuses: SessionStatus[]
  /** Label configs */
  labels: LabelConfig[]
  /** Labels change handler */
  onLabelsChange: (sessionId: string, labels: string[]) => void
  /** Panel count (for focusedSessionId behavior) */
  panelCount: number
}

const SessionListPropsContext = createContext<SessionListPropsContextType | null>(null)

export function SessionListPropsProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: SessionListPropsContextType
}) {
  return (
    <SessionListPropsContext.Provider value={value}>
      {children}
    </SessionListPropsContext.Provider>
  )
}

/** Returns session list props or null if outside provider */
export function useSessionListProps(): SessionListPropsContextType | null {
  return useContext(SessionListPropsContext)
}
