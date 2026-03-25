/**
 * AgentPromptBar — "Ask {agent} anything..." input with quick command chips.
 *
 * The page's primary affordance: talk to the agent without navigating away.
 * Placeholder rotates through contextual suggestions to feel alive.
 */
import * as React from 'react'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCommandIcon } from '@/lib/command-icon'
import type { LoadedSkill, QuickCommand } from '../../../../shared/types'

interface AgentPromptBarProps {
  skill: LoadedSkill
  onSubmitPrompt: (prompt: string) => void
  onQuickCommand: (skill: LoadedSkill, cmd: QuickCommand) => void
}

export function AgentPromptBar({ skill, onSubmitPrompt, onQuickCommand }: AgentPromptBarProps) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cmds = skill.manifest?.quick_commands ?? []

  // Build rotating placeholders from agent context
  const placeholders = useMemo(() => {
    const name = skill.metadata.name
    const hints = [`Ask ${name} anything...`]
    for (const cmd of cmds.slice(0, 3)) {
      hints.push(`Try "${cmd.name}"...`)
    }
    if (skill.manifest?.knowledge?.enabled) {
      hints.push(`Ask ${name} what it's learned...`)
    }
    if (skill.manifest?.personality) {
      hints.push(`Chat with ${name}...`)
    }
    return hints
  }, [skill.metadata.name, cmds, skill.manifest?.knowledge?.enabled, skill.manifest?.personality])

  // Rotate placeholder text
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [placeholderOpacity, setPlaceholderOpacity] = useState(1)

  useEffect(() => {
    if (placeholders.length <= 1 || value) return
    const interval = setInterval(() => {
      setPlaceholderOpacity(0)
      setTimeout(() => {
        setPlaceholderIndex((i) => (i + 1) % placeholders.length)
        setPlaceholderOpacity(1)
      }, 400)
    }, 5500)
    return () => clearInterval(interval)
  }, [placeholders.length, value])

  const currentPlaceholder = placeholders[placeholderIndex % placeholders.length] ?? ''

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmitPrompt(trimmed)
    setValue('')
  }, [value, onSubmitPrompt])

  return (
    <div className={cn(
      'rounded-xl border bg-background transition-all',
      focused
        ? 'border-foreground/20 shadow-minimal'
        : 'border-border/40 hover:border-border/60',
    )}>
      {/* Input row with animated placeholder */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 relative">
        {/* Custom animated placeholder (shown when input is empty) */}
        {!value && (
          <div
            className="absolute inset-0 flex items-center px-3.5 pointer-events-none text-[13px] text-foreground/30 transition-opacity duration-500 ease-in-out"
            style={{ opacity: placeholderOpacity }}
          >
            {currentPlaceholder}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
          className="flex-1 bg-transparent text-[13px] text-foreground focus:outline-none relative z-10"
          aria-label={`Send a message to ${skill.metadata.name}`}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className={cn(
            'h-7 w-7 rounded-lg flex items-center justify-center transition-all shrink-0 relative z-10',
            value.trim()
              ? 'bg-foreground text-background cursor-pointer hover:bg-foreground/90'
              : 'bg-foreground/[0.06] text-foreground/20 cursor-default',
          )}
          aria-label="Send message"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Quick command chips */}
      {cmds.length > 0 && (
        <div className="flex items-center gap-1.5 px-3.5 pb-2.5 flex-wrap">
          {cmds.map((cmd) => (
            <button
              key={cmd.name}
              type="button"
              onClick={() => onQuickCommand(skill, cmd)}
              className={cn(
                'inline-flex items-center gap-1 text-[11px] text-foreground/50',
                'rounded-md px-2 py-1 border border-border/40 bg-foreground/[0.02]',
                'hover:bg-foreground/[0.06] hover:text-foreground/70 hover:border-foreground/15',
                'transition-colors cursor-pointer',
              )}
            >
              {getCommandIcon(cmd.name, 'h-3 w-3 opacity-60 shrink-0', cmd.icon)}
              <span className="truncate max-w-[120px]">{cmd.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
