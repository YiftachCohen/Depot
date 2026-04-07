/**
 * AgentPreviewCard — live preview of the agent as it will appear on the dashboard.
 * Updates on every form field change. Shows completeness, personality, and a create button.
 */

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { resolveIconComponent } from '@/lib/command-icon'
import { Loader2, Check } from 'lucide-react'
import { CATEGORY_COLORS, DEFAULT_CAT, PERSONALITY_PRESETS } from '../constants'
import type { QuickCommand } from '../../../../shared/types'

interface AgentPreviewCardProps {
  name: string
  description: string
  icon: string
  personality: string
  templateCategory: string | null
  sourceSlugs: string[]
  commands: QuickCommand[]
  needsAuthCount: number
  creating: boolean
  onCreateAgent: () => void
}

export const AgentPreviewCard = React.memo(function AgentPreviewCard({
  name,
  description,
  icon,
  personality,
  templateCategory,
  sourceSlugs,
  commands,
  needsAuthCount,
  creating,
  onCreateAgent,
}: AgentPreviewCardProps) {
  const IconComp = resolveIconComponent(icon)
  const catColor = (templateCategory && CATEGORY_COLORS[templateCategory]) || DEFAULT_CAT

  const personalityLabel = useMemo(() => {
    if (!personality) return null
    const preset = PERSONALITY_PRESETS.find(p => p.value === personality)
    return preset?.label ?? null
  }, [personality])

  // Completeness sections
  const sections = useMemo(() => [
    { label: 'Name', filled: !!name.trim() },
    { label: 'Description', filled: !!description.trim() },
    { label: 'Personality', filled: !!personality },
    { label: 'Sources', filled: sourceSlugs.length > 0 },
    { label: 'Commands', filled: commands.length > 0 },
  ], [name, description, personality, sourceSlugs.length, commands.length])

  const filledCount = sections.filter(s => s.filled).length
  const canCreate = !!name.trim() && commands.length > 0

  return (
    <div className={cn(
      'rounded-xl border border-border/60 bg-foreground/[0.01] overflow-hidden',
      'shadow-thin flex flex-col',
    )}>
      {/* Colored gradient header — uses category bg color */}
      <div className={cn(
        'relative h-24 flex items-center justify-center',
        catColor.bg,
      )}>
        <div className={cn(
          'flex items-center justify-center h-14 w-14 rounded-2xl shadow-thin',
          catColor.bg,
          'border border-white/60',
        )}>
          <IconComp className={cn('h-7 w-7', catColor.icon)} />
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4 flex-1 flex flex-col">
        {/* Name & description */}
        <div className="text-center">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {name || 'Untitled Agent'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {description || 'No description yet'}
          </p>
        </div>

        {/* Personality badge */}
        {personalityLabel && (
          <div className="flex justify-center">
            <span className="inline-flex items-center h-[22px] px-2.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
              {personalityLabel}
            </span>
          </div>
        )}

        {/* Sources */}
        {sourceSlugs.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {sourceSlugs.map(slug => (
              <span key={slug} className="inline-flex items-center h-[22px] px-2 text-[10px] font-medium rounded-full bg-foreground/[0.05] text-foreground/60">
                {slug}
              </span>
            ))}
          </div>
        )}

        {/* Auth warning */}
        {needsAuthCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200/60">
            <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-xs text-amber-700">
              {needsAuthCount} source{needsAuthCount !== 1 ? 's' : ''} need{needsAuthCount === 1 ? 's' : ''} authentication
            </span>
          </div>
        )}

        {/* Commands preview */}
        {commands.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Quick Commands
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {commands.slice(0, 4).map((cmd, i) => {
                const CmdIcon = resolveIconComponent(cmd.icon)
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg bg-foreground/[0.04] text-foreground/60"
                  >
                    <CmdIcon className="h-3 w-3" />
                    {cmd.name}
                  </span>
                )
              })}
              {commands.length > 4 && (
                <span className="text-[10px] text-muted-foreground">
                  +{commands.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Completeness indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Completeness
            </p>
            <span className="text-[10px] text-muted-foreground">
              {filledCount}/{sections.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {sections.map(section => (
              <div key={section.label} className="flex flex-col items-center gap-1 flex-1">
                <div className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  section.filled ? 'bg-green-500' : 'bg-stone-200',
                )} />
                <span className="text-[9px] text-muted-foreground leading-none">
                  {section.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Spacer to push button to bottom */}
        <div className="flex-1" />

        {/* Create Agent button */}
        <button
          type="button"
          disabled={creating || !canCreate}
          onClick={onCreateAgent}
          className={cn(
            'w-full h-10 rounded-lg text-sm font-semibold transition-colors',
            'flex items-center justify-center gap-2',
            canCreate && !creating
              ? 'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800'
              : 'bg-stone-100 text-stone-400 cursor-not-allowed',
          )}
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Create Agent
            </>
          )}
        </button>
      </div>
    </div>
  )
})
