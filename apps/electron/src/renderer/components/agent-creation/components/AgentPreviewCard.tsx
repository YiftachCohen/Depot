/**
 * AgentPreviewCard — live preview of the agent as it will appear on the dashboard.
 * Updates on every form field change.
 */

import { cn } from '@/lib/utils'
import { resolveIconComponent } from '@/lib/command-icon'
import type { QuickCommand } from '../../../../shared/types'

interface AgentPreviewCardProps {
  name: string
  description: string
  icon: string
  sourceSlugs: string[]
  commands: QuickCommand[]
  needsAuthCount: number
}

export function AgentPreviewCard({
  name,
  description,
  icon,
  sourceSlugs,
  commands,
  needsAuthCount,
}: AgentPreviewCardProps) {
  const IconComp = resolveIconComponent(icon)

  return (
    <div className={cn(
      'rounded-xl border border-border/60 bg-foreground/[0.01] p-5 space-y-4',
      'shadow-sm',
    )}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-amber-100 shrink-0">
          <IconComp className="h-5 w-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {name || 'Untitled Agent'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {description || 'No description yet'}
          </p>
        </div>
      </div>

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
    </div>
  )
}
