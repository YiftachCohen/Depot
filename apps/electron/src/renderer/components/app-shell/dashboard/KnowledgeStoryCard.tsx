/**
 * KnowledgeStoryCard — Narrative knowledge summary for knowledge-enabled agents.
 *
 * Shows stat pills, latest entities, top patterns, and a "Browse All"
 * that expands inline to the full KnowledgeBrowserPanel.
 */
import * as React from 'react'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Database, ChevronDown, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { KnowledgeBrowserPanel } from '../KnowledgeBrowserPanel'
import type { KnowledgeStatsData } from './types'

// ---------------------------------------------------------------------------
// Types for entities/patterns fetched from RPC
// ---------------------------------------------------------------------------
interface KnowledgeEntitySummary {
  id: string
  name: string
  type: string
  confidence: number
  lastSeen: number
  domain: string
  archived?: boolean
}

interface KnowledgePatternSummary {
  id: string
  description: string
  patternType?: string
  occurrenceCount: number
  confidence: number
  lastSeen: number
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function StorySkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-6 w-20 rounded-full bg-foreground/[0.06]" />
        ))}
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="h-4 w-full rounded bg-foreground/[0.04]" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat Pill
// ---------------------------------------------------------------------------
function StatPill({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/[0.04] text-[11px] text-foreground/55">
      <span className="font-medium text-foreground/70">{count.toLocaleString()}</span>
      <span>{label}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Confidence bar (matches KnowledgeBrowserPanel)
// ---------------------------------------------------------------------------
function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  return (
    <div
      className="h-1 w-12 rounded-full bg-stone-200 dark:bg-stone-700"
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface KnowledgeStoryCardProps {
  workspaceId: string
  skillSlug: string
  knowledgeStats: KnowledgeStatsData | undefined
  reducedMotion: boolean
}

export function KnowledgeStoryCard({
  workspaceId,
  skillSlug,
  knowledgeStats,
  reducedMotion,
}: KnowledgeStoryCardProps) {
  const [entities, setEntities] = useState<KnowledgeEntitySummary[]>([])
  const [patterns, setPatterns] = useState<KnowledgePatternSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [browsing, setBrowsing] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [entityResult, patternResult] = await Promise.all([
        window.electronAPI.queryKnowledgeEntities(workspaceId, skillSlug),
        window.electronAPI.queryKnowledgePatterns(workspaceId, skillSlug),
      ])
      setEntities((entityResult ?? []).filter((e: KnowledgeEntitySummary) => !e.archived))
      setPatterns(patternResult ?? [])
    } catch {
      setError('Knowledge unavailable')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, skillSlug])

  useEffect(() => { loadData() }, [loadData])

  // Latest 5 entities by lastSeen
  const latestEntities = useMemo(
    () => [...entities].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 5),
    [entities],
  )

  // Top 3 patterns by occurrence
  const topPatterns = useMemo(
    () => [...patterns].sort((a, b) => b.occurrenceCount - a.occurrenceCount).slice(0, 3),
    [patterns],
  )

  return (
    <div className="rounded-xl border border-border/40 bg-background overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-widest inline-flex items-center gap-1.5">
            <Database className="h-3 w-3" />
            What I Know
          </h3>
        </div>

        {loading ? (
          <StorySkeleton />
        ) : error ? (
          <div className="text-[12px] text-destructive">
            {error} — <button type="button" onClick={loadData} className="underline cursor-pointer">retry</button>
          </div>
        ) : entities.length === 0 && patterns.length === 0 ? (
          <p className="text-[12px] text-foreground/35 italic">
            No knowledge yet — run an observation to start learning.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Stat Pills */}
            {knowledgeStats && (
              <div className="flex flex-wrap gap-1.5">
                <StatPill label="entities" count={knowledgeStats.entityCount} />
                <StatPill label="relationships" count={knowledgeStats.relationshipCount} />
                <StatPill label="patterns" count={knowledgeStats.patternCount} />
              </div>
            )}

            {/* Latest Discoveries */}
            {latestEntities.length > 0 && (
              <div>
                <h4 className="text-[10px] font-medium text-foreground/35 uppercase tracking-wider mb-1.5">Latest Discoveries</h4>
                <div className="space-y-1">
                  {latestEntities.map(entity => (
                    <div key={entity.id} className="flex items-center gap-2 text-[12px]">
                      <span className="text-foreground/70 truncate flex-1 min-w-0">{entity.name}</span>
                      <span className="font-mono text-[9px] bg-foreground/5 text-foreground/50 px-1 py-0.5 rounded-sm shrink-0">
                        {entity.type}
                      </span>
                      <ConfidenceBar confidence={entity.confidence} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Patterns Detected */}
            {topPatterns.length > 0 && (
              <div>
                <h4 className="text-[10px] font-medium text-foreground/35 uppercase tracking-wider mb-1.5">Patterns Detected</h4>
                <div className="space-y-1">
                  {topPatterns.map(pattern => (
                    <div key={pattern.id} className="flex items-center gap-2 text-[12px]">
                      <span className="text-foreground/60 truncate flex-1 min-w-0">{pattern.description}</span>
                      {pattern.patternType && (
                        <span className="font-mono text-[9px] bg-foreground/5 text-foreground/50 px-1 py-0.5 rounded-sm shrink-0">
                          {pattern.patternType}
                        </span>
                      )}
                      <span className="text-[10px] text-foreground/35 shrink-0">&times;{pattern.occurrenceCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Browse All — expand inline */}
      {!loading && !error && (entities.length > 0 || patterns.length > 0) && (
        <>
          <button
            type="button"
            onClick={() => setBrowsing(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-[11px] text-foreground/45 hover:text-foreground/70 hover:bg-foreground/[0.03] transition-colors border-t border-border/30 cursor-pointer"
            aria-expanded={browsing}
          >
            Browse All
            <ChevronDown className={cn('h-3 w-3 transition-transform', browsing && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {browsing && (
              <motion.div
                initial={reducedMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
                animate={reducedMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden border-t border-border/30"
              >
                <div className="p-4">
                  <KnowledgeBrowserPanel
                    workspaceId={workspaceId}
                    skillSlug={skillSlug}
                    onBack={() => setBrowsing(false)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
