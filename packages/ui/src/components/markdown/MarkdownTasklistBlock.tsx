/**
 * MarkdownTasklistBlock - Rich task list renderer for ```tasklist code blocks
 *
 * Renders structured JSON as a beautiful task list with priority colors,
 * due date badges, labels, grouping, and completion status.
 *
 * Expected JSON shape:
 * {
 *   "title": "Today's Tasks",
 *   "groups": [
 *     {
 *       "name": "Work",
 *       "tasks": [
 *         {
 *           "title": "Deploy across regions",
 *           "due": "2026-03-03",
 *           "priority": 2,
 *           "done": false,
 *           "labels": ["deploy"],
 *           "description": "Push to all AWS regions"
 *         }
 *       ]
 *     }
 *   ],
 *   "tasks": [
 *     { "title": "Ungrouped task", "due": "2026-03-05", "priority": 1, "done": true }
 *   ]
 * }
 *
 * Priority levels: 1=urgent (red), 2=high (amber), 3=medium (blue), 4=normal (muted)
 * Falls back to CodeBlock if JSON parsing fails.
 */

import * as React from 'react'
import { Check, ChevronRight, Circle, Maximize2, ListChecks } from 'lucide-react'
import { cn } from '../../lib/utils'
import { CodeBlock } from './CodeBlock'
import { PreviewOverlay } from '../overlay/PreviewOverlay'

// ── Types ────────────────────────────────────────────────────────────────────

interface Task {
  title: string
  due?: string
  priority?: 1 | 2 | 3 | 4
  done?: boolean
  labels?: string[]
  description?: string
}

interface TaskGroup {
  name: string
  tasks: Task[]
}

interface TasklistData {
  title?: string
  groups?: TaskGroup[]
  tasks?: Task[]
}

// ── Priority styling ─────────────────────────────────────────────────────────

const PRIORITY_CIRCLE: Record<number, string> = {
  1: 'text-destructive',             // urgent — red
  2: 'text-[oklch(0.7_0.15_55)]',    // high — orange
  3: 'text-[oklch(0.65_0.15_250)]',  // medium — blue
  4: 'text-muted-foreground/30',     // normal — grey
}

const PRIORITY_BORDER: Record<number, string> = {
  1: 'border-l-destructive',
  2: 'border-l-info',
  3: 'border-l-[oklch(0.65_0.15_250)]',
  4: 'border-l-transparent',
}

// ── Date formatting ──────────────────────────────────────────────────────────

function formatDueDate(dateStr: string): { text: string; className: string } {
  const date = new Date(dateStr + 'T00:00:00')
  if (isNaN(date.getTime())) return { text: dateStr, className: 'text-muted-foreground' }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, className: 'text-destructive' }
  if (diffDays === 0) return { text: 'Today', className: 'text-info' }
  if (diffDays === 1) return { text: 'Tomorrow', className: 'text-foreground' }
  if (diffDays <= 7) return { text: `${diffDays}d`, className: 'text-foreground' }

  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return { text: formatted, className: 'text-muted-foreground' }
}

// ── Error boundary ───────────────────────────────────────────────────────────

class TasklistErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error) {
    console.warn('[MarkdownTasklistBlock] Render failed, falling back to CodeBlock:', error)
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

// ── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: Task }) {
  const priority = task.priority ?? 4
  const due = task.due ? formatDueDate(task.due) : null

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 px-3 py-2 border-l-2 transition-colors',
        'hover:bg-foreground/[0.015]',
        PRIORITY_BORDER[priority] ?? PRIORITY_BORDER[4],
      )}
    >
      {/* Checkbox — Todoist-style colored circle outlines */}
      <div className="flex-none mt-[3px]">
        {task.done ? (
          <div className="w-4 h-4 rounded-full bg-success/20 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-success" strokeWidth={3} />
          </div>
        ) : (
          <Circle
            className={cn('w-4 h-4', PRIORITY_CIRCLE[priority] ?? PRIORITY_CIRCLE[4])}
            strokeWidth={priority <= 2 ? 2.5 : 1.5}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[13px] leading-snug',
              task.done && 'line-through text-muted-foreground/50',
            )}
          >
            {task.title}
          </span>
          {/* Labels */}
          {task.labels?.map((label) => (
            <span
              key={label}
              className="inline-block px-1.5 py-0 rounded text-[10px] font-medium bg-foreground/[0.05] text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
        {task.description && (
          <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5 truncate">
            {task.description}
          </p>
        )}
      </div>

      {/* Due date */}
      {due && (
        <span className={cn('flex-none text-[11px] font-medium tabular-nums mt-[2px]', due.className)}>
          {due.text}
        </span>
      )}
    </div>
  )
}

// ── Group section ────────────────────────────────────────────────────────────

function TaskGroupSection({
  group,
  defaultCollapsed = false,
}: {
  group: TaskGroup
  defaultCollapsed?: boolean
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)
  const doneCount = group.tasks.filter((t) => t.done).length

  return (
    <div>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-foreground/[0.02] border-b border-foreground/[0.06] hover:bg-foreground/[0.04] transition-colors select-none"
      >
        <ChevronRight
          className={cn('w-3 h-3 text-muted-foreground transition-transform', !collapsed && 'rotate-90')}
        />
        <span className="text-[12px] font-medium text-muted-foreground">{group.name}</span>
        <span className="text-[11px] text-muted-foreground/50">
          {doneCount}/{group.tasks.length}
        </span>
      </button>
      {!collapsed && (
        <div className="divide-y divide-foreground/[0.03]">
          {group.tasks.map((task, i) => (
            <TaskRow key={i} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export interface MarkdownTasklistBlockProps {
  code: string
  className?: string
}

export function MarkdownTasklistBlock({ code, className }: MarkdownTasklistBlockProps) {
  const parsed = React.useMemo<TasklistData | null>(() => {
    try {
      const raw = JSON.parse(code)
      if (!raw || typeof raw !== 'object') return null
      // Must have at least groups or tasks
      if (!Array.isArray(raw.groups) && !Array.isArray(raw.tasks)) return null
      return raw as TasklistData
    } catch {
      return null
    }
  }, [code])

  const [isFullscreen, setIsFullscreen] = React.useState(false)

  if (!parsed) {
    return <CodeBlock code={code} language="json" mode="full" className={className} />
  }

  const allTasks = [
    ...(parsed.groups?.flatMap((g) => g.tasks ?? []) ?? []),
    ...(parsed.tasks ?? []),
  ]
  const totalCount = allTasks.length
  const doneCount = allTasks.filter((t) => t.done).length

  const fallback = <CodeBlock code={code} language="json" mode="full" className={className} />

  const renderContent = (maxHeight?: boolean) => (
    <div className={cn(maxHeight && 'max-h-[400px] overflow-y-auto')}>
      {/* Grouped tasks */}
      {parsed.groups?.map((group, i) => (
        <TaskGroupSection key={i} group={group} />
      ))}

      {/* Ungrouped tasks */}
      {parsed.tasks && parsed.tasks.length > 0 && (
        <>
          {parsed.groups && parsed.groups.length > 0 && (
            <div className="px-3 py-1.5 bg-foreground/[0.02] border-b border-foreground/[0.06]">
              <span className="text-[12px] font-medium text-muted-foreground">Other</span>
            </div>
          )}
          <div className="divide-y divide-foreground/[0.03]">
            {parsed.tasks.map((task, i) => (
              <TaskRow key={i} task={task} />
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <TasklistErrorBoundary fallback={fallback}>
      <div className={cn('relative group rounded-[8px] overflow-hidden border bg-muted/10', className)}>
        {/* Expand button */}
        <button
          onClick={() => setIsFullscreen(true)}
          className={cn(
            'absolute top-[7px] right-2 p-1 rounded-[6px] transition-all z-10 select-none',
            'bg-background shadow-minimal',
            'opacity-0 group-hover:opacity-100',
            'text-muted-foreground/50 hover:text-foreground',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:opacity-100',
          )}
          title="View Fullscreen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Header */}
        <div className="px-3 py-2 bg-muted/50 border-b flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground font-medium">
            {parsed.title || 'Tasks'}
          </span>
          <span className="text-[11px] text-muted-foreground/60 tabular-nums">
            {doneCount}/{totalCount} done
          </span>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="h-[2px] bg-foreground/[0.04]">
            <div
              className="h-full bg-success/60 transition-all duration-300"
              style={{ width: `${(doneCount / totalCount) * 100}%` }}
            />
          </div>
        )}

        {/* Task list */}
        {renderContent(true)}
      </div>

      {/* Fullscreen overlay */}
      <PreviewOverlay
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        typeBadge={{
          icon: ListChecks,
          label: 'Tasks',
          variant: 'gray',
        }}
        title={parsed.title || 'Tasks'}
        subtitle={`${doneCount}/${totalCount} done`}
      >
        <div className="px-6">
          <div className="bg-background shadow-minimal rounded-[12px] overflow-hidden">
            {renderContent(false)}
          </div>
        </div>
      </PreviewOverlay>
    </TasklistErrorBoundary>
  )
}
