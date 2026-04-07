/**
 * CommandEditor — add/edit/remove quick commands with variable support.
 */

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { resolveIconComponent } from '@/lib/command-icon'
import type { QuickCommand } from '../../../../shared/types'

interface CommandEditorProps {
  commands: QuickCommand[]
  onChange: (commands: QuickCommand[]) => void
}

export function CommandEditor({ commands, onChange }: CommandEditorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const handleUpdate = useCallback((index: number, updates: Partial<QuickCommand>) => {
    const next = [...commands]
    const existing = next[index]
    if (existing) {
      next[index] = { ...existing, ...updates }
      onChange(next)
    }
  }, [commands, onChange])

  const handleRemove = useCallback((index: number) => {
    onChange(commands.filter((_, i) => i !== index))
    if (expandedIndex === index) setExpandedIndex(null)
  }, [commands, onChange, expandedIndex])

  const handleAdd = useCallback(() => {
    const newCmd: QuickCommand = {
      name: 'New Command',
      prompt: 'Enter your prompt here...',
      icon: 'zap',
    }
    onChange([...commands, newCmd])
    setExpandedIndex(commands.length)
  }, [commands, onChange])

  return (
    <div className="space-y-2">
      {commands.map((cmd, i) => {
        const CmdIcon = resolveIconComponent(cmd.icon)
        const isExpanded = expandedIndex === i

        return (
          <div
            key={i}
            className={cn(
              'rounded-xl border transition-all',
              isExpanded ? 'border-amber-300 bg-amber-50/30' : 'border-border/40 bg-foreground/[0.02]',
            )}
          >
            {/* Collapsed row */}
            <button
              type="button"
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left"
            >
              <GripVertical className="h-3 w-3 text-foreground/20 shrink-0" />
              <CmdIcon className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
              <span className="flex-1 text-xs font-medium text-foreground truncate">{cmd.name}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(i) }}
                className="p-1 rounded hover:bg-foreground/[0.05] transition-colors"
                aria-label={`Remove ${cmd.name}`}
              >
                <Trash2 className="h-3 w-3 text-foreground/30 hover:text-destructive" />
              </button>
            </button>

            {/* Expanded editor */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2 border-t border-border/30">
                <div className="pt-2">
                  <label className="text-[10px] text-foreground/50 mb-1 block">Name</label>
                  <input
                    type="text"
                    value={cmd.name}
                    onChange={(e) => handleUpdate(i, { name: e.target.value })}
                    className={cn(
                      'w-full h-8 px-2.5 text-xs rounded-md',
                      'bg-background border border-border/60',
                      'focus:outline-none focus:ring-1 focus:ring-ring',
                    )}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-foreground/50 mb-1 block">
                    Prompt <span className="text-foreground/30">(use {'{{variable}}'} for inputs)</span>
                  </label>
                  <textarea
                    value={cmd.prompt}
                    onChange={(e) => handleUpdate(i, { prompt: e.target.value })}
                    rows={2}
                    className={cn(
                      'w-full px-2.5 py-2 text-xs rounded-md resize-none',
                      'bg-background border border-border/60',
                      'focus:outline-none focus:ring-1 focus:ring-ring',
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={handleAdd}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-left transition-colors',
          'border border-dashed border-border/60 hover:bg-foreground/[0.03]',
          'text-xs text-muted-foreground hover:text-foreground',
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Add command
      </button>
    </div>
  )
}
