/**
 * SourcesStep — "What data should they access?"
 *
 * Suggested sources in a white card, other sources below,
 * discovery at the bottom. Matching the warm stone aesthetic.
 */

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Sparkles, Database, Plus } from 'lucide-react'
import { SourceCard } from '../components/SourceCard'
import { SourceDiscoveryInline } from '../components/SourceDiscoveryInline'
import { useSourceSuggestions } from '../hooks/useSourceSuggestions'
import type { LoadedSource } from '../../../../shared/types'

interface SourcesStepProps {
  workspaceId: string
  sources: LoadedSource[]
  templateCategory: string | null
  agentName: string
  agentDescription: string
  selectedSlugs: Set<string>
  onToggleSource: (slug: string) => void
  onSourceImported: () => void
}

function getSourceStatus(source: LoadedSource): 'connected' | 'needs_auth' | 'disconnected' {
  const status = source.config.connectionStatus
  if (status === 'connected') return 'connected'
  if (status === 'needs_auth') return 'needs_auth'
  return 'disconnected'
}

export function SourcesStep({
  workspaceId,
  sources,
  templateCategory,
  agentName,
  agentDescription,
  selectedSlugs,
  onToggleSource,
  onSourceImported,
}: SourcesStepProps) {
  const suggestions = useSourceSuggestions(
    templateCategory ?? undefined,
    agentName,
    agentDescription,
    sources,
  )

  const suggestedSlugs = useMemo(
    () => new Set(suggestions.map(s => s.slug)),
    [suggestions],
  )

  const otherSources = useMemo(
    () => sources.filter(s => !suggestedSlugs.has(s.config.name)),
    [sources, suggestedSlugs],
  )

  const hasAnySuggestions = suggestions.length > 0
  const hasOtherSources = otherSources.length > 0
  const selectedCount = selectedSlugs.size

  return (
    <div className="space-y-5">
      {/* Selection summary */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <div className="h-6 px-3 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold flex items-center gap-1.5">
            <Database className="h-3 w-3" />
            {selectedCount} source{selectedCount !== 1 ? 's' : ''} selected
          </div>
        </div>
      )}

      {/* Suggested Sources — white card */}
      {hasAnySuggestions && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-thin overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-stone-700">Suggested for you</span>
            <span className="ml-auto text-[10px] text-stone-400">{suggestions.length} sources</span>
          </div>
          <div className="p-2 space-y-1.5">
            {suggestions.map((suggestion) => {
              const wsSource = suggestion.source ?? sources.find(s => s.config.name === suggestion.slug)
              return (
                <SourceCard
                  key={suggestion.slug}
                  name={suggestion.slug}
                  provider={wsSource?.config.provider}
                  type={wsSource?.config.type}
                  status={wsSource ? getSourceStatus(wsSource) : 'suggested'}
                  selected={selectedSlugs.has(suggestion.slug)}
                  onToggle={() => onToggleSource(suggestion.slug)}
                  source={wsSource}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Other workspace sources */}
      {hasOtherSources && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-thin overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100">
            <span className="text-xs font-semibold text-stone-700">Your Sources</span>
          </div>
          <div className="p-2 space-y-1.5">
            {otherSources.map((src) => (
              <SourceCard
                key={src.config.name}
                name={src.config.name}
                provider={src.config.provider}
                type={src.config.type}
                status={getSourceStatus(src)}
                selected={selectedSlugs.has(src.config.name)}
                onToggle={() => onToggleSource(src.config.name)}
                source={src}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasAnySuggestions && !hasOtherSources && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-thin py-10 text-center">
          <Database className="h-8 w-8 text-stone-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-stone-500">No data sources yet</p>
          <p className="text-xs text-stone-400 mt-1">
            You can connect them later from the agent settings
          </p>
        </div>
      )}

      {/* Skip hint */}
      {!hasAnySuggestions && !hasOtherSources && (
        <p className="text-center text-[11px] text-stone-400">
          Sources are optional — you can always add them later
        </p>
      )}

      {/* Connect New — visually recessed */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Plus className="h-3.5 w-3.5 text-stone-400" />
          <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Discover New</span>
        </div>
        <SourceDiscoveryInline
          workspaceId={workspaceId}
          onImported={onSourceImported}
        />
      </div>
    </div>
  )
}
