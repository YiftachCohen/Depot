/**
 * AgentPulseStrip — Live automation pulse showing active cron automations
 * with progress bars between last run and next run.
 *
 * Updates every 30s to advance the progress indicator without re-fetching data.
 */
import * as React from 'react'
import { useMemo, useState, useEffect } from 'react'
import { Zap, Play, Pause, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeNextRuns, formatShortRelativeTime, describeCron } from '../../automations/utils'
import type { AutomationListItem } from '../../automations/types'

interface AgentPulseStripProps {
  automations: AutomationListItem[]
  onTest?: (automationId: string) => void
  onToggle?: (automationId: string) => void
  onDelete?: (automationId: string) => void
}

function formatTimeUntil(date: Date): string {
  const diff = date.getTime() - Date.now()
  if (diff <= 0) return 'now'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d`
}

export function AgentPulseStrip({ automations, onTest, onToggle, onDelete }: AgentPulseStripProps) {
  // Only show enabled cron automations
  const cronAutomations = useMemo(
    () => automations.filter(a => a.enabled && a.cron).slice(0, 3),
    [automations],
  )

  // Tick every 30s to update progress bars
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (cronAutomations.length === 0) return
    const interval = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [cronAutomations.length])

  if (cronAutomations.length === 0) return null

  return (
    <div className="overflow-hidden">
      {cronAutomations.map((auto, i) => (
        <PulseRow key={auto.id} automation={auto} tick={tick} isLast={i === cronAutomations.length - 1} onTest={onTest} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </div>
  )
}

function PulseRow({ automation, tick, isLast, onTest, onToggle, onDelete }: { automation: AutomationListItem; tick: number; isLast: boolean; onTest?: (id: string) => void; onToggle?: (id: string) => void; onDelete?: (id: string) => void }) {
  const [isRunning, setIsRunning] = useState(false)
  const lastRan = automation.lastExecutedAt ?? 0
  const nextRuns = useMemo(() => computeNextRuns(automation.cron!, 1), [automation.cron])
  const nextRun = nextRuns[0] ?? null
  const schedule = useMemo(() => describeCron(automation.cron!), [automation.cron])

  // Compute progress between last run and next run
  const progress = useMemo(() => {
    // Use tick to force recomputation
    void tick
    if (!lastRan || !nextRun) return 0
    const total = nextRun.getTime() - lastRan
    if (total <= 0) return 0
    return Math.min(1, Math.max(0, (Date.now() - lastRan) / total))
  }, [lastRan, nextRun, tick])

  const ranRecently = lastRan > 0 && Date.now() - lastRan < 600_000 // <10min

  return (
    <div className={cn(
      'py-2 group',
      !isLast && 'border-b border-border/20 pb-2 mb-2',
    )}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5">
        <Zap className={cn(
          'h-3.5 w-3.5 shrink-0',
          ranRecently ? 'text-amber-500 animate-pulse' : 'text-foreground/30',
        )} />
        <span className="text-[12px] font-medium text-foreground/70 truncate flex-1">
          {automation.name}
        </span>
        <span className="text-[10px] text-foreground/30" title={schedule}>
          {schedule}
        </span>
        {/* Action buttons on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onTest && (
            <button
              type="button"
              onClick={() => {
                if (isRunning) return
                setIsRunning(true)
                onTest(automation.id)
                setTimeout(() => setIsRunning(false), 3000)
              }}
              disabled={isRunning}
              aria-label={`Run ${automation.name}`}
              className="p-0.5 rounded hover:bg-foreground/[0.08] disabled:opacity-50"
            >
              {isRunning
                ? <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />
                : <Play className="h-3 w-3 text-foreground/40" />
              }
            </button>
          )}
          {onToggle && (
            <button
              type="button"
              onClick={() => onToggle(automation.id)}
              aria-label={automation.enabled ? `Disable ${automation.name}` : `Enable ${automation.name}`}
              className="p-0.5 rounded hover:bg-foreground/[0.08]"
            >
              {automation.enabled
                ? <Pause className="h-3 w-3 text-foreground/40" />
                : <Zap className="h-3 w-3 text-foreground/40" />
              }
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(automation.id)}
              aria-label={`Delete ${automation.name}`}
              className="p-0.5 rounded hover:bg-foreground/[0.08] hover:text-red-500"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Timing info */}
      <div className="flex items-center gap-2 text-[10px] text-foreground/40 mb-2">
        {lastRan > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className={cn(
              'inline-block h-1.5 w-1.5 rounded-full shrink-0',
              ranRecently ? 'bg-green-500' : 'bg-foreground/20',
            )} />
            {formatShortRelativeTime(lastRan)}
          </span>
        )}
        {lastRan > 0 && nextRun && <span aria-hidden>&middot;</span>}
        {nextRun && (
          <span>next in {formatTimeUntil(nextRun)}</span>
        )}
      </div>

      {/* Progress bar */}
      {lastRan > 0 && nextRun && (
        <div className="h-[3px] rounded-full bg-foreground/[0.06] overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-1000 ease-linear',
              ranRecently ? 'bg-amber-500/60' : 'bg-foreground/15',
            )}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
