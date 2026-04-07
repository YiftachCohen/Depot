/**
 * IconPicker — curated subset of ~100 role-relevant Lucide icons
 * displayed in a searchable grid.
 */

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import { ICON_NAME_MAP, resolveIconComponent } from '@/lib/command-icon'

// Curated subset of role-relevant icons for agent avatars
const CURATED_ICONS = [
  'bot', 'zap', 'rocket', 'shield', 'search', 'eye', 'wrench', 'settings',
  'code-2', 'terminal', 'database', 'server', 'globe', 'layers', 'sparkles',
  'git-pull-request', 'bug', 'hammer', 'flask-conical', 'bar-chart-3',
  'circle-check', 'package-plus', 'alert-triangle', 'message-square',
  'file-code', 'book-open', 'folder-kanban', 'git-compare', 'file-text',
  'list-ordered', 'clipboard-check', 'pie-chart', 'route', 'scan-search',
  'scroll-text', 'clock', 'activity', 'siren', 'megaphone', 'file-clock',
  'gantt-chart', 'calendar-range', 'list-tree', 'file-bar-chart',
  'shield-alert', 'layout-dashboard', 'map', 'notebook-pen', 'list-checks',
  'mail', 'calendar-check', 'message-square-heart', 'trending-up',
  'lightbulb', 'briefcase', 'telescope', 'swords', 'scale',
  'target', 'pen-tool', 'user-check', 'graduation-cap', 'heart-handshake',
  'presentation', 'receipt', 'building-2', 'phone', 'bar-chart-2',
  'share-2', 'layout', 'users', 'award', 'calendar', 'book-marked',
  'hash', 'bar-chart', 'check-circle', 'refresh-cw', 'file', 'plus',
  'file-plus',
] as const

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [search, setSearch] = useState('')

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return [...CURATED_ICONS]
    const q = search.trim().toLowerCase()
    return CURATED_ICONS.filter(name => name.includes(q))
  }, [search])

  return (
    <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3 space-y-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            'w-full h-7 pl-7 pr-2 text-xs rounded-md',
            'bg-background border border-border/60',
            'placeholder:text-muted-foreground/60',
            'focus:outline-none focus:ring-1 focus:ring-ring',
          )}
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-8 gap-1 max-h-[200px] overflow-y-auto">
        {filteredIcons.map((name) => {
          const Icon = ICON_NAME_MAP[name] ?? resolveIconComponent(name)
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              aria-label={`Select icon ${name}`}
              title={name}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-md transition-colors cursor-pointer',
                value === name
                  ? 'bg-amber-600 text-white'
                  : 'hover:bg-foreground/[0.08] text-foreground/70',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>

      {filteredIcons.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          No icons matching "{search}"
        </p>
      )}
    </div>
  )
}
