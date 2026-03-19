/**
 * SkillInfoPage
 *
 * Displays comprehensive skill details including metadata,
 * permission modes, and instructions.
 * Uses the Info_ component system for consistent styling with SourceInfoPage.
 */

import * as React from 'react'
import { useEffect, useState, useCallback } from 'react'
import { Check, X, Minus, FolderOpen, Trash2, Pencil } from 'lucide-react'
import { EditPopover, EditButton, getEditConfig } from '@/components/ui/EditPopover'
import { toast } from 'sonner'
import { SkillMenu } from '@/components/app-shell/SkillMenu'
import { SkillAvatar } from '@/components/ui/skill-avatar'
import { routes, navigate } from '@/lib/navigate'
import {
  Info_Page,
  Info_Section,
  Info_Table,
  Info_Markdown,
} from '@/components/info'
import { isAgent as checkIsAgent } from '../../shared/types'
import type { LoadedSkill, DepotSkillManifest, QuickCommand } from '../../shared/types'
import { getCommandIcon } from '@/lib/command-icon'
import { cn } from '@/lib/utils'

interface SkillInfoPageProps {
  skillSlug: string
  workspaceId: string
}

export default function SkillInfoPage({ skillSlug, workspaceId }: SkillInfoPageProps) {
  const [skill, setSkill] = useState<LoadedSkill | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load skill data
  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    const loadSkill = async () => {
      try {
        const skills = await window.electronAPI.getSkills(workspaceId)

        if (!isMounted) return

        // Find the skill by slug
        const found = skills.find((s) => s.slug === skillSlug)
        if (found) {
          setSkill(found)
        } else {
          setError('Agent not found')
        }
      } catch (err) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Failed to load skill')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadSkill()

    // Subscribe to skill changes
    const unsubscribe = window.electronAPI.onSkillsChanged?.((changedWorkspaceId, skills) => {
      if (changedWorkspaceId !== workspaceId) return
      const updated = skills.find((s) => s.slug === skillSlug)
      if (updated) {
        setSkill(updated)
      }
    })

    return () => {
      isMounted = false
      unsubscribe?.()
    }
  }, [workspaceId, skillSlug])

  // Handle open in finder
  const handleOpenInFinder = useCallback(async () => {
    if (!skill) return

    try {
      await window.electronAPI.openSkillInFinder(workspaceId, skillSlug)
    } catch (err) {
      console.error('Failed to open skill in finder:', err)
    }
  }, [skill, workspaceId, skillSlug])

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!skill) return

    try {
      await window.electronAPI.deleteSkill(workspaceId, skillSlug)
      toast.success(`Deleted skill: ${skill.metadata.name}`)
      navigate(routes.view.skills())
    } catch (err) {
      toast.error('Failed to delete skill', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }, [skill, workspaceId, skillSlug])

  // Handle demote (remove agent config, keep skill)
  const handleDemote = useCallback(async () => {
    if (!skill) return

    try {
      await window.electronAPI.demoteAgent(workspaceId, skillSlug)
      toast.success(`Removed agent configuration: ${skill.metadata.name}`)
    } catch (err) {
      toast.error('Failed to demote agent', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }, [skill, workspaceId, skillSlug])

  // Handle opening in new window
  const handleOpenInNewWindow = useCallback(() => {
    window.electronAPI.openUrl(`craftagents://skills/skill/${skillSlug}?window=focused`)
  }, [skillSlug])

  // Get skill name for header
  const skillName = skill?.metadata.name || skillSlug

  // Format path to show just the skill-relative portion (skills/{slug}/)
  const formatPath = (path: string) => {
    const skillsIndex = path.indexOf('/skills/')
    if (skillsIndex !== -1) {
      return path.slice(skillsIndex + 1) // Remove leading slash, keep "skills/{slug}/..."
    }
    return path
  }

  // Open the skill folder in Finder with SKILL.md selected
  const handleLocationClick = () => {
    if (!skill) return
    // Show the SKILL.md file in Finder (this reveals the enclosing folder with file focused)
    window.electronAPI.showInFolder(`${skill.path}/SKILL.md`)
  }

  return (
    <Info_Page
      loading={loading}
      error={error ?? undefined}
      empty={!skill && !loading && !error ? 'Agent not found' : undefined}
    >
      <Info_Page.Header
        title={skillName}
        titleMenu={
          <SkillMenu
            skillSlug={skillSlug}
            skillName={skillName}
            isAgent={skill ? checkIsAgent(skill) : false}
            onOpenInNewWindow={handleOpenInNewWindow}
            onShowInFinder={handleOpenInFinder}
            onDelete={handleDelete}
            onDemote={skill && checkIsAgent(skill) ? handleDemote : undefined}
          />
        }
      />

      {skill && (
        <Info_Page.Content>
          {/* Hero: Avatar, title, and description */}
          <Info_Page.Hero
            avatar={<SkillAvatar skill={skill} fluid workspaceId={workspaceId} />}
            title={skill.metadata.name}
            tagline={skill.metadata.description}
          />

          {/* Metadata */}
          <Info_Section
            title="Metadata"
            actions={
              // EditPopover for AI-assisted metadata editing (name, description in frontmatter)
              <EditPopover
                trigger={<EditButton />}
                {...getEditConfig('skill-metadata', skill.path)}
                secondaryAction={{
                  label: 'Edit File',
                  filePath: `${skill.path}/SKILL.md`,
                }}
              />
            }
          >
            <Info_Table>
              <Info_Table.Row label="Slug" value={skill.slug} />
              <Info_Table.Row label="Name">{skill.metadata.name}</Info_Table.Row>
              <Info_Table.Row label="Description">
                {skill.metadata.description}
              </Info_Table.Row>
              <Info_Table.Row label="Location">
                <button
                  onClick={handleLocationClick}
                  className="hover:underline cursor-pointer text-left"
                >
                  {formatPath(skill.path)}
                </button>
              </Info_Table.Row>
              {skill.metadata.requiredSources && skill.metadata.requiredSources.length > 0 && (
                <Info_Table.Row label="Required Sources">
                  {skill.metadata.requiredSources.join(', ')}
                </Info_Table.Row>
              )}
            </Info_Table>
          </Info_Section>

          {/* Project Paths */}
          {skill.manifest && (
            <ProjectPathsSection
              skill={skill}
              workspaceId={workspaceId}
            />
          )}

          {/* Commands */}
          {skill.manifest && (
            <CommandsSection skill={skill} workspaceId={workspaceId} />
          )}

          {/* Permission Modes */}
          {skill.metadata.alwaysAllow && skill.metadata.alwaysAllow.length > 0 && (
            <Info_Section title="Permission Modes">
              <div className="space-y-2 px-4 py-3">
                <p className="text-xs text-muted-foreground mb-3">
                  How "Always Allowed Tools" interacts with permission modes:
                </p>
                <div className="rounded-[8px] border border-border/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-border/30">
                        <td className="px-3 py-2 font-medium text-muted-foreground w-[140px]">Explore</td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <X className="h-3.5 w-3.5 text-destructive shrink-0" />
                          <span className="text-foreground/80">Blocked — write tools blocked regardless</span>
                        </td>
                      </tr>
                      <tr className="border-b border-border/30">
                        <td className="px-3 py-2 font-medium text-muted-foreground">Ask to Edit</td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-success shrink-0" />
                          <span className="text-foreground/80">Auto-approved — no prompts for allowed tools</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-muted-foreground">Auto</td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-foreground/80">No effect — all tools already auto-approved</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Info_Section>
          )}

          {/* Instructions */}
          <Info_Section
            title="Instructions"
            actions={
              // EditPopover for AI-assisted editing with "Edit File" as secondary action
              <EditPopover
                trigger={<EditButton />}
                {...getEditConfig('skill-instructions', skill.path)}
                secondaryAction={{
                  label: 'Edit File',
                  filePath: `${skill.path}/SKILL.md`,
                }}
              />
            }
          >
            <Info_Markdown maxHeight={540} fullscreen>
              {skill.content || '*No instructions provided.*'}
            </Info_Markdown>
          </Info_Section>

        </Info_Page.Content>
      )}
    </Info_Page>
  )
}

// ---------------------------------------------------------------------------
// Project Paths Section
// ---------------------------------------------------------------------------

const FIELD_INPUT_CLS = cn(
  'flex-1 h-7 px-2.5 text-xs rounded-md font-mono',
  'bg-background border border-border/60',
  'placeholder:text-muted-foreground/60',
  'focus:outline-none focus:ring-1 focus:ring-ring',
)

function ProjectPathsSection({
  skill,
  workspaceId,
}: {
  skill: LoadedSkill
  workspaceId: string
}) {
  const manifest = skill.manifest!
  const [paths, setPaths] = useState<string[]>(manifest.project_paths ?? [])
  const [newPath, setNewPath] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync when skill updates externally
  useEffect(() => {
    setPaths(skill.manifest?.project_paths ?? [])
  }, [skill.manifest?.project_paths])

  const save = useCallback(async (updatedPaths: string[]): Promise<boolean> => {
    setSaving(true)
    try {
      const updated: DepotSkillManifest = {
        ...manifest,
        project_paths: updatedPaths.length > 0 ? updatedPaths : undefined,
      }
      await window.electronAPI.promoteSkillToAgent(workspaceId, skill.slug, updated)
      setPaths(updatedPaths)
      return true
    } catch (err) {
      toast.error('Failed to update project paths', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
      return false
    } finally {
      setSaving(false)
    }
  }, [manifest, workspaceId, skill.slug])

  const addPath = useCallback(async () => {
    if (saving) return
    const trimmed = newPath.trim()
    if (!trimmed || paths.includes(trimmed)) return
    const updated = [...paths, trimmed]
    const saved = await save(updated)
    if (saved) setNewPath('')
  }, [newPath, paths, save, saving])

  const removePath = useCallback((index: number) => {
    if (saving) return
    const updated = paths.filter((_, i) => i !== index)
    save(updated)
  }, [paths, save, saving])

  return (
    <Info_Section title="Project Paths">
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          Directories this agent operates in. The first path becomes the working directory, and CLAUDE.md files are loaded as context.
        </p>

        {paths.length > 0 && (
          <div className="space-y-1">
            {paths.map((p, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 text-xs font-mono truncate">{p}</span>
                <button
                  type="button"
                  onClick={() => void removePath(i)}
                  disabled={saving}
                  aria-label={`Remove project path ${p}`}
                  title="Remove project path"
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            placeholder="~/projects/my-app"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !saving && void addPath()}
            disabled={saving}
            className={FIELD_INPUT_CLS}
          />
          <button
            type="button"
            onClick={() => void addPath()}
            disabled={!newPath.trim() || saving}
            className={cn(
              'shrink-0 h-7 px-2 text-xs rounded-md',
              'border border-border/60 bg-background hover:bg-foreground/[0.05]',
              'text-muted-foreground hover:text-foreground transition-colors',
              'disabled:opacity-40 disabled:pointer-events-none',
            )}
          >
            {saving ? '...' : 'Add'}
          </button>
        </div>
      </div>
    </Info_Section>
  )
}

// ---------------------------------------------------------------------------
// Commands Section
// ---------------------------------------------------------------------------

const HOVER_BTN_CLS = cn(
  'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
  'focus-visible:opacity-100 transition-opacity p-0.5 rounded',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
)

const SMALL_BTN_CLS = cn(
  'shrink-0 h-7 px-2 text-xs rounded-md',
  'border border-border/60 bg-background hover:bg-foreground/[0.05]',
  'text-muted-foreground hover:text-foreground transition-colors',
  'disabled:opacity-40 disabled:pointer-events-none',
)

const TEXTAREA_CLS = cn(
  'w-full px-2.5 py-1.5 text-xs rounded-md font-mono resize-y min-h-[60px]',
  'bg-background border border-border/60',
  'placeholder:text-muted-foreground/60',
  'focus:outline-none focus:ring-1 focus:ring-ring',
)

function CommandsSection({
  skill,
  workspaceId,
}: {
  skill: LoadedSkill
  workspaceId: string
}) {
  const manifest = skill.manifest!
  const [commands, setCommands] = useState<QuickCommand[]>(manifest.quick_commands ?? [])
  const [saving, setSaving] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPrompt, setEditPrompt] = useState('')

  // Sync when skill updates externally
  useEffect(() => {
    setCommands(skill.manifest?.quick_commands ?? [])
  }, [skill.manifest?.quick_commands])

  const save = useCallback(async (updatedCommands: QuickCommand[]): Promise<boolean> => {
    setSaving(true)
    try {
      const updated: DepotSkillManifest = {
        ...manifest,
        quick_commands: updatedCommands,
      }
      await window.electronAPI.promoteSkillToAgent(workspaceId, skill.slug, updated)
      setCommands(updatedCommands)
      return true
    } catch (err) {
      toast.error('Failed to update commands', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
      return false
    } finally {
      setSaving(false)
    }
  }, [manifest, workspaceId, skill.slug])

  const startEditing = useCallback((index: number) => {
    const cmd = commands[index]
    if (!cmd) return
    setEditingIndex(index)
    setEditName(cmd.name)
    setEditPrompt(cmd.prompt)
  }, [commands])

  const cancelEditing = useCallback(() => {
    setEditingIndex(null)
    setEditName('')
    setEditPrompt('')
  }, [])

  const saveEdit = useCallback(async () => {
    if (saving || editingIndex === null) return
    const trimmedName = editName.trim()
    const trimmedPrompt = editPrompt.trim()
    if (!trimmedName || !trimmedPrompt) return
    const updated = [...commands]
    updated[editingIndex] = { ...commands[editingIndex]!, name: trimmedName, prompt: trimmedPrompt }
    const saved = await save(updated)
    if (saved) cancelEditing()
  }, [saving, editingIndex, editName, editPrompt, commands, save, cancelEditing])

  const removeCommand = useCallback((index: number) => {
    if (saving) return
    const updated = commands.filter((_, i) => i !== index)
    save(updated)
  }, [commands, save, saving])

  const startAdding = useCallback(() => {
    setAdding(true)
    setEditName('')
    setEditPrompt('')
  }, [])

  const cancelAdding = useCallback(() => {
    setAdding(false)
    setEditName('')
    setEditPrompt('')
  }, [])

  const addCommand = useCallback(async () => {
    if (saving) return
    const trimmedName = editName.trim()
    const trimmedPrompt = editPrompt.trim()
    if (!trimmedName || !trimmedPrompt) return
    const updated = [...commands, { name: trimmedName, prompt: trimmedPrompt }]
    const saved = await save(updated)
    if (saved) cancelAdding()
  }, [saving, editName, editPrompt, commands, save, cancelAdding])

  const renderForm = (onSave: () => void, onCancel: () => void, saveLabel: string) => (
    <div className="space-y-2 rounded-md border border-border/60 bg-foreground/[0.02] p-2.5">
      <input
        type="text"
        autoFocus
        placeholder="Command name"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        disabled={saving}
        className={FIELD_INPUT_CLS}
      />
      <textarea
        placeholder="Prompt template (use {{variable}} for placeholders)"
        value={editPrompt}
        onChange={(e) => setEditPrompt(e.target.value)}
        disabled={saving}
        rows={3}
        className={TEXTAREA_CLS}
      />
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={SMALL_BTN_CLS}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!editName.trim() || !editPrompt.trim() || saving}
          className={SMALL_BTN_CLS}
        >
          {saving ? '...' : saveLabel}
        </button>
      </div>
    </div>
  )

  return (
    <Info_Section title="Commands">
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          Quick commands available for this agent. Each command sends a predefined prompt.
        </p>

        {commands.length > 0 && (
          <div className="space-y-1.5">
            {commands.map((cmd, i) =>
              editingIndex === i ? (
                <div key={i}>
                  {renderForm(() => void saveEdit(), cancelEditing, 'Save')}
                </div>
              ) : (
                <div key={i} className="flex items-center gap-2 group">
                  {getCommandIcon(cmd.name, 'h-3.5 w-3.5 text-muted-foreground shrink-0', cmd.icon)}
                  <span className="text-xs font-medium truncate shrink-0 max-w-[140px]">{cmd.name}</span>
                  <span className="flex-1 text-xs text-muted-foreground/50 truncate">
                    {cmd.prompt.length > 60 ? cmd.prompt.slice(0, 60) + '\u2026' : cmd.prompt}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEditing(i)}
                    disabled={saving}
                    aria-label={`Edit command ${cmd.name}`}
                    title="Edit command"
                    className={cn(HOVER_BTN_CLS, 'hover:bg-foreground/[0.08]')}
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeCommand(i)}
                    disabled={saving}
                    aria-label={`Remove command ${cmd.name}`}
                    title="Remove command"
                    className={cn(HOVER_BTN_CLS, 'hover:bg-destructive/10')}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              ),
            )}
          </div>
        )}

        {adding ? (
          renderForm(() => void addCommand(), cancelAdding, 'Add')
        ) : (
          <div className="pt-1">
            <button
              type="button"
              onClick={startAdding}
              disabled={saving || editingIndex !== null}
              className={SMALL_BTN_CLS}
            >
              Add command
            </button>
          </div>
        )}
      </div>
    </Info_Section>
  )
}
