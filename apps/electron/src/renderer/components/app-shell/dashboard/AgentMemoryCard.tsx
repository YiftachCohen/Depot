/**
 * AgentMemoryCard — Card wrapper around the existing AgentMemoryPanel.
 *
 * Renders within the right-column content area of the agent detail view.
 */
import * as React from 'react'
import { Brain } from 'lucide-react'
import { AgentMemoryPanel } from '../AgentMemoryPanel'
import type { AgentMemoryFact } from '@depot/shared/skills'

interface AgentMemoryCardProps {
  workspaceId: string
  skillSlug: string
  facts: AgentMemoryFact[]
  onFactsChanged: () => void
}

export function AgentMemoryCard({
  workspaceId,
  skillSlug,
  facts,
  onFactsChanged,
}: AgentMemoryCardProps) {
  return (
    <div className="rounded-xl border border-border/40 bg-background p-4">
      <AgentMemoryPanel
        workspaceId={workspaceId}
        skillSlug={skillSlug}
        facts={facts}
        onFactsChanged={onFactsChanged}
      />
    </div>
  )
}
