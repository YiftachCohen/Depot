/**
 * SourceCard — clickable card for toggling source selection.
 * Uses the real SourceAvatar for proper icons (local files, favicons, fallbacks).
 */

import { cn } from '@/lib/utils'
import { Globe, AlertCircle } from 'lucide-react'
import { SourceAvatar } from '@/components/ui/source-avatar'
import type { LoadedSource } from '../../../../shared/types'

interface SourceCardProps {
  name: string
  provider?: string
  type?: 'mcp' | 'api' | 'local'
  status?: 'connected' | 'needs_auth' | 'disconnected' | 'suggested'
  selected: boolean
  onToggle: () => void
  error?: string
  /** Pass the full LoadedSource for real icon rendering */
  source?: LoadedSource
}

export function SourceCard({
  name,
  provider,
  type,
  status = 'disconnected',
  selected,
  onToggle,
  error,
  source,
}: SourceCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-left transition-all',
        'border',
        selected
          ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400/20'
          : 'bg-white border-stone-200/80 hover:border-stone-300 hover:shadow-thin',
      )}
    >
      {/* Source icon — real avatar or fallback */}
      <div className="relative shrink-0">
        {source ? (
          <SourceAvatar source={source} size="sm" />
        ) : (
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-stone-100">
            <Globe className="h-4 w-4 text-stone-400" />
          </div>
        )}
        {/* Status dot overlay */}
        {(status === 'connected' || status === 'needs_auth') && (
          <div className={cn(
            'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white',
            status === 'connected' ? 'bg-green-500' : 'bg-amber-500',
          )} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-[13px] font-medium truncate', selected ? 'text-amber-900' : 'text-stone-700')}>
            {name}
          </span>
          {type && (
            <span className="shrink-0 inline-flex items-center h-[16px] px-1 text-[9px] font-medium rounded bg-stone-100 text-stone-400">
              {type}
            </span>
          )}
          {status === 'needs_auth' && (
            <span className="shrink-0 h-[16px] px-1.5 text-[9px] font-medium rounded bg-amber-100 text-amber-600">
              needs auth
            </span>
          )}
        </div>
        {provider && (
          <p className="text-[11px] text-stone-400 mt-0.5 truncate">{provider}</p>
        )}
        {error && (
          <div className="flex items-center gap-1 mt-1 text-red-500">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="text-[10px]">{error}</span>
          </div>
        )}
      </div>

      {/* Checkbox */}
      <div className={cn(
        'h-5 w-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors',
        selected ? 'border-amber-600 bg-amber-600' : 'border-stone-300',
      )}>
        {selected && (
          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </button>
  )
}
