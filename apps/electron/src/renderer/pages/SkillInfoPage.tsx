/**
 * SkillInfoPage
 *
 * Displays comprehensive skill details including metadata,
 * permission modes, and instructions.
 * Uses the Info_ component system for consistent styling with SourceInfoPage.
 */

import * as React from 'react'
import { useEffect, useState, useCallback } from 'react'
import { Check, X, Minus, FolderOpen, Trash2 } from 'lucide-react'
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
import type { LoadedSkill, DepotSkillManifest } from '../../shared/types'
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
            onOpenInNewWindow={handleOpenInNewWindow}
            onShowInFinder={handleOpenInFinder}
            onDelete={handleDelete}
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

const PATH_INPUT_CLS = cn(
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

  const save = useCallback(async (updatedPaths: string[]) => {
    setSaving(true)
    try {
      const updated: DepotSkillManifest = {
        ...manifest,
        project_paths: updatedPaths.length > 0 ? updatedPaths : undefined,
      }
      await window.electronAPI.promoteSkillToAgent(workspaceId, skill.slug, updated)
      setPaths(updatedPaths)
    } catch (err) {
      toast.error('Failed to update project paths', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }, [manifest, workspaceId, skill.slug])

  const addPath = useCallback(() => {
    const trimmed = newPath.trim()
    if (!trimmed || paths.includes(trimmed)) return
    const updated = [...paths, trimmed]
    setNewPath('')
    save(updated)
  }, [newPath, paths, save])

  const removePath = useCallback((index: number) => {
    const updated = paths.filter((_, i) => i !== index)
    save(updated)
  }, [paths, save])

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
                  onClick={() => removePath(i)}
                  disabled={saving}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
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
            onKeyDown={(e) => e.key === 'Enter' && addPath()}
            className={PATH_INPUT_CLS}
          />
          <button
            type="button"
            onClick={addPath}
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
