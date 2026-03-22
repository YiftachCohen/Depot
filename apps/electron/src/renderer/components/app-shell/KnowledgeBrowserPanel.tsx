/**
 * KnowledgeBrowserPanel — Browse entities, patterns, and relationships
 * in a knowledge-enabled agent's knowledge store.
 */
import * as React from 'react'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Database, MoreVertical, Search, Loader2, Play, Sparkles, AlertTriangle, Pause, PlayCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipTrigger, TooltipContent } from '@depot/ui'
import { useNavigation } from '@/contexts/NavigationContext'
import type { KnowledgeEntity, KnowledgeRelationship, KnowledgePattern } from '@depot/shared/skills/knowledge'
import type { ObservationRun } from '@depot/shared/skills'

interface KnowledgeBrowserPanelProps {
  workspaceId: string
  skillSlug: string
  onBack?: () => void
}

interface EntityWithRelationships extends KnowledgeEntity {
  relationships: KnowledgeRelationship[]
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  return (
    <div
      className="h-1 w-16 rounded-full bg-stone-200 dark:bg-stone-700"
      role="meter"
      aria-valuenow={confidence}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-label={`Confidence: ${pct}%`}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          confidence >= 0.3 ? 'bg-amber-400' : 'bg-stone-400',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-3 px-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse space-y-1.5">
          <div className="h-3 w-32 rounded bg-foreground/[0.06]" />
          <div className="h-1 w-16 rounded bg-foreground/[0.06]" />
        </div>
      ))}
    </div>
  )
}

export function KnowledgeBrowserPanel({ workspaceId, skillSlug, onBack }: KnowledgeBrowserPanelProps) {
  const { navigateToSession } = useNavigation()
  const [entities, setEntities] = useState<EntityWithRelationships[]>([])
  const [patterns, setPatterns] = useState<KnowledgePattern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null)
  const [runningObservation, setRunningObservation] = useState(false)
  const [runningConsolidation, setRunningConsolidation] = useState(false)
  const [observationPaused, setObservationPaused] = useState(false)
  const [observationHistory, setObservationHistory] = useState<ObservationRun[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [entityResult, patternResult, historyResult, agentState] = await Promise.all([
        window.electronAPI.queryKnowledgeEntities(workspaceId, skillSlug),
        window.electronAPI.queryKnowledgePatterns(workspaceId, skillSlug),
        window.electronAPI.getObservationHistory(workspaceId, skillSlug),
        window.electronAPI.getAgentState(workspaceId, skillSlug),
      ])
      setEntities(entityResult ?? [])
      setPatterns(patternResult ?? [])
      setObservationHistory(historyResult ?? [])
      setObservationPaused(agentState?.observationPaused ?? false)
    } catch (e) {
      setError('Failed to load knowledge')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, skillSlug])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Derive domains from entities
  const domains = useMemo(() => {
    const set = new Set<string>()
    for (const e of entities) if (e.domain) set.add(e.domain)
    return Array.from(set).sort()
  }, [entities])

  // Filter entities by domain and search
  const filteredEntities = useMemo(() => {
    let result = entities.filter(e => !e.archived)
    if (selectedDomain) result = result.filter(e => e.domain === selectedDomain)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.domain.toLowerCase().includes(q)
      )
    }
    return result.sort((a, b) => b.lastSeen - a.lastSeen)
  }, [entities, selectedDomain, searchQuery])

  const handleRunObservation = useCallback(async () => {
    setRunningObservation(true)
    try {
      const result = await window.electronAPI.triggerObservation(workspaceId, skillSlug)
      toast.success('Observation started')
      if (result?.sessionId) {
        navigateToSession(result.sessionId)
      }
    } catch (e) {
      toast.error(`Observation failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setRunningObservation(false)
    }
  }, [workspaceId, skillSlug, navigateToSession])

  const handleTogglePause = useCallback(async () => {
    try {
      const result = await window.electronAPI.setObservationPaused(workspaceId, skillSlug, !observationPaused)
      setObservationPaused(result.paused)
      toast.success(result.paused ? 'Observations paused' : 'Observations resumed')
    } catch (e) {
      toast.error(`Failed to ${observationPaused ? 'resume' : 'pause'}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }, [workspaceId, skillSlug, observationPaused])

  const handleRunConsolidation = useCallback(async () => {
    setRunningConsolidation(true)
    try {
      const result = await window.electronAPI.triggerConsolidation(workspaceId, skillSlug)
      const parts: string[] = []
      if (result?.deduplicated) parts.push(`${result.deduplicated} deduped`)
      if (result?.decayed) parts.push(`${result.decayed} decayed`)
      if (result?.archived) parts.push(`${result.archived} archived`)
      if (result?.purged) parts.push(`${result.purged} purged`)
      toast.success(parts.length > 0 ? `Consolidation: ${parts.join(', ')}` : 'Consolidation complete — no changes')
      await loadData()
    } catch (e) {
      toast.error(`Consolidation failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setRunningConsolidation(false)
    }
  }, [workspaceId, skillSlug, loadData])

  const entityCount = entities.filter(e => !e.archived).length

  return (
    <div>
      {/* Header — matches AgentMemoryPanel section header style */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-widest inline-flex items-center gap-1.5">
          <Database className="h-3 w-3" />
          Knowledge
          {entityCount > 0 && <span className="text-foreground/30 normal-case tracking-normal font-normal">({entityCount})</span>}
        </h3>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleRunObservation}
                disabled={runningObservation}
                className="cursor-pointer text-foreground/30 hover:text-foreground/60 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded p-0.5"
                aria-label="Run observation"
              >
                {runningObservation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Run Observation</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleRunConsolidation}
                disabled={runningConsolidation}
                className="cursor-pointer text-foreground/30 hover:text-foreground/60 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded p-0.5"
                aria-label="Run consolidation"
              >
                {runningConsolidation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Run Consolidation</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="cursor-pointer text-foreground/30 hover:text-foreground/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded p-0.5"
                    aria-label="More knowledge actions"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">More Actions</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={handleTogglePause}
                className="text-[12px]"
              >
                {observationPaused ? <PlayCircle className="h-3.5 w-3.5 mr-2" /> : <Pause className="h-3.5 w-3.5 mr-2" />}
                {observationPaused ? 'Resume Observations' : 'Pause Observations'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Size warning banner */}
      {entityCount > 5000 && (
        <div className="px-3 py-2 mb-2 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[12px] border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-3 w-3 inline mr-1.5 -mt-0.5" />
          Knowledge store is large ({entityCount.toLocaleString()} entities). Consider reviewing and archiving unused domains.
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="entities">
        <TabsList className="mb-2">
          <TabsTrigger value="entities" className="text-[12px]">Entities</TabsTrigger>
          <TabsTrigger value="patterns" className="text-[12px]">Patterns</TabsTrigger>
          <TabsTrigger value="history" className="text-[12px]">History</TabsTrigger>
        </TabsList>

        {/* Entities tab */}
        <TabsContent value="entities" className="mt-0">
          {/* Filters */}
          <div className="flex items-center gap-2 py-2">
            {domains.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-[12px] px-2 py-1 rounded-md border border-border/40 text-foreground/60 hover:text-foreground/80 hover:border-border/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {selectedDomain ?? 'All domains'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                  <DropdownMenuItem onClick={() => setSelectedDomain(null)} className="text-[12px]">
                    All domains
                  </DropdownMenuItem>
                  {domains.map(d => (
                    <DropdownMenuItem key={d} onClick={() => setSelectedDomain(d)} className="text-[12px]">
                      {d}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground/30" />
              <input
                type="text"
                placeholder="Search entities..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-[13px] bg-foreground/[0.03] border border-border/40 rounded-md pl-7 pr-3 py-1.5 placeholder:text-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Entity list */}
            <div role="list" className="max-h-[320px] overflow-y-auto overflow-x-hidden">
              {loading ? (
                <SkeletonRows count={5} />
              ) : error ? (
                <div className="text-[12px] text-destructive">
                  {error} — <button type="button" onClick={loadData} className="underline">retry</button>
                </div>
              ) : filteredEntities.length === 0 ? (
                <p className="text-[11px] text-foreground/30 italic py-4">
                  {searchQuery.trim()
                    ? `No matches for '${searchQuery}'`
                    : 'No entities yet — knowledge accumulates through observation loops and conversations'}
                </p>
              ) : (
                filteredEntities.map(entity => (
                  <div key={entity.id} role="listitem">
                    <button
                      type="button"
                      onClick={() => setExpandedEntity(expandedEntity === entity.id ? null : entity.id)}
                      className="group flex items-center gap-2 py-2 -mx-1.5 px-1.5 rounded hover:bg-foreground/[0.03] cursor-pointer w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-expanded={expandedEntity === entity.id}
                    >
                      <span className="text-[13px] font-medium text-foreground/80 truncate flex-1 min-w-0">
                        {entity.name}
                      </span>
                      <span className="font-mono text-[10px] bg-foreground/5 text-foreground/60 px-1.5 py-0.5 rounded-sm shrink-0">
                        {entity.type}
                      </span>
                      <ConfidenceBar confidence={entity.confidence} />
                      <span className="text-[10px] text-foreground/25 shrink-0 w-10 text-right">
                        {formatRelativeTime(entity.lastSeen)}
                      </span>
                    </button>

                    {/* Expanded detail */}
                    {expandedEntity === entity.id && (
                      <div className="pl-4 border-l-2 border-amber-200 dark:border-amber-800 mt-1 mb-2 space-y-1">
                        {entity.domain && (
                          <div className="text-[11px] text-foreground/40">
                            Domain: <span className="text-foreground/60">{entity.domain}</span>
                          </div>
                        )}
                        {entity.properties && Object.keys(entity.properties).length > 0 && (
                          <div className="space-y-0.5">
                            {Object.entries(entity.properties).map(([k, v]) => (
                              <div key={k} className="text-[11px] text-foreground/40">
                                {k}: <span className="text-foreground/60">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {entity.relationships.length > 0 ? (
                          <div className="space-y-0.5 mt-1">
                            <div className="text-[10px] text-foreground/35 uppercase tracking-wider">Relationships</div>
                            {entity.relationships.slice(0, 20).map(rel => (
                              <div key={rel.id} className="text-[11px] text-foreground/50">
                                <span className="text-foreground/40">{rel.relationType}</span>{' \u2192 '}
                                <span className="text-foreground/70">
                                  {rel.sourceEntityId === entity.id ? rel.targetEntityId : rel.sourceEntityId}
                                </span>
                              </div>
                            ))}
                            {entity.relationships.length > 20 && (
                              <div className="text-[10px] text-foreground/30 italic">
                                +{entity.relationships.length - 20} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-foreground/30 italic">No relationships</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
        </TabsContent>

        {/* Patterns tab */}
        <TabsContent value="patterns">
            <div className="max-h-[320px] overflow-y-auto overflow-x-hidden">
              {loading ? (
                <SkeletonRows count={3} />
              ) : error ? (
                <div className="text-[12px] text-destructive">
                  {error} — <button type="button" onClick={loadData} className="underline">retry</button>
                </div>
              ) : patterns.length === 0 ? (
                <p className="text-[11px] text-foreground/30 italic py-4">
                  No patterns detected yet
                </p>
              ) : (
                patterns.map(pattern => (
                  <div key={pattern.id} className="py-2 space-y-1 border-b border-border/30 last:border-0">
                    <p className="text-[13px] text-foreground/70">{pattern.description}</p>
                    <div className="flex items-center gap-2">
                      {pattern.patternType && (
                        <span className="font-mono text-[10px] bg-foreground/5 text-foreground/60 px-1.5 py-0.5 rounded-sm">
                          {pattern.patternType}
                        </span>
                      )}
                      <span className="text-[10px] text-foreground/40">&times;{pattern.occurrenceCount}</span>
                      <ConfidenceBar confidence={pattern.confidence} />
                      <span className="text-[10px] text-foreground/25">
                        {formatRelativeTime(pattern.lastSeen)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history">
          <div className="max-h-[320px] overflow-y-auto overflow-x-hidden">
            {observationPaused && (
              <div className="px-3 py-2 mb-2 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[12px] border border-amber-200 dark:border-amber-800">
                <Pause className="h-3 w-3 inline mr-1.5 -mt-0.5" />
                Observations are paused
              </div>
            )}
            {loading ? (
              <SkeletonRows count={3} />
            ) : observationHistory.length === 0 ? (
              <p className="text-[11px] text-foreground/30 italic py-4">
                No observation runs yet
              </p>
            ) : (
              observationHistory.map((run, i) => {
                const OUTCOME_STYLE: Record<string, string> = {
                  success: 'text-green-600 dark:text-green-400',
                  failure: 'text-red-600 dark:text-red-400',
                  partial: 'text-amber-600 dark:text-amber-400',
                }
                return (
                  <div key={`${run.timestamp}-${i}`} className="py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-foreground/30" />
                        <span className="text-[12px] text-foreground/70">{formatRelativeTime(run.timestamp)}</span>
                        <span className={cn('text-[10px] font-medium', OUTCOME_STYLE[run.outcome] ?? 'text-foreground/40')}>
                          {run.outcome}
                        </span>
                      </div>
                      <span className="text-[10px] text-foreground/30">
                        {run.durationMs > 0 ? `${Math.round(run.durationMs / 1000)}s` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-foreground/40">
                      {run.tokensUsed > 0 && <span>{run.tokensUsed.toLocaleString()} tokens</span>}
                      {run.entitiesAdded > 0 && <span>+{run.entitiesAdded} entities</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
