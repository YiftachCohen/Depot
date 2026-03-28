/**
 * AgentActivityTimeline — Unified event feed merging observations,
 * sessions, memory facts, and automation history.
 */
import * as React from 'react'
import { useMemo } from 'react'
import { Sparkles, MessageSquare, Brain, Zap, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navigate, routes } from '@/lib/navigate'
import type { ObservationRun, AgentMemoryFact } from '@depot/shared/skills'
import type { AgentEvent } from './types'
import { formatRelativeTime } from './utils'
import type { ExecutionEntry } from '../../automations/types'

// ---------------------------------------------------------------------------
// Type-tinted left border colors
// ---------------------------------------------------------------------------
const TYPE_BORDER: Record<AgentEvent['type'], string> = {
  observation: 'border-l-amber-400 dark:border-l-amber-600',
  session: 'border-l-blue-400 dark:border-l-blue-600',
  memory: 'border-l-purple-400 dark:border-l-purple-600',
  automation: 'border-l-green-400 dark:border-l-green-600',
}

const TYPE_ICON: Record<AgentEvent['type'], typeof Sparkles> = {
  observation: Sparkles,
  session: MessageSquare,
  memory: Brain,
  automation: Zap,
}

const TYPE_ICON_COLOR: Record<AgentEvent['type'], string> = {
  observation: 'text-amber-500/70',
  session: 'text-blue-500/70',
  memory: 'text-purple-500/70',
  automation: 'text-green-500/70',
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function TimelineSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse flex items-center gap-2.5 pl-3 border-l-2 border-foreground/[0.06] py-2">
          <div className="h-3 w-3 rounded bg-foreground/[0.06]" />
          <div className="h-3 w-32 rounded bg-foreground/[0.06]" />
          <div className="flex-1" />
          <div className="h-2.5 w-12 rounded bg-foreground/[0.06]" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AgentActivityTimelineProps {
  skillSlug: string
  observationHistory: ObservationRun[]
  recentSessions: Array<{ id: string; name?: string; lastMessageAt?: number; skillSlug?: string }>
  memoryFacts: AgentMemoryFact[]
  automationHistory: ExecutionEntry[]
  loading: boolean
  error: string | null
  onRetry?: () => void
  onNewChat: () => void
}

export function AgentActivityTimeline({
  skillSlug,
  observationHistory,
  recentSessions,
  memoryFacts,
  automationHistory,
  loading,
  error,
  onRetry,
  onNewChat,
}: AgentActivityTimelineProps) {
  // Merge all sources into AgentEvent[], each wrapped in try/catch
  const events = useMemo<AgentEvent[]>(() => {
    const merged: AgentEvent[] = []

    // Observations
    try {
      for (const obs of observationHistory) {
        const parts: string[] = ['Observed']
        if (obs.entitiesAdded > 0) parts.push(`found ${obs.entitiesAdded} new entit${obs.entitiesAdded !== 1 ? 'ies' : 'y'}`)
        if ((obs.patternsAdded ?? 0) > 0) parts.push(`${obs.patternsAdded} pattern${(obs.patternsAdded ?? 0) !== 1 ? 's' : ''}`)
        if (obs.outcome === 'failure') parts.push('(failed)')
        merged.push({
          type: 'observation',
          timestamp: obs.timestamp,
          summary: parts.join(' \u2014 '),
          detail: obs.tokensUsed > 0 ? `${obs.tokensUsed.toLocaleString()} tokens` : undefined,
          id: `obs-${obs.timestamp}`,
        })
      }
    } catch { /* graceful degradation */ }

    // Sessions
    try {
      for (const s of recentSessions) {
        if (s.skillSlug && s.skillSlug !== skillSlug) continue
        merged.push({
          type: 'session',
          timestamp: s.lastMessageAt ?? 0,
          summary: s.name || 'Untitled session',
          id: `session-${s.id}`,
          sessionId: s.id,
        })
      }
    } catch { /* graceful degradation */ }

    // Memory facts
    try {
      for (const fact of memoryFacts) {
        merged.push({
          type: 'memory',
          timestamp: fact.createdAt,
          summary: `Learned: ${fact.content}`,
          id: `memory-${fact.id}`,
        })
      }
    } catch { /* graceful degradation */ }

    // Automation history
    try {
      for (const entry of automationHistory) {
        merged.push({
          type: 'automation',
          timestamp: entry.timestamp,
          summary: `Ran ${entry.actionSummary ?? 'automation'} \u2014 ${entry.status}`,
          id: `auto-${entry.id}`,
          sessionId: entry.sessionId,
        })
      }
    } catch { /* graceful degradation */ }

    // Sort descending
    merged.sort((a, b) => b.timestamp - a.timestamp)

    // Group consecutive automation events with the same base name
    const grouped: AgentEvent[] = []
    for (const event of merged) {
      if (event.type === 'automation' && grouped.length > 0) {
        const prev = grouped[grouped.length - 1]
        if (prev.type === 'automation' && prev._groupBase && event.summary) {
          // Extract base name: "Ran <name> — <status>" → "<name>"
          const currBase = event.summary.replace(/^Ran\s+/, '').replace(/\s*—\s*.+$/, '')
          if (currBase === prev._groupBase) {
            prev._groupCount = (prev._groupCount ?? 1) + 1
            // Keep most recent timestamp (already sorted desc)
            continue
          }
        }
      }
      // Tag automation events with their base name for grouping
      if (event.type === 'automation' && event.summary) {
        event._groupBase = event.summary.replace(/^Ran\s+/, '').replace(/\s*—\s*.+$/, '')
        event._groupCount = 1
      }
      grouped.push(event)
    }

    return grouped.slice(0, 10)
  }, [skillSlug, observationHistory, recentSessions, memoryFacts, automationHistory])

  if (loading) {
    return (
      <div className="rounded-xl border border-border/40 bg-background p-4">
        <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-widest mb-3">Activity</h3>
        <TimelineSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border/40 bg-background p-4">
        <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-widest mb-3">Activity</h3>
        <p className="text-[12px] text-destructive">
          Couldn't load events{onRetry && (
            <> — <button type="button" onClick={onRetry} className="underline cursor-pointer">retry</button></>
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/40 bg-background p-4">
      <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-widest mb-3">Activity</h3>

      {events.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-[12px] text-foreground/35 mb-2">No activity yet — run a task to get started.</p>
          <button
            type="button"
            onClick={onNewChat}
            className="inline-flex items-center gap-1.5 text-[12px] text-foreground/60 hover:text-foreground/80 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />Start a conversation
          </button>
        </div>
      ) : (
        <div className="space-y-1" role="list">
          {events.map((event) => {
            const Icon = TYPE_ICON[event.type]
            const isClickable = event.type === 'session' && event.sessionId
            return (
              <button
                key={event.id}
                type="button"
                role="listitem"
                disabled={!isClickable}
                onClick={() => {
                  if (isClickable && event.sessionId) {
                    navigate(routes.view.skills(skillSlug, event.sessionId))
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-3 pl-3.5 border-l-[3px] py-2 pr-2 text-left',
                  TYPE_BORDER[event.type],
                  isClickable && 'hover:bg-foreground/[0.03] cursor-pointer',
                  !isClickable && 'cursor-default',
                  'rounded-r-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
                aria-label={`${event.type}: ${event.summary}`}
              >
                <Icon className={cn('h-3.5 w-3.5 shrink-0', TYPE_ICON_COLOR[event.type])} />
                <span className="flex-1 min-w-0 text-[12px] text-foreground/70 truncate">
                  {event._groupCount && event._groupCount > 1
                    ? `${event._groupBase} — ran ${event._groupCount} times`
                    : event.summary}
                </span>
                <span className="shrink-0 text-[10px] text-foreground/30 tabular-nums">
                  {event.timestamp > 0 ? formatRelativeTime(event.timestamp) : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
