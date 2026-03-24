/**
 * AgentCard — clean, neutral card. The icon is the only color.
 * Typography and spacing create hierarchy, not borders or backgrounds.
 */
import { useState } from 'react'
import { Brain, Database, Zap, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { getCommandIcon } from '@/lib/command-icon'
import { cn } from '@/lib/utils'
import { AgentIcon, getActivityStatus, formatRelativeTime, ACTIVITY_DOT, OBSERVATION_HEALTH_DOT, CMD_CHIP } from './utils'
import type { SkillSessionStats, KnowledgeStats } from './utils'
import type { LoadedSkill, QuickCommand } from '../../../../shared/types'

interface AgentCardProps {
  skill: LoadedSkill
  accent: string
  workspaceId: string
  stats: SkillSessionStats | undefined
  agentState: import('@depot/shared/skills').AgentState | undefined
  knowledgeStats: KnowledgeStats | undefined
  automationCount: number
  isStatsLoading?: boolean
  onNavigateToDetail: () => void
  onQuickCommand: (cmd: QuickCommand) => void
  onNewChat: () => void
}

export function AgentCard({
  skill,
  accent,
  workspaceId,
  stats,
  agentState,
  knowledgeStats,
  automationCount,
  isStatsLoading,
  onNavigateToDetail,
  onQuickCommand,
  onNewChat,
}: AgentCardProps) {
  const cmds = skill.manifest?.quick_commands ?? []
  const count = stats?.sessionCount ?? 0
  const activity = getActivityStatus(stats?.lastUsedAt)
  const factCount = agentState?.memory?.facts?.length ?? 0
  const memoryEnabled = skill.manifest?.memory?.enabled

  return (
    <div
      className={cn(
        'rounded-[10px] bg-background',
        'border border-border/50',
        'hover:-translate-y-px hover:shadow-xs hover:border-border/80',
        'transition-all duration-150',
      )}
    >
      <div className="p-4">
        {/* Header — icon is the only color */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onNavigateToDetail}
            className="shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none rounded-xl"
          >
            <AgentIcon skill={skill} accent={accent} workspaceId={workspaceId} />
          </button>
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={onNavigateToDetail}
              className={cn(
                'flex items-center gap-2 text-left rounded-md -mx-1 px-1 py-0.5',
                'hover:bg-foreground/[0.04] transition-colors cursor-pointer',
                'focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none',
              )}
            >
              <span className="text-[15px] font-display font-semibold tracking-[-0.01em] truncate">
                {skill.metadata.name}
              </span>
              <span
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full shrink-0',
                  ACTIVITY_DOT[activity],
                  activity === 'active' && 'animate-pulse',
                )}
                aria-label={`Agent status: ${activity}`}
              />
            </button>
            <p className="text-[13px] leading-relaxed text-muted-foreground/60 line-clamp-1 mt-0.5">
              {skill.metadata.description}
            </p>
          </div>
        </div>

        {/* Stats — small, monochrome, quiet */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11px] text-muted-foreground/50">
          {isStatsLoading ? (
            <>
              <span className="h-3.5 w-16 rounded bg-foreground/[0.04] animate-pulse" />
              <span className="h-3.5 w-12 rounded bg-foreground/[0.04] animate-pulse" />
            </>
          ) : (
            <>
              {count > 0 && (
                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                  {count} session{count !== 1 ? 's' : ''}
                </span>
              )}
              {memoryEnabled && factCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  <span className="font-mono tabular-nums">{factCount}</span>
                </span>
              )}
              {knowledgeStats && (
                <span className="inline-flex items-center gap-1">
                  <span className={cn('inline-block h-1.5 w-1.5 rounded-full', OBSERVATION_HEALTH_DOT[knowledgeStats.observationHealth])} />
                  <Database className="h-3 w-3" />
                  <span className="font-mono tabular-nums">{knowledgeStats.entityCount}</span>
                </span>
              )}
              {automationCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  <span className="font-mono tabular-nums">{automationCount}</span>
                </span>
              )}
              {stats?.lastUsedAt && (
                <span className="ml-auto text-muted-foreground/35">{formatRelativeTime(stats.lastUsedAt)}</span>
              )}
            </>
          )}
        </div>

        {/* Commands — show all, collapse if >6 */}
        <CommandList cmds={cmds} onQuickCommand={onQuickCommand} onNewChat={onNewChat} />
      </div>
    </div>
  )
}

const CMD_FOLD_THRESHOLD = 6

function CommandList({ cmds, onQuickCommand, onNewChat }: {
  cmds: QuickCommand[]
  onQuickCommand: (cmd: QuickCommand) => void
  onNewChat: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const needsFold = cmds.length > CMD_FOLD_THRESHOLD
  const visible = needsFold && !expanded ? cmds.slice(0, CMD_FOLD_THRESHOLD) : cmds

  return (
    <div className="flex flex-wrap items-center gap-1 mt-3 pt-3 border-t border-border/30">
      {visible.map((cmd) => (
        <button
          key={cmd.name}
          type="button"
          onClick={() => onQuickCommand(cmd)}
          className={cn(CMD_CHIP, 'min-h-[28px] focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none')}
        >
          {getCommandIcon(cmd.name, 'h-3 w-3 opacity-60', cmd.icon)}{cmd.name}
        </button>
      ))}
      {needsFold && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(CMD_CHIP, 'text-muted-foreground/35 min-h-[28px] focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none')}
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3 opacity-60" />Less</>
          ) : (
            <><ChevronDown className="h-3 w-3 opacity-60" />+{cmds.length - CMD_FOLD_THRESHOLD} more</>
          )}
        </button>
      )}
      <button
        type="button"
        onClick={onNewChat}
        className={cn(CMD_CHIP, 'text-muted-foreground/35 min-h-[28px] focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none')}
      >
        <Plus className="h-3 w-3 opacity-60" />New Chat
      </button>
    </div>
  )
}
