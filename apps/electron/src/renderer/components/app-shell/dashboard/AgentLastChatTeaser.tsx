/**
 * AgentLastChatTeaser — "Still here" signal showing the most recent session.
 *
 * Uses only metadata (no expensive message loading). A whisper, not a shout.
 */
import * as React from 'react'
import { MessageSquare, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navigate, routes } from '@/lib/navigate'
import { formatRelativeTime } from './utils'

interface AgentLastChatTeaserProps {
  skillSlug: string
  session: {
    id: string
    name?: string
    lastMessageAt?: number
    messageCount?: number
  }
}

export function AgentLastChatTeaser({ skillSlug, session }: AgentLastChatTeaserProps) {
  const name = session.name || 'Untitled conversation'
  const time = session.lastMessageAt ? formatRelativeTime(session.lastMessageAt) : null
  const count = session.messageCount

  return (
    <button
      type="button"
      onClick={() => navigate(routes.view.skills(skillSlug, session.id))}
      className={cn(
        'w-full rounded-lg',
        'py-2 text-left',
        'hover:bg-foreground/[0.03] transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      )}
      aria-label={`Continue conversation: ${name}`}
    >
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <MessageSquare className="h-3.5 w-3.5 text-blue-500/70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-foreground/60 truncate">
            {name}
          </div>
          <div className="text-[10px] text-foreground/30 mt-0.5">
            {[time, count != null && count > 0 ? `${count} messages` : null].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-foreground/40 shrink-0">
          <span>Continue</span>
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </button>
  )
}
