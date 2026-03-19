/**
 * AgentMemoryPanel — collapsible section showing an agent's cross-session memory.
 * Rendered within the focused agent detail view in SkillDashboard.
 */
import * as React from 'react'
import { useState, useCallback } from 'react'
import { Brain, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AgentMemoryFact } from '@depot/shared/skills'
import { cn } from '@/lib/utils'

interface AgentMemoryPanelProps {
  workspaceId: string
  skillSlug: string
  facts: AgentMemoryFact[]
  onFactsChanged: () => void
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function AgentMemoryPanel({ workspaceId, skillSlug, facts, onFactsChanged }: AgentMemoryPanelProps) {
  const [clearing, setClearing] = useState(false)

  const handleDeleteFact = useCallback(async (factId: string) => {
    try {
      await window.electronAPI.deleteAgentMemoryFact(workspaceId, skillSlug, factId)
      onFactsChanged()
    } catch {
      toast.error('Failed to delete memory fact')
    }
  }, [workspaceId, skillSlug, onFactsChanged])

  const handleClearAll = useCallback(async () => {
    setClearing(true)
    try {
      await window.electronAPI.clearAgentMemory(workspaceId, skillSlug)
      onFactsChanged()
      toast.success('Memory cleared')
    } catch {
      toast.error('Failed to clear memory')
    } finally {
      setClearing(false)
    }
  }, [workspaceId, skillSlug, onFactsChanged])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-widest inline-flex items-center gap-1.5">
          <Brain className="h-3 w-3" />
          Memory
          {facts.length > 0 && <span className="text-foreground/30 normal-case tracking-normal font-normal">({facts.length})</span>}
        </h3>
        {facts.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            disabled={clearing}
            className="text-[10px] text-foreground/35 hover:text-destructive/60 transition-colors cursor-pointer disabled:opacity-40"
          >
            Clear all
          </button>
        )}
      </div>

      {facts.length === 0 ? (
        <p className="text-[11px] text-foreground/30 italic">
          No memories yet. Memories are learned during sessions.
        </p>
      ) : (
        <div className="space-y-0">
          {facts.map((fact) => (
            <div key={fact.id} className="group/fact flex items-start gap-2 py-1.5 -mx-1.5 px-1.5 rounded hover:bg-foreground/[0.03] transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] leading-relaxed text-foreground/70 line-clamp-2">{fact.content}</p>
                <span className="text-[10px] text-foreground/25">{formatRelativeTime(fact.createdAt)}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteFact(fact.id)}
                className="shrink-0 mt-0.5 opacity-0 group-hover/fact:opacity-100 transition-opacity text-foreground/30 hover:text-destructive/60 cursor-pointer"
                aria-label={`Delete: ${fact.content.slice(0, 30)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
