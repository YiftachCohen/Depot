/**
 * AgentHandoffCard — "Since you were away" hero card.
 *
 * Adapts content based on page mode:
 * - knowledge-enabled: entity/pattern deltas from observation history
 * - automation-only: last automation result + next run
 * - chat-first: last session summary
 * - new-agent: welcome message with CTA
 */
import * as React from 'react'
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, Sparkles, Zap, MessageSquare, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ObservationRun, AgentState } from '@depot/shared/skills'
import type { SessionMetadata } from '@depot/core/types'
import type { AgentPageMode, KnowledgeStatsData } from './types'
import { formatRelativeTime } from './AgentProfileColumn'
import type { AutomationListItem } from '../../automations/types'

interface AgentHandoffCardProps {
  mode: AgentPageMode
  observationHistory: ObservationRun[]
  knowledgeStats: KnowledgeStatsData | undefined
  agentState: AgentState | undefined
  recentSessions: Array<{ id: string; name?: string; lastMessageAt?: number }>
  automations: AutomationListItem[]
  onNewChat: () => void
  reducedMotion: boolean
}

export function AgentHandoffCard({
  mode,
  observationHistory,
  knowledgeStats,
  agentState,
  recentSessions,
  automations,
  onNewChat,
  reducedMotion,
}: AgentHandoffCardProps) {
  const [expanded, setExpanded] = useState(false)

  // Compute observation summary since last user session
  const observationSummary = useMemo(() => {
    try {
      if (observationHistory.length === 0) return null
      const lastUserSession = agentState?.lastUserSessionTimestamp ?? 0
      const recentObs = lastUserSession > 0
        ? observationHistory.filter(o => o.timestamp > lastUserSession)
        : observationHistory.slice(0, 5)

      if (recentObs.length === 0) return null

      const totalEntities = recentObs.reduce((sum, o) => sum + (o.entitiesAdded ?? 0), 0)
      const totalPatterns = recentObs.reduce((sum, o) => sum + (o.patternsAdded ?? 0), 0)
      const successCount = recentObs.filter(o => o.outcome === 'success').length
      const failureCount = recentObs.filter(o => o.outcome === 'failure').length

      return {
        runCount: recentObs.length,
        entitiesAdded: totalEntities,
        patternsAdded: totalPatterns,
        successCount,
        failureCount,
        observations: recentObs,
      }
    } catch {
      return null
    }
  }, [observationHistory, agentState?.lastUserSessionTimestamp])

  const content = useMemo(() => {
    switch (mode) {
      case 'knowledge-enabled': {
        if (!observationSummary) {
          // Even without observations since last session, show current knowledge stats if available
          if (knowledgeStats && knowledgeStats.entityCount > 0) {
            return {
              icon: Sparkles,
              title: 'Knowledge agent active',
              body: `Tracking ${knowledgeStats.entityCount} entit${knowledgeStats.entityCount !== 1 ? 'ies' : 'y'} · ${knowledgeStats.patternCount} pattern${knowledgeStats.patternCount !== 1 ? 's' : ''}`,
              expandable: false,
            }
          }
          return {
            icon: Sparkles,
            title: 'Knowledge agent ready',
            body: 'No observations yet. Run one to start learning.',
            expandable: false,
          }
        }
        const parts: string[] = []
        parts.push(`${observationSummary.runCount} observation${observationSummary.runCount !== 1 ? 's' : ''} ran`)
        if (observationSummary.entitiesAdded > 0) {
          parts.push(`discovered ${observationSummary.entitiesAdded} new entit${observationSummary.entitiesAdded !== 1 ? 'ies' : 'y'}`)
        }
        if (observationSummary.patternsAdded > 0) {
          parts.push(`${observationSummary.patternsAdded} new pattern${observationSummary.patternsAdded !== 1 ? 's' : ''}`)
        }
        if (observationSummary.failureCount > 0) {
          parts.push(`${observationSummary.failureCount} failed`)
        }
        return {
          icon: Sparkles,
          title: 'Since you were away',
          body: parts.join(' \u00b7 '),
          expandable: observationSummary.observations.length > 0,
        }
      }

      case 'automation-only': {
        const enabledAutomations = automations.filter(a => a.enabled)
        const lastRun = enabledAutomations
          .filter(a => a.lastExecutedAt)
          .sort((a, b) => (b.lastExecutedAt ?? 0) - (a.lastExecutedAt ?? 0))[0]

        if (!lastRun) {
          return {
            icon: Zap,
            title: 'Automations ready',
            body: `${enabledAutomations.length} automation${enabledAutomations.length !== 1 ? 's' : ''} active. Waiting for the next trigger.`,
            expandable: false,
          }
        }
        return {
          icon: Zap,
          title: 'Latest automation',
          body: `"${lastRun.name}" ran ${formatRelativeTime(lastRun.lastExecutedAt!)}`,
          expandable: false,
        }
      }

      case 'chat-first': {
        const lastSession = recentSessions[0]
        if (!lastSession) {
          return {
            icon: MessageSquare,
            title: 'Ready to chat',
            body: 'Start a conversation using the quick commands.',
            expandable: false,
          }
        }
        return {
          icon: MessageSquare,
          title: 'Last conversation',
          body: `${lastSession.name || 'Untitled'}${lastSession.lastMessageAt ? ` \u00b7 ${formatRelativeTime(lastSession.lastMessageAt)}` : ''}`,
          expandable: false,
        }
      }

      case 'new-agent': {
        return {
          icon: Rocket,
          title: 'Welcome!',
          body: 'Start by running a task below, or open a new chat to get going.',
          expandable: false,
        }
      }
    }
  }, [mode, observationSummary, recentSessions, automations])

  const IconComp = content.icon

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden',
        mode === 'new-agent'
          ? 'bg-amber-500/[0.08] dark:bg-amber-500/[0.06] border border-amber-500/20 dark:border-amber-500/15'
          : 'bg-amber-500/[0.05] dark:bg-amber-500/[0.04] border border-amber-500/15 dark:border-amber-500/10',
      )}
    >
      <button
        type="button"
        onClick={() => content.expandable && setExpanded(v => !v)}
        disabled={!content.expandable}
        className={cn(
          'w-full flex items-start gap-3 px-4 py-4 text-left',
          content.expandable && 'cursor-pointer hover:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.04] transition-colors',
          !content.expandable && 'cursor-default',
        )}
        aria-expanded={content.expandable ? expanded : undefined}
      >
        <div className="h-7 w-7 rounded-lg bg-amber-500/15 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
          <IconComp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="text-[13px] font-semibold text-foreground/85">{content.title}</h3>
          <p className="text-[12px] text-foreground/50 mt-1 leading-relaxed">{content.body}</p>
        </div>
        {content.expandable && (
          <ChevronDown className={cn(
            'h-3.5 w-3.5 text-foreground/30 shrink-0 mt-1 transition-transform',
            expanded && 'rotate-180',
          )} />
        )}
      </button>

      {/* Expanded observation detail */}
      <AnimatePresence>
        {expanded && observationSummary && (
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1 border-t border-amber-200/30 dark:border-amber-800/30 pt-2">
              {observationSummary.observations.slice(0, 5).map((obs, i) => (
                <div key={`${obs.timestamp}-${i}`} className="flex items-center gap-2 text-[11px] text-foreground/45">
                  <span className={cn(
                    'inline-block h-1.5 w-1.5 rounded-full shrink-0',
                    obs.outcome === 'success' ? 'bg-green-500' : obs.outcome === 'failure' ? 'bg-red-500' : 'bg-amber-500',
                  )} />
                  <span>{formatRelativeTime(obs.timestamp)}</span>
                  {obs.entitiesAdded > 0 && <span>+{obs.entitiesAdded} entities</span>}
                  {(obs.patternsAdded ?? 0) > 0 && <span>+{obs.patternsAdded} patterns</span>}
                  {obs.tokensUsed > 0 && <span className="text-foreground/30">{obs.tokensUsed.toLocaleString()} tokens</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
