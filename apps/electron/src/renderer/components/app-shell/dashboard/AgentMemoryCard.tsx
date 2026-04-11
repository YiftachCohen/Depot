/**
 * AgentKnowledgeCard — Card showing knowledge entity count for an agent.
 *
 * Renders within the right-column content area of the agent detail view.
 * Replaced the legacy AgentMemoryCard that showed memory facts.
 */
import * as React from 'react'
import { Database } from 'lucide-react'
import type { KnowledgeStatsData } from './types'

interface AgentKnowledgeCardProps {
  workspaceId: string
  skillSlug: string
  knowledgeStats: KnowledgeStatsData | undefined
}

export function AgentMemoryCard({
  workspaceId,
  skillSlug,
  knowledgeStats,
}: AgentKnowledgeCardProps) {
  const entityCount = knowledgeStats?.entityCount ?? 0

  return (
    <div className="rounded-xl border border-border/40 bg-background p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-widest inline-flex items-center gap-1.5">
          <Database className="h-3 w-3" />
          Knowledge
          {entityCount > 0 && <span className="text-foreground/30 normal-case tracking-normal font-normal">({entityCount} {entityCount === 1 ? 'entity' : 'entities'})</span>}
        </h3>
      </div>

      {entityCount === 0 ? (
        <p className="text-[11px] text-foreground/30 italic">
          No knowledge entities yet. Knowledge is gathered during sessions and observations.
        </p>
      ) : (
        <p className="text-[12px] leading-relaxed text-foreground/70">
          {entityCount} {entityCount === 1 ? 'entity' : 'entities'} tracked across sessions.
        </p>
      )}
    </div>
  )
}
