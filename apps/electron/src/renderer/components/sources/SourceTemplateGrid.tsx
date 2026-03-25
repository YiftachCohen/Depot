import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SourceTemplate } from '@depot/shared/sources'

interface SourceTemplateGridProps {
  templates?: SourceTemplate[]
  connectedSlugs?: string[]
  onSelect: (template: SourceTemplate) => void
  onConnectedClick?: (template: SourceTemplate) => void
}

function SkeletonCard() {
  return (
    <div className="rounded-[10px] border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-full bg-stone-200 animate-pulse dark:bg-stone-700" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-4 w-24 rounded bg-stone-200 animate-pulse dark:bg-stone-700" />
          <div className="h-3 w-36 rounded bg-stone-200 animate-pulse dark:bg-stone-700" />
        </div>
      </div>
    </div>
  )
}

export function SourceTemplateGrid({
  templates,
  connectedSlugs,
  onSelect,
  onConnectedClick,
}: SourceTemplateGridProps) {
  // Loading state
  if (!templates || connectedSlugs === undefined) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  // Empty state
  if (templates.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-stone-500">
          No quick integrations available. Set up custom sources via the chat.
        </p>
      </div>
    )
  }

  const allConnected = templates.every(t =>
    connectedSlugs.includes(t.sourceInput.provider)
  )

  return (
    <div className="space-y-3">
      {allConnected && (
        <div className="flex items-center gap-2 rounded-[8px] bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          <Check className="size-4" />
          All integrations connected
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {templates.map((template) => {
          const isConnected = connectedSlugs.includes(template.sourceInput.provider)
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => isConnected && onConnectedClick ? onConnectedClick(template) : onSelect(template)}
              className={cn(
                'group relative flex items-start gap-3 rounded-[10px] border p-4 text-left transition-all duration-150',
                'bg-stone-50 border-stone-200 dark:bg-stone-900 dark:border-stone-700',
                'hover:-translate-y-px hover:shadow-minimal hover:border-amber-200 dark:hover:border-amber-700',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2',
              )}
            >
              {/* Icon */}
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-lg dark:bg-amber-900/30">
                {template.icon}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <h4 className="text-[16px] font-semibold leading-tight text-stone-900 dark:text-stone-100">
                  {template.name}
                </h4>
                {isConnected ? (
                  <span className="mt-0.5 flex items-center gap-1 text-[13px] font-normal text-green-600 dark:text-green-400">
                    <Check className="size-3.5" />
                    Connected
                  </span>
                ) : (
                  <p className="mt-0.5 truncate text-[13px] font-normal text-stone-500 dark:text-stone-400">
                    {template.tagline}
                  </p>
                )}
              </div>

              {/* Connected badge */}
              {isConnected && (
                <div className="absolute bottom-2 right-2 flex size-4 items-center justify-center rounded-full bg-green-600 text-white">
                  <Check className="size-2.5" strokeWidth={3} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
