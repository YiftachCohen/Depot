/**
 * TeamHealthBar — warm summary strip with visual weight on key metrics.
 */
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { fadeIn } from './utils'

interface TeamHealthBarProps {
  agentCount: number
  activeCount: number
  observationsToday: number | null
  totalEntities: number
  isLoading: boolean
}

function Metric({ value, label, highlight }: { value: number | string; label: string; highlight?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={cn(
        'font-mono tabular-nums text-[13px]',
        highlight ? 'font-semibold text-amber-600' : 'font-medium text-foreground/60',
      )}>
        {value}
      </span>
      <span className="text-[12px] text-muted-foreground/45">{label}</span>
    </span>
  )
}

export function TeamHealthBar({ agentCount, activeCount, observationsToday, totalEntities, isLoading }: TeamHealthBarProps) {
  if (isLoading) {
    return (
      <motion.div variants={fadeIn} initial="hidden" animate="visible">
        <div className="flex items-center gap-4 py-1">
          <span className="h-4 w-20 rounded bg-foreground/[0.04] animate-pulse" />
          <span className="h-4 w-16 rounded bg-foreground/[0.04] animate-pulse" />
          <span className="h-4 w-28 rounded bg-foreground/[0.04] animate-pulse" />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1"
        aria-live="polite"
      >
        <Metric value={agentCount} label={agentCount !== 1 ? 'Agents' : 'Agent'} />
        <Metric value={activeCount} label="Active" highlight={activeCount > 0} />
        {observationsToday !== null && (
          <Metric value={observationsToday} label={observationsToday !== 1 ? 'Observations Today' : 'Observation Today'} />
        )}
        <Metric value={totalEntities} label={totalEntities !== 1 ? 'Entities' : 'Entity'} />
      </div>
    </motion.div>
  )
}
