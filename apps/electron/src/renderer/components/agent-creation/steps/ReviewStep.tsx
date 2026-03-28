/**
 * ReviewStep — "Meet your new agent"
 *
 * Live preview card, editable commands, advanced settings, Create button.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, AlertTriangle, Loader2, Check } from 'lucide-react'
import { AgentPreviewCard } from '../components/AgentPreviewCard'
import { CommandEditor } from '../components/CommandEditor'
import type { QuickCommand, LoadedSource } from '../../../../shared/types'

interface ReviewStepProps {
  name: string
  description: string
  icon: string
  sourceSlugs: string[]
  sources: LoadedSource[]
  commands: QuickCommand[]
  onCommandsChange: (commands: QuickCommand[]) => void
  permissionMode: 'safe' | 'ask' | 'allow-all'
  onPermissionModeChange: (mode: 'safe' | 'ask' | 'allow-all') => void
  memoryEnabled: boolean
  onMemoryEnabledChange: (enabled: boolean) => void
  creating: boolean
  onCreateAgent: () => void
}

export function ReviewStep({
  name,
  description,
  icon,
  sourceSlugs,
  sources,
  commands,
  onCommandsChange,
  permissionMode,
  onPermissionModeChange,
  memoryEnabled,
  onMemoryEnabledChange,
  creating,
  onCreateAgent,
}: ReviewStepProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Count sources that need auth
  const needsAuthCount = sourceSlugs.filter(slug => {
    const source = sources.find(s => s.config.name === slug)
    return source?.config.connectionStatus === 'needs_auth'
  }).length

  return (
    <div className="space-y-6">
      {/* Live preview */}
      <AgentPreviewCard
        name={name}
        description={description}
        icon={icon}
        sourceSlugs={sourceSlugs}
        commands={commands}
        needsAuthCount={needsAuthCount}
      />

      {/* Auth warning banner */}
      {needsAuthCount > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200/60">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-800">
              {needsAuthCount} source{needsAuthCount !== 1 ? 's' : ''} need{needsAuthCount === 1 ? 's' : ''} authentication
            </p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              Your agent will be limited until you authenticate them from the dashboard.
            </p>
          </div>
        </div>
      )}

      {/* Quick Commands */}
      <div>
        <h3 className="text-xs font-semibold text-foreground mb-3">Quick Commands</h3>
        <CommandEditor commands={commands} onChange={onCommandsChange} />
      </div>

      {/* Advanced settings (collapsed) */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Advanced Settings
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-3 pl-4 border-l-2 border-border/30">
            {/* Permission Mode */}
            <div>
              <label className="text-[10px] text-foreground/50 mb-1.5 block">Permission Mode</label>
              <div className="flex items-center gap-2">
                {(['safe', 'ask', 'allow-all'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onPermissionModeChange(mode)}
                    className={cn(
                      'h-7 px-3 text-xs font-medium rounded-full transition-colors',
                      permissionMode === mode
                        ? 'bg-foreground text-background'
                        : 'bg-foreground/[0.05] text-foreground/60 hover:bg-foreground/[0.08]',
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Memory */}
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-foreground/50">Cross-session memory</label>
              <button
                type="button"
                onClick={() => onMemoryEnabledChange(!memoryEnabled)}
                className={cn(
                  'h-5 w-9 rounded-full transition-colors relative',
                  memoryEnabled ? 'bg-amber-600' : 'bg-stone-300',
                )}
              >
                <div className={cn(
                  'h-4 w-4 rounded-full bg-white absolute top-0.5 transition-transform',
                  memoryEnabled ? 'translate-x-4' : 'translate-x-0.5',
                )} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create button */}
      <button
        type="button"
        onClick={onCreateAgent}
        disabled={creating || !name.trim() || commands.length === 0}
        className={cn(
          'w-full h-11 rounded-xl text-sm font-semibold transition-all',
          'bg-amber-600 text-white hover:bg-amber-700',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'flex items-center justify-center gap-2',
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
  )
}
