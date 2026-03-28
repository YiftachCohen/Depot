/**
 * AgentAutomationsCard — Card wrapper around the AgentAutomationsSection
 * extracted from SkillDashboard.
 *
 * Renders automation list with inline execution history for a specific agent.
 */
import * as React from 'react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Zap, Plus, Check, XCircle, AlertTriangle, Loader2, Play, Trash2, Pause,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { navigate, routes } from '@/lib/navigate'
import { formatShortRelativeTime, computeNextRuns } from '../../automations/utils'
import type { AutomationListItem, ExecutionEntry, PromptAction } from '../../automations/types'

function formatTimeUntilCompact(date: Date): string {
  const diff = date.getTime() - Date.now()
  if (diff <= 0) return 'now'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d`
}

// ---------------------------------------------------------------------------
// Status icon config (same as SkillDashboard)
// ---------------------------------------------------------------------------
const STATUS_ICON: Record<string, { icon: typeof Check; cls: string }> = {
  success: { icon: Check, cls: 'text-green-600' },
  error: { icon: XCircle, cls: 'text-red-600' },
  blocked: { icon: AlertTriangle, cls: 'text-yellow-600' },
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AgentAutomationsCardProps {
  skillSlug: string
  skillPath: string
  automations: AutomationListItem[]
  onTest?: (automationId: string) => void
  onToggle?: (automationId: string) => void
  onDelete?: (automationId: string) => void
  getHistory?: (automationId: string) => Promise<ExecutionEntry[]>
  /** When true, renders without the outer card border/background (for embedding in the left rail) */
  compact?: boolean
}

export function AgentAutomationsCard({
  skillSlug,
  skillPath,
  automations,
  onTest,
  onToggle,
  onDelete,
  getHistory,
  compact,
}: AgentAutomationsCardProps) {
  const [historyMap, setHistoryMap] = useState<Record<string, ExecutionEntry[]>>({})
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())

  // Filter automations: skill-sourced + workspace automations that @mention this agent
  const agentAutomations = useMemo(() => {
    return automations.filter(a => {
      if (a.skillSlug === skillSlug) return true
      if (a.source !== 'skill' && !a.skillSlug) {
        return a.actions.some(action => {
          if (action.type !== 'prompt') return false
          const prompt = (action as PromptAction).prompt
          const idx = prompt.indexOf(`@${skillSlug}`)
          if (idx === -1) return false
          const after = prompt[idx + skillSlug.length + 1]
          return after === undefined || /\W/.test(after)
        })
      }
      return false
    })
  }, [automations, skillSlug])

  // Fetch execution history
  const autoIds = agentAutomations.map(a => a.id).join(',')
  useEffect(() => {
    if (!getHistory || agentAutomations.length === 0) return
    let stale = false

    const fetchAll = async () => {
      const results = await Promise.allSettled(
        agentAutomations.map(async (auto) => {
          const history = await getHistory(auto.id)
          return { id: auto.id, entries: history.slice(0, 2) }
        }),
      )
      if (stale) return
      const entries: Record<string, ExecutionEntry[]> = {}
      for (const r of results) {
        if (r.status === 'fulfilled') entries[r.value.id] = r.value.entries
      }
      setHistoryMap(entries)
    }

    fetchAll()

    const cleanup = window.electronAPI.onAutomationsChanged?.(() => {
      if (!stale) fetchAll()
    })

    return () => {
      stale = true
      cleanup?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoIds, getHistory])

  const handleRun = useCallback((automationId: string, name: string) => {
    if (!onTest || runningIds.has(automationId)) return
    setRunningIds(prev => new Set(prev).add(automationId))
    try {
      onTest(automationId)
      toast(`Running: ${name}`, { description: 'Automation triggered' })
    } catch {
      toast.error(`Failed to trigger: ${name}`)
    }
    setTimeout(() => {
      setRunningIds(prev => {
        const next = new Set(prev)
        next.delete(automationId)
        return next
      })
    }, 3000)
  }, [onTest, runningIds])

  // ---------------------------------------------------------------------------
  // Shared action-button styles
  // ---------------------------------------------------------------------------
  const actionBtnCls = cn(
    'shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity',
    'p-0.5 rounded hover:bg-foreground/[0.08]',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50',
  )

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  function renderActionButtons(auto: AutomationListItem, isRunning: boolean) {
    return (
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          title="Run now"
          onClick={(e) => { e.stopPropagation(); handleRun(auto.id, auto.name) }}
          disabled={isRunning}
          aria-label={`Run ${auto.name}`}
          className={cn(actionBtnCls, 'disabled:opacity-50')}
        >
          {isRunning
            ? <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />
            : <Play className="h-3 w-3 text-foreground/40" />
          }
        </button>
        {onToggle && (
          <button
            type="button"
            title={auto.enabled ? 'Disable' : 'Enable'}
            onClick={(e) => { e.stopPropagation(); onToggle(auto.id) }}
            aria-label={auto.enabled ? `Disable ${auto.name}` : `Enable ${auto.name}`}
            className={actionBtnCls}
          >
            {auto.enabled
              ? <Pause className="h-3 w-3 text-foreground/40" />
              : <Zap className="h-3 w-3 text-foreground/40" />
            }
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(auto.id) }}
            aria-label={`Delete ${auto.name}`}
            className={cn(actionBtnCls, 'hover:text-red-500')}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }

  function renderCompactRow(auto: AutomationListItem) {
    const isRunning = runningIds.has(auto.id)
    const lastRan = auto.lastExecutedAt ?? 0
    const ranRecently = lastRan > 0 && Date.now() - lastRan < 600_000
    const nextRuns = auto.enabled && auto.cron ? computeNextRuns(auto.cron, 1) : []
    const nextRun = nextRuns[0]
    const entries = historyMap[auto.id] ?? []

    return (
      <div
        key={auto.id}
        role="button"
        tabIndex={0}
        onClick={() => navigate(routes.view.automations({ automationId: auto.id }))}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(routes.view.automations({ automationId: auto.id })) } }}
        aria-label={`View ${auto.name} automation`}
        className="group py-2 rounded-md px-1 -mx-1 hover:bg-foreground/[0.03] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50"
      >
        {/* Row 1: icon + name + action buttons */}
        <div className="flex items-center gap-2 mb-1">
          <Zap className={cn(
            'h-3.5 w-3.5 shrink-0',
            !auto.enabled ? 'text-foreground/20' : ranRecently ? 'text-amber-500 animate-pulse' : 'text-foreground/30',
          )} />
          <span className={cn('text-[12px] font-medium text-foreground/70 truncate flex-1', !auto.enabled && 'text-foreground/40 line-through')}>
            {auto.name}
          </span>
          {renderActionButtons(auto, isRunning)}
        </div>

        {/* Row 2: timing — kept minimal */}
        <div className="flex items-center gap-1.5 text-[10px] text-foreground/30 ml-[22px]">
          {lastRan > 0 && (
            <>
              <span className={cn(
                'inline-block h-1.5 w-1.5 rounded-full shrink-0',
                ranRecently ? 'bg-green-500' : 'bg-foreground/20',
              )} />
              <span>{formatShortRelativeTime(lastRan)}</span>
            </>
          )}
          {lastRan > 0 && auto.enabled && nextRun && <span className="text-foreground/15">&middot;</span>}
          {auto.enabled && nextRun && (
            <span>next in {formatTimeUntilCompact(nextRun)}</span>
          )}
          {!auto.enabled && (
            <span className="text-foreground/25 italic">paused</span>
          )}
        </div>

        {/* Progress bar — only for enabled cron automations */}
        {auto.enabled && auto.cron && lastRan > 0 && nextRun && (() => {
          const total = nextRun.getTime() - lastRan
          const progress = total > 0 ? Math.min(1, Math.max(0, (Date.now() - lastRan) / total)) : 0
          return (
            <div className="h-[2px] rounded-full bg-foreground/[0.06] overflow-hidden mt-1.5 ml-[22px]">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-1000 ease-linear',
                  ranRecently ? 'bg-amber-500/60' : 'bg-foreground/15',
                )}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )
        })()}
      </div>
    )
  }

  function renderWideRow(auto: AutomationListItem) {
    const entries = historyMap[auto.id] ?? []
    const isWorkspace = auto.source !== 'skill' && !auto.skillSlug
    const isRunning = runningIds.has(auto.id)
    const nextRuns = auto.cron ? computeNextRuns(auto.cron, 1) : []
    const nextRun = nextRuns[0]

    return (
      <div key={auto.id} className="group">
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate(routes.view.automations({ automationId: auto.id }))}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(routes.view.automations({ automationId: auto.id })) } }}
          aria-label={`View ${auto.name} automation`}
          className="w-full flex items-center gap-2 text-[12px] text-left rounded-md -mx-1 px-1 py-1 hover:bg-foreground/[0.03] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50"
        >
          <Zap className={cn('h-3 w-3 shrink-0', auto.enabled ? 'text-amber-500' : 'text-foreground/20')} />
          <span className={cn('min-w-0 truncate font-medium', !auto.enabled && 'text-foreground/40 line-through')}>
            {auto.name}
          </span>
          {isWorkspace && (
            <span className="shrink-0 text-[9px] text-stone-400 bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded-full leading-none">
              workspace
            </span>
          )}
          <span className={cn(
            'shrink-0 inline-block h-1.5 w-1.5 rounded-full',
            auto.enabled ? 'bg-green-600' : 'bg-stone-400',
          )} />
          {auto.lastExecutedAt && (
            <span className="shrink-0 text-[10px] text-foreground/30">
              {formatShortRelativeTime(auto.lastExecutedAt)}
              {entries[0] && (
                <span className={cn('ml-0.5', STATUS_ICON[entries[0].status]?.cls)}>
                  {entries[0].status === 'success' ? '\u2713' : entries[0].status === 'error' ? '\u2717' : '\u26a0'}
                </span>
              )}
            </span>
          )}
          {nextRun && (
            <span className="shrink-0 text-[10px] text-foreground/20">
              \u2192 {nextRun.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          )}
          <span className="flex-1" />
          {renderActionButtons(auto, isRunning)}
        </div>

        {entries.length > 0 && (
          <div className="ml-5 mt-0.5 space-y-0.5">
            {entries.map((entry) => {
              const statusCfg = STATUS_ICON[entry.status] ?? STATUS_ICON.error
              const StatusIcon = statusCfg.icon
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => { if (entry.sessionId) navigate(routes.view.skills(skillSlug, entry.sessionId)) }}
                  disabled={!entry.sessionId}
                  className={cn(
                    'flex items-center gap-1.5 text-[11px] w-full text-left rounded py-0.5 px-1 -mx-1',
                    entry.sessionId && 'hover:bg-foreground/[0.03] cursor-pointer',
                    !entry.sessionId && 'cursor-default',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50',
                  )}
                  aria-label={entry.sessionId ? `Open session for ${auto.name} execution` : undefined}
                >
                  <StatusIcon className={cn('h-2.5 w-2.5 shrink-0', statusCfg.cls)} />
                  <span className="text-foreground/35">{formatShortRelativeTime(entry.timestamp)}</span>
                  {entry.actionSummary && (
                    <span className={cn(
                      'flex-1 min-w-0 truncate',
                      entry.status === 'error' ? 'text-red-500/70' : 'text-foreground/25',
                    )}>
                      {entry.actionSummary.length > 50 ? entry.actionSummary.slice(0, 50) + '\u2026' : entry.actionSummary}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'rounded-xl border border-border/40 bg-background p-4'}>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className={cn(
          'font-medium text-foreground/40 uppercase tracking-widest',
          compact ? 'text-[10px]' : 'text-[11px]',
        )}>
          Automations{agentAutomations.length > 0 && ` (${agentAutomations.length})`}
        </h3>
        <EditPopover
          trigger={
            <button type="button" className="inline-flex items-center gap-1 text-[11px] text-foreground/40 hover:text-foreground/70 transition-colors cursor-pointer">
              <Plus className="h-3 w-3" />Add
            </button>
          }
          {...getEditConfig('skill-automation', skillPath)}
        />
      </div>

      {agentAutomations.length === 0 ? (
        <div className="flex items-center gap-2 text-[11px] text-foreground/30 italic">
          <Zap className="h-3.5 w-3.5 text-foreground/15" />
          No automations configured.
        </div>
      ) : compact ? (
        <div className="divide-y divide-border/20">
          {agentAutomations.map((auto) => renderCompactRow(auto))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {agentAutomations.map((auto) => renderWideRow(auto))}
        </div>
      )}
    </div>
  )
}
