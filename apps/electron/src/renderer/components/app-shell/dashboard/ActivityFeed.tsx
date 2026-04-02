/**
 * ActivityFeed — compact recent activity list with deduplication.
 * Groups consecutive same-name sessions to avoid "7x Hourly Flight Check" noise.
 */
import { motion } from 'motion/react'
import { useMemo } from 'react'
import { fadeIn, getAccentColor, formatRelativeTime } from './utils'
import type { LoadedSkill } from '../../../../shared/types'

interface ActivityFeedSession {
  id: string
  name?: string
  skillSlug?: string
  lastMessageAt?: number
}

interface ActivityFeedProps {
  sessions: ActivityFeedSession[]
  skillMap: Map<string, LoadedSkill>
  onNavigate: (skillSlug: string, sessionId: string) => void
}

interface GroupedEntry {
  session: ActivityFeedSession
  count: number
}

export function ActivityFeed({ sessions, skillMap, onNavigate }: ActivityFeedProps) {
  // Group consecutive same-name entries from the same agent
  const grouped = useMemo(() => {
    const result: GroupedEntry[] = []
    for (const session of sessions) {
      const prev = result[result.length - 1]
      if (prev && prev.session.name === session.name && prev.session.skillSlug === session.skillSlug) {
        prev.count++
      } else {
        result.push({ session, count: 1 })
      }
    }
    return result
  }, [sessions])

  if (grouped.length === 0) {
    return (
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="pt-2">
        <nav aria-label="Recent activity">
          <div className="border-t border-border/20 pt-4 mb-2" />
          <h3 className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-widest mb-3">
            Recent Activity
          </h3>
          <p className="text-[13px] text-muted-foreground/40 leading-relaxed">
            Your agents are ready — run a quick command above to get started.
          </p>
        </nav>
      </motion.div>
    )
  }

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible" className="pt-2">
      <nav aria-label="Recent activity">
        <div className="border-t border-border/20 pt-4 mb-2" />
        <h3 className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-widest mb-2">
          Recent Activity
        </h3>
        <div className="space-y-0">
          {grouped.map(({ session, count }) => {
            const sk = session.skillSlug ? skillMap.get(session.skillSlug) : null
            const accent = session.skillSlug ? getAccentColor(session.skillSlug, sk?.manifest?.color) : '#78716C'

            return (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  if (session.skillSlug) onNavigate(session.skillSlug, session.id)
                }}
                className="w-full flex items-center gap-3 py-1.5 text-left hover:text-foreground transition-colors cursor-pointer group/recent"
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                {sk && (
                  <span className="shrink-0 text-[10px] text-muted-foreground/50 w-24 truncate">
                    {sk.metadata.name}
                  </span>
                )}
                <span className="flex-1 min-w-0 text-[13px] text-foreground/70 truncate group-hover/recent:text-foreground transition-colors">
                  {session.name || 'Untitled'}
                  {count > 1 && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground/35 font-mono">×{count}</span>
                  )}
                </span>
                {session.lastMessageAt && (
                  <span className="shrink-0 text-[10px] text-muted-foreground/35">
                    {formatRelativeTime(session.lastMessageAt)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </motion.div>
  )
}
