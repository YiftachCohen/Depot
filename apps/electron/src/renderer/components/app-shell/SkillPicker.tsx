/**
 * SkillPicker - Dialog for managing which skills appear on the dashboard.
 *
 * Shows all available skills with toggles to enable/disable them.
 * Also supports creating new skills inline and promoting plain skills to agents.
 * Persists selection to workspace settings via `enabledSkillSlugs`.
 */

import * as React from 'react'
import { useState, useMemo, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { Search, Plus, Zap, ArrowUpCircle } from 'lucide-react'
import { skillsAtom } from '@/atoms/skills'
import { SkillAvatar } from '@/components/ui/skill-avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { isAgent } from '../../../shared/types'
import type { LoadedSkill, DepotSkillManifest } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Shared input class
// ---------------------------------------------------------------------------
const INPUT_CLS = cn(
  'w-full h-8 px-3 text-sm rounded-md',
  'bg-background border border-border/60',
  'placeholder:text-muted-foreground/60',
  'focus:outline-none focus:ring-1 focus:ring-ring',
)

// ---------------------------------------------------------------------------
// Inline Promote Skill Form
// ---------------------------------------------------------------------------

interface PromoteSkillFormProps {
  skill: LoadedSkill
  workspaceId: string
  onPromoted: () => void
  onCancel: () => void
}

function PromoteSkillForm({ skill, workspaceId, onPromoted, onCancel }: PromoteSkillFormProps) {
  const [icon, setIcon] = useState('bot')
  const [cmdName, setCmdName] = useState('Run')
  const [cmdPrompt, setCmdPrompt] = useState('')
  const [projectPath, setProjectPath] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!cmdName.trim() || !cmdPrompt.trim()) return
    setSaving(true)
    try {
      const manifest: DepotSkillManifest = {
        name: skill.metadata.name,
        icon: icon.trim() || 'bot',
        description: skill.metadata.description,
        quick_commands: [{ name: cmdName.trim(), prompt: cmdPrompt.trim() }],
        ...(projectPath.trim() ? { project_paths: [projectPath.trim()] } : {}),
      }
      await window.electronAPI.promoteSkillToAgent(workspaceId, skill.slug, manifest)
      onPromoted()
    } catch (err) {
      console.error('Failed to promote skill:', err)
    } finally {
      setSaving(false)
    }
  }, [skill, workspaceId, icon, cmdName, cmdPrompt, projectPath, onPromoted])

  return (
    <div className="border border-border/60 rounded-lg p-3 space-y-2 bg-foreground/[0.02]">
      <div className="flex items-center gap-2 mb-1">
        <ArrowUpCircle className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Make "{skill.metadata.name}" an Agent</span>
      </div>
      <input type="text" placeholder="Icon name (e.g. bot, code, brain)" value={icon}
        onChange={(e) => setIcon(e.target.value)} className={INPUT_CLS} />
      <input type="text" placeholder="Quick command name (e.g. Run, Analyze)" value={cmdName}
        onChange={(e) => setCmdName(e.target.value)} className={INPUT_CLS} />
      <input type="text" placeholder="Prompt template for this command" value={cmdPrompt}
        onChange={(e) => setCmdPrompt(e.target.value)} className={INPUT_CLS} />
      <input type="text" placeholder="Project path (e.g. ~/projects/my-app)" value={projectPath}
        onChange={(e) => setProjectPath(e.target.value)} className={INPUT_CLS} />
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!cmdName.trim() || !cmdPrompt.trim() || saving} onClick={handleSubmit}>
          {saving ? 'Promoting...' : 'Make Agent'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SkillPicker
// ---------------------------------------------------------------------------

interface SkillPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  enabledSlugs: string[] | undefined
  onSave: (slugs: string[]) => void
  onCreateAgent?: () => void
}

const SOURCE_LABELS: Record<string, string> = {
  global: 'Global',
  workspace: 'Workspace',
  project: 'Project',
}

export function SkillPicker({ open, onOpenChange, workspaceId, enabledSlugs, onSave, onCreateAgent }: SkillPickerProps) {
  const allSkills = useAtomValue(skillsAtom)
  const [search, setSearch] = useState('')
  const [promotingSlug, setPromotingSlug] = useState<string | null>(null)

  // Initialize selected set: undefined/empty means all selected
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (!enabledSlugs || enabledSlugs.length === 0) {
      return new Set(allSkills.map((s) => s.slug))
    }
    return new Set(enabledSlugs)
  })

  // Re-sync when dialog opens or enabledSlugs change
  React.useEffect(() => {
    if (open) {
      if (!enabledSlugs || enabledSlugs.length === 0) {
        setSelected(new Set(allSkills.map((s) => s.slug)))
      } else {
        setSelected(new Set(enabledSlugs))
      }
      setSearch('')
      setPromotingSlug(null)
    }
  }, [open, enabledSlugs, allSkills])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = !search.trim()
      ? allSkills
      : allSkills.filter(
          (s) =>
            s.metadata.name.toLowerCase().includes(q) ||
            s.metadata.description.toLowerCase().includes(q) ||
            s.slug.toLowerCase().includes(q),
        )

    const getPriority = (skill: LoadedSkill): number => {
      if (isAgent(skill) && selected.has(skill.slug)) return 0
      if (isAgent(skill)) return 1
      return 2
    }

    return [...matches].sort((a, b) => {
      const priorityDiff = getPriority(a) - getPriority(b)
      if (priorityDiff !== 0) return priorityDiff
      return a.metadata.name.localeCompare(b.metadata.name, undefined, { sensitivity: 'base' })
    })
  }, [allSkills, search, selected])

  const toggleSkill = useCallback((slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        next.delete(slug)
      } else {
        next.add(slug)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelected(new Set(allSkills.map((s) => s.slug)))
  }, [allSkills])

  const deselectAll = useCallback(() => {
    setSelected(new Set())
  }, [])

  const handleSave = useCallback(() => {
    // If all are selected, save undefined (backward compat = show all)
    const allSelected = allSkills.length > 0 && selected.size === allSkills.length
    onSave(allSelected ? [] : Array.from(selected))
    onOpenChange(false)
  }, [allSkills, selected, onSave, onOpenChange])

  const handleCreateAgent = useCallback(() => {
    if (!onCreateAgent) return
    onOpenChange(false)
    onCreateAgent()
  }, [onOpenChange, onCreateAgent])

  const handlePromoted = useCallback(() => {
    setPromotingSlug(null)
    // Skill will reload as agent via file watcher
  }, [])

  const promotingSkill = promotingSlug ? allSkills.find(s => s.slug === promotingSlug) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manage Agents</DialogTitle>
          <DialogDescription>
            Choose which agents appear on your dashboard.
          </DialogDescription>
        </DialogHeader>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full h-8 pl-8 pr-3 text-sm rounded-md',
                  'bg-foreground/[0.03] border border-border/60',
                  'placeholder:text-muted-foreground/60',
                  'focus:outline-none focus:ring-1 focus:ring-ring',
                )}
              />
            </div>

            {/* Select All / Deselect All */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Select All
              </button>
              <span className="text-xs text-muted-foreground/40">|</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Deselect All
              </button>
              <span className="ml-auto text-xs text-muted-foreground">
                {selected.size} of {allSkills.length} selected
              </span>
            </div>

            {/* Skill list */}
            <div className="-mx-6 px-6 overflow-y-auto" style={{ maxHeight: 'min(40vh, 400px)' }}>
              <div className="space-y-1">
                {filtered.map((skill) => (
                  <div key={skill.slug} className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md',
                    'hover:bg-foreground/[0.03] transition-colors',
                  )}>
                    {/* Toggle indicator */}
                    <button
                      type="button"
                      onClick={() => toggleSkill(skill.slug)}
                      className="shrink-0"
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border transition-colors flex items-center justify-center',
                          selected.has(skill.slug)
                            ? 'bg-foreground border-foreground'
                            : 'border-border/80 bg-background',
                        )}
                      >
                        {selected.has(skill.slug) && (
                          <svg className="w-3 h-3 text-background" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleSkill(skill.slug)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="shrink-0">
                        <SkillAvatar skill={skill} size="sm" workspaceId={workspaceId} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{skill.metadata.name}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground/60">
                            {SOURCE_LABELS[skill.source] ?? skill.source}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{skill.metadata.description}</p>
                      </div>
                    </button>

                    {/* Make Agent button for plain skills */}
                    {!isAgent(skill) && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPromotingSlug(skill.slug) }}
                        title="Promote to Agent"
                        className={cn(
                          'shrink-0 inline-flex items-center gap-1 h-6 px-2 text-[10px] font-medium rounded-md',
                          'border border-border/60 bg-background hover:bg-foreground/[0.05]',
                          'text-muted-foreground hover:text-foreground transition-colors',
                        )}
                      >
                        <Zap className="h-2.5 w-2.5" />
                        Make Agent
                      </button>
                    )}
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No agents matching "{search}"
                  </div>
                )}
              </div>
            </div>

            {/* Promote form */}
            {promotingSkill && (
              <PromoteSkillForm
                skill={promotingSkill}
                workspaceId={workspaceId}
                onPromoted={handlePromoted}
                onCancel={() => setPromotingSlug(null)}
              />
            )}

        {/* Create Agent button */}
        {!promotingSlug && onCreateAgent && (
          <button
            type="button"
            onClick={handleCreateAgent}
            className={cn(
              'group flex items-center justify-center gap-2 w-full h-9 rounded-lg',
              'border border-dashed border-border/60 hover:border-foreground/20',
              'bg-transparent hover:bg-foreground/[0.04] transition-all duration-200',
              'text-xs font-medium text-muted-foreground/70 hover:text-foreground/80',
            )}
          >
            <Plus className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
            Create Agent
          </button>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
