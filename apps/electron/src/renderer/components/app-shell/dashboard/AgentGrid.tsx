/**
 * AgentGrid — responsive grid container for agent cards.
 */
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { containerVariants, itemVariants, getAccentColor } from './utils'
import type { SkillSessionStats, KnowledgeStats } from './utils'
import { AgentCard } from './AgentCard'
import type { LoadedSkill, QuickCommand } from '../../../../shared/types'

interface AgentGridProps {
  agents: LoadedSkill[]
  activeWorkspaceId: string
  skillStats: Map<string, SkillSessionStats>
  agentStateMap: Map<string, import('@depot/shared/skills').AgentState>
  knowledgeStatsMap: Map<string, KnowledgeStats>
  skillAutomationCounts: Map<string, number>
  isStatsLoading?: boolean
  searchQuery: string
  onNavigateToAgent: (slug: string) => void
  onQuickCommand: (skill: LoadedSkill, cmd: QuickCommand) => void
  onNewChat: (skill: LoadedSkill) => void
  onAddAgent: () => void
}

export function AgentGrid({
  agents,
  activeWorkspaceId,
  skillStats,
  agentStateMap,
  knowledgeStatsMap,
  skillAutomationCounts,
  isStatsLoading,
  searchQuery,
  onNavigateToAgent,
  onQuickCommand,
  onNewChat,
  onAddAgent,
}: AgentGridProps) {
  // Search empty state
  if (agents.length === 0 && searchQuery.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
        <p className="text-[13px] text-muted-foreground/50">
          No agents match &lsquo;<span className="font-medium text-foreground/60">{searchQuery}</span>&rsquo;
        </p>
      </div>
    )
  }

  if (agents.length === 0) return null

  const gridCls = cn(
    'grid gap-3',
    agents.length <= 2
      ? 'grid-cols-1 max-w-[480px]'
      : agents.length <= 5
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  )

  return (
    <motion.div
      className={gridCls}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      role="region"
      aria-label="Agent team"
    >
      {agents.map((skill) => (
        <motion.div key={skill.slug} variants={itemVariants}>
          <AgentCard
            skill={skill}
            accent={getAccentColor(skill.slug)}
            workspaceId={activeWorkspaceId}
            stats={skillStats.get(skill.slug)}
            agentState={agentStateMap.get(skill.slug)}
            knowledgeStats={knowledgeStatsMap.get(skill.slug)}
            automationCount={skillAutomationCounts.get(skill.slug) ?? 0}
            isStatsLoading={isStatsLoading}
            onNavigateToDetail={() => onNavigateToAgent(skill.slug)}
            onQuickCommand={(cmd) => onQuickCommand(skill, cmd)}
            onNewChat={() => onNewChat(skill)}
          />
        </motion.div>
      ))}

      {/* Add Agent — last grid item */}
      <motion.div variants={itemVariants}>
        <button
          type="button"
          onClick={onAddAgent}
          className={cn(
            'w-full flex items-center gap-3 rounded-[10px] p-4',
            'border border-dashed border-border/50',
            'hover:bg-background hover:border-amber-500/30 hover:shadow-xs',
            'transition-all cursor-pointer',
            'focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none',
          )}
        >
          <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-secondary/50">
            <Plus className="h-4 w-4 text-muted-foreground/40" />
          </div>
          <span className="text-[13px] text-muted-foreground/60 font-medium">Add Agent</span>
        </button>
      </motion.div>
    </motion.div>
  )
}
