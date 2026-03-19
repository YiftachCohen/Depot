/**
 * SkillDashboard - Mission-control style landing view for workspace skills.
 *
 * Renders a responsive grid of agent cards with launchable quick-command buttons,
 * a greeting header, recent sessions feed, and agent management actions.
 */
import * as React from 'react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAtomValue } from 'jotai'
import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { Zap, Plus, Settings2, Search, FolderOpen, X, Pencil, Sparkles, Bot, MessageSquare, ArrowRight, LayoutGrid, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getCommandIcon, ICON_NAME_MAP, resolveIconComponent } from '@/lib/command-icon'
import { useEntityIcon } from '@/lib/icon-cache'
import { InlineSvg } from '@/lib/inline-svg'
import { skillsAtom } from '@/atoms/skills'
import { sessionMetaMapAtom } from '@/atoms/sessions'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { PanelHeader } from './PanelHeader'
import { SkillPicker } from './SkillPicker'
import { useAppShellContext } from '@/context/AppShellContext'
import { navigate, routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import { isAgent } from '../../../shared/types'
import type { LoadedSkill, QuickCommand, DepotSkillManifest } from '../../../shared/types'
import { TemplateVariableModal } from './TemplateVariableModal'
import { AgentTemplateBrowser } from './AgentTemplateBrowser'
import type { AgentTemplate } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Skill Creator Prompt
// ---------------------------------------------------------------------------
const SKILL_CREATOR_PROMPT = `/skill-creator

I want to create a new agent for Depot. Depot agents are standard Claude Code skills with one addition: a \`depot.yaml\` manifest file alongside the SKILL.md.

**Important — after creating the SKILL.md, also create a \`depot.yaml\` in the same directory** with this format:
\`\`\`yaml
name: "Agent Name"
icon: "bot"  # Lucide icon name (e.g. code-2, git-pull-request, shield, rocket, bug, server, database, terminal, sparkles, wrench, globe, search, layers, settings, book-open, zap, flask-conical, bar-chart-3, clipboard-list, eye, message-square, file-code, folder-kanban, hammer, refresh-cw, circle-check, package-plus, alert-triangle)
description: "Brief description"
sources:  # Optional: MCP sources to auto-connect
  - "github"
quick_commands:
  - name: "Command Name"
    prompt: "Prompt template with {{variable}} placeholders"
    icon: "zap"  # Optional Lucide icon
    variables:  # Optional: only if prompt has {{placeholders}}
      - name: "variable"
        type: "text"  # text | select | number
        label: "Human Label"
        placeholder: "e.g. example value"
  - name: "Another Command"
    prompt: "A simpler prompt with no variables"
\`\`\`

The skill directory should be created at **~/.depot/skills/{slug}/** (not ~/.claude/skills/).

After creating both files, run \`skill_validate\` to verify the result.

Let's start — what kind of agent would you like to create?`

function buildSkillPromotePrompt(skill: LoadedSkill): string {
  return `/skill-creator

I have an existing skill called "${skill.metadata.name}" (slug: "${skill.slug}") that I want to promote to a full Depot agent by adding a \`depot.yaml\` manifest.

The skill's SKILL.md is located at: ${skill.path}/SKILL.md
${skill.metadata.description ? `Description: ${skill.metadata.description}` : ''}

Please:
1. Read the SKILL.md file at the path above
2. Based on its content, generate an appropriate \`depot.yaml\` manifest file in the same directory (${skill.path}/depot.yaml)

The depot.yaml format:
\`\`\`yaml
name: "Agent Name"
icon: "bot"  # Lucide icon name (e.g. code-2, git-pull-request, shield, rocket, bug, server, database, terminal, sparkles, wrench, globe, search, layers, settings, book-open, zap, flask-conical, bar-chart-3, clipboard-list, eye, message-square, file-code, folder-kanban, hammer, refresh-cw, circle-check, package-plus, alert-triangle)
description: "Brief description"
sources:  # Optional: MCP sources to auto-connect
  - "github"
quick_commands:
  - name: "Command Name"
    prompt: "Prompt template with {{variable}} placeholders"
    icon: "zap"  # Optional Lucide icon
    variables:  # Optional: only if prompt has {{placeholders}}
      - name: "variable"
        type: "text"  # text | select | number
        label: "Human Label"
        placeholder: "e.g. example value"
  - name: "Another Command"
    prompt: "A simpler prompt with no variables"
\`\`\`

Choose an appropriate icon, write a clear description, and create 2-4 useful quick commands based on what the skill does. After creating the file, run \`skill_validate\` to verify the result.`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ACCENT_PALETTE = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#6366f1']

export function getAccentColor(slug: string): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length]
}
function getActivityStatus(lastUsedAt?: number): 'active' | 'recent' | 'idle' {
  if (!lastUsedAt) return 'idle'
  const diff = Date.now() - lastUsedAt
  return diff < 3600_000 ? 'active' : diff < 86400_000 ? 'recent' : 'idle'
}
export function formatRelativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`
}
// Dynamic greeting pool — each entry has [withName, withoutName] variants
type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'latenight' | 'any'
const GREETINGS: [TimeBucket, string, string][] = [
  // morning (5-12)
  ['morning', 'Good morning, {name}', 'Good morning'],
  ['morning', 'Rise and ship, {name}', 'Rise and ship'],
  ['morning', 'What are we building today, {name}?', 'What are we building today?'],
  ['morning', 'Fresh start, {name} — let\'s go', 'Fresh start — let\'s go'],
  // afternoon (12-18)
  ['afternoon', 'Good afternoon, {name}', 'Good afternoon'],
  ['afternoon', 'Let\'s keep shipping, {name}', 'Let\'s keep shipping'],
  ['afternoon', 'Back at it, {name}?', 'Back at it?'],
  ['afternoon', 'Afternoon focus mode, {name}', 'Afternoon focus mode'],
  // evening (18-22)
  ['evening', 'Good evening, {name}', 'Good evening'],
  ['evening', 'Evening session, {name}?', 'Evening session?'],
  ['evening', 'Winding down or just getting started, {name}?', 'Winding down or just getting started?'],
  // late night (22-5)
  ['latenight', 'Late night coding, {name}?', 'Late night coding?'],
  ['latenight', 'The quiet hours — let\'s build, {name}', 'The quiet hours — let\'s build'],
  ['latenight', 'Burning the midnight oil, {name}?', 'Burning the midnight oil?'],
  // time-agnostic
  ['any', '{name} returns!', 'Welcome back'],
  ['any', 'Welcome back, {name}', 'Welcome back'],
  ['any', 'Ready when you are, {name}', 'Ready when you are'],
  ['any', 'Let\'s make something great, {name}', 'Let\'s make something great'],
  ['any', 'What\'s on the agenda, {name}?', 'What\'s on the agenda?'],
]

function getDynamicGreeting(name?: string): string {
  const h = new Date().getHours()
  const bucket: TimeBucket = h >= 5 && h < 12 ? 'morning'
    : h >= 12 && h < 18 ? 'afternoon'
    : h >= 18 && h < 22 ? 'evening'
    : 'latenight'
  const pool = GREETINGS.filter(([b]) => b === bucket || b === 'any')
  const daySeed = Math.floor(Date.now() / 86_400_000)
  const entry = pool[daySeed % pool.length]
  return name ? entry[1].replace('{name}', name) : entry[2]
}

// Animation variants
const containerVariants: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
}
const fadeIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

// Shared class strings — command chips (minimal style)
const CMD_CHIP = cn(
  'inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80 cursor-pointer',
  'rounded-md px-1.5 py-0.5 -mx-0.5',
  'hover:bg-foreground/[0.05] hover:text-foreground/80 transition-colors',
)
const FOCUSED_CMD_CHIP = cn(
  'inline-flex items-center gap-1.5 text-[13px] text-muted-foreground/80 cursor-pointer',
  'rounded-lg px-3 py-1.5',
  'border border-border/60 bg-foreground/[0.02]',
  'hover:bg-foreground/[0.06] hover:border-foreground/20 hover:text-foreground/80 transition-colors',
)
const PATH_BADGE = cn(
  'inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground/70',
  'rounded-md px-1.5 py-0.5 group/path',
  'hover:text-muted-foreground/70 transition-colors',
)
const INPUT_CLS = cn(
  'w-full h-8 px-3 text-sm rounded-md bg-background border border-border/60',
  'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring',
)

interface SkillSessionStats { sessionCount: number; lastUsedAt?: number }
const ACTIVITY_DOT: Record<string, string> = { active: 'bg-success', recent: 'bg-info', idle: 'bg-foreground/20' }

// Accent-tinted agent avatar for the dashboard list
function AgentIcon({ skill, accent, workspaceId }: { skill: LoadedSkill; accent: string; workspaceId: string }) {
  const icon = useEntityIcon({
    workspaceId,
    entityType: 'skill',
    identifier: skill.slug,
    iconPath: skill.iconPath,
    iconValue: skill.metadata.icon,
  })
  const FallbackIcon = useMemo(
    () => resolveIconComponent(skill.manifest?.icon, skill.metadata.name),
    [skill.manifest?.icon, skill.metadata.name],
  )

  return (
    <div
      className="flex items-center justify-center h-9 w-9 rounded-xl shrink-0"
      style={{ backgroundColor: `${accent}14` }}
    >
      {icon.kind === 'emoji' ? (
        <span className="text-base leading-none">{icon.value}</span>
      ) : icon.kind === 'file' && icon.colorable && icon.rawSvg ? (
        <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]" style={{ color: accent }}>
          <InlineSvg svg={icon.rawSvg} />
        </span>
      ) : icon.kind === 'file' ? (
        <img src={icon.value} alt={skill.metadata.name} className="h-[18px] w-[18px] rounded" />
      ) : (
        <span style={{ color: accent }}>
          <FallbackIcon className="h-[18px] w-[18px]" />
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SkillDashboard
// ---------------------------------------------------------------------------
export function SkillDashboard({ focusedSkillSlug }: { focusedSkillSlug?: string } = {}) {
  const skills = useAtomValue(skillsAtom)
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const { activeWorkspaceId, onCreateSession, onSendMessage, onEnabledSkillSlugsChange } = useAppShellContext()
  const [searchQuery, setSearchQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [enabledSlugs, setEnabledSlugs] = useState<string[] | undefined>(undefined)
  const [userName, setUserName] = useState('')
  const previousSkillSlugsRef = useRef<Set<string>>(new Set())
  const hasInitializedSkillFilterRef = useRef(false)
  const [pendingVarCommand, setPendingVarCommand] = useState<{ skill: LoadedSkill; cmd: QuickCommand } | null>(null)
  const [templateBrowserOpen, setTemplateBrowserOpen] = useState(false)
  const [agentTemplates, setAgentTemplates] = useState<AgentTemplate[]>([])

  // Load templates on mount
  useEffect(() => {
    window.electronAPI.getAgentTemplates()
      .then(setAgentTemplates)
      .catch((err) => {
        console.error('Failed to load agent templates:', err)
      })
  }, [])

  const handleCreateFromTemplate = useCallback(async (
    templateId: string,
    overrides?: Partial<import('../../../shared/types').DepotSkillManifest> & { slug?: string },
  ) => {
    await window.electronAPI.createAgentFromTemplate(templateId, overrides)
    // Skill file watcher will auto-refresh the dashboard
  }, [])

  useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI.getWorkspaceSettings(activeWorkspaceId)
      .then((ws) => setEnabledSlugs(ws?.enabledSkillSlugs)).catch(() => {})
  }, [activeWorkspaceId])

  useEffect(() => {
    previousSkillSlugsRef.current = new Set()
    hasInitializedSkillFilterRef.current = false
  }, [activeWorkspaceId])

  useEffect(() => {
    window.electronAPI.readPreferences()
      .then(({ content }) => {
        try { const prefs = JSON.parse(content); if (prefs.name) setUserName(prefs.name) } catch {}
      }).catch(() => {})
  }, [])

  useEffect(() => {
    const currentSkillSlugs = new Set(skills.map((skill) => skill.slug))

    if (!enabledSlugs) {
      previousSkillSlugsRef.current = currentSkillSlugs
      hasInitializedSkillFilterRef.current = false
      return
    }

    if (!hasInitializedSkillFilterRef.current) {
      previousSkillSlugsRef.current = currentSkillSlugs
      hasInitializedSkillFilterRef.current = true
      return
    }

    const enabledSet = new Set(enabledSlugs)
    const addedSkillSlugs = Array.from(currentSkillSlugs).filter((slug) =>
      !previousSkillSlugsRef.current.has(slug) && !enabledSet.has(slug),
    )

    previousSkillSlugsRef.current = currentSkillSlugs

    if (!activeWorkspaceId || addedSkillSlugs.length === 0) {
      return
    }

    const previousEnabledSlugs = enabledSlugs
    const nextEnabledSlugs = Array.from(new Set([...enabledSlugs, ...addedSkillSlugs]))
    setEnabledSlugs(nextEnabledSlugs)
    window.electronAPI.updateWorkspaceSetting(activeWorkspaceId, 'enabledSkillSlugs', nextEnabledSlugs)
      .catch((err: unknown) => {
        console.error('Failed to auto-enable new skills:', err)
        setEnabledSlugs(previousEnabledSlugs)
      })
  }, [activeWorkspaceId, enabledSlugs, skills])

  const skillStats = useMemo(() => {
    const stats = new Map<string, SkillSessionStats>()
    for (const meta of sessionMetaMap.values()) {
      if (!meta.skillSlug) continue
      const existing = stats.get(meta.skillSlug)
      const t = meta.lastMessageAt ?? 0
      if (existing) { existing.sessionCount += 1; if (t > (existing.lastUsedAt ?? 0)) existing.lastUsedAt = t }
      else stats.set(meta.skillSlug, { sessionCount: 1, lastUsedAt: t || undefined })
    }
    return stats
  }, [sessionMetaMap])

  const filteredSkills = useMemo(() => {
    let base = skills
    if (enabledSlugs) {
      const set = new Set(enabledSlugs)
      base = skills.filter((s) => set.has(s.slug))
    }
    if (!searchQuery.trim()) return base
    const q = searchQuery.toLowerCase()
    return base.filter((s) =>
      s.metadata.name.toLowerCase().includes(q) || s.metadata.description.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q))
  }, [skills, enabledSlugs, searchQuery])

  const filteredAgents = useMemo(() => filteredSkills.filter(isAgent), [filteredSkills])

  const recentGlobalSessions = useMemo(() =>
    Array.from(sessionMetaMap.values()).filter((m) => m.skillSlug)
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0)).slice(0, 8),
  [sessionMetaMap])

  const skillBySlug = useMemo(() => {
    const map = new Map<string, LoadedSkill>()
    for (const s of skills) map.set(s.slug, s)
    return map
  }, [skills])

  const handleQuickCommand = useCallback(async (skill: LoadedSkill, cmd: QuickCommand) => {
    if (!activeWorkspaceId) return
    if (cmd.variables && cmd.variables.length > 0) {
      setPendingVarCommand({ skill, cmd })
      return
    }
    const session = await onCreateSession(activeWorkspaceId, {
      name: cmd.name, skillSlug: skill.slug,
      enabledSourceSlugs: skill.manifest?.sources ?? skill.metadata.requiredSources,
    })
    if (session?.id && cmd.prompt) onSendMessage(session.id, cmd.prompt, undefined, [skill.slug])
    if (session?.id) navigate(routes.view.skills(skill.slug, session.id))
  }, [activeWorkspaceId, onCreateSession, onSendMessage])

  const handleVariableSubmit = useCallback(async (resolvedPrompt: string) => {
    if (!activeWorkspaceId || !pendingVarCommand) return
    const { skill, cmd } = pendingVarCommand
    try {
      const session = await onCreateSession(activeWorkspaceId, {
        name: cmd.name, skillSlug: skill.slug,
        enabledSourceSlugs: skill.manifest?.sources ?? skill.metadata.requiredSources,
      })
      if (!session?.id) {
        toast.error('Failed to create session')
        return
      }
      if (resolvedPrompt) onSendMessage(session.id, resolvedPrompt, undefined, [skill.slug])
      setPendingVarCommand(null)
      navigate(routes.view.skills(skill.slug, session.id))
    } catch (err) {
      toast.error('Failed to run command', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }, [activeWorkspaceId, pendingVarCommand, onCreateSession, onSendMessage])

  const handleSkillClick = useCallback(async (skill: LoadedSkill) => {
    if (!activeWorkspaceId) return
    const session = await onCreateSession(activeWorkspaceId, {
      skillSlug: skill.slug,
      enabledSourceSlugs: skill.manifest?.sources ?? skill.metadata.requiredSources,
    })
    if (session?.id) navigate(routes.view.skills(skill.slug, session.id))
  }, [activeWorkspaceId, onCreateSession])

  const handleSaveEnabledSlugs = useCallback((slugs: string[]) => {
    setEnabledSlugs(slugs)
    onEnabledSkillSlugsChange?.(slugs)
  }, [onEnabledSkillSlugsChange])

  const creatingAgentSessionRef = useRef(false)

  const handleCreateAgentSession = useCallback(async () => {
    if (!activeWorkspaceId || creatingAgentSessionRef.current) return
    creatingAgentSessionRef.current = true
    try {
      const session = await onCreateSession(activeWorkspaceId, {
        name: 'Create New Agent',
      })
      if (session?.id) {
        onSendMessage(session.id, SKILL_CREATOR_PROMPT)
        navigate(routes.view.allSessions(session.id))
      }
    } finally {
      creatingAgentSessionRef.current = false
    }
  }, [activeWorkspaceId, onCreateSession, onSendMessage])

  const handlePromoteWithAI = useCallback(async (skill: LoadedSkill) => {
    if (!activeWorkspaceId) return
    try {
      const session = await onCreateSession(activeWorkspaceId, {
        name: `Promote ${skill.metadata.name}`,
        skillSlug: skill.slug,
      })
      if (session?.id) {
        onSendMessage(session.id, buildSkillPromotePrompt(skill), undefined, [skill.slug])
        navigate(routes.view.allSessions(session.id))
      }
    } catch (err) {
      console.error('Failed to start promote session:', err)
    }
  }, [activeWorkspaceId, onCreateSession, onSendMessage])

  const headerActions = (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => setTemplateBrowserOpen(true)} aria-label="Browse Templates"
        className="p-1.5 rounded-md hover:bg-foreground/[0.05] transition-colors cursor-pointer" title="Browse Templates">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
      </button>
      <button type="button" onClick={handleCreateAgentSession} aria-label="Create Agent"
        className="p-1.5 rounded-md hover:bg-foreground/[0.05] transition-colors cursor-pointer" title="Create Agent">
        <Plus className="h-4 w-4 text-muted-foreground" />
      </button>
      <button type="button" onClick={() => setPickerOpen(true)} aria-label="Manage Agents"
        className="p-1.5 rounded-md hover:bg-foreground/[0.05] transition-colors cursor-pointer" title="Manage Agents">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  )

  const gridCls = 'space-y-0 divide-y divide-border/30'

  // --- Focused Agent View ---
  const focusedSkill = focusedSkillSlug ? skills.find(s => s.slug === focusedSkillSlug) : null
  const [iconOverride, setIconOverride] = useState<string | undefined>(undefined)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [focusedPaths, setFocusedPaths] = useState<string[]>([])
  const [addingPath, setAddingPath] = useState(false)
  const [newPathValue, setNewPathValue] = useState('')
  const [savingPath, setSavingPath] = useState(false)
  const latestManifestRef = React.useRef<DepotSkillManifest | null>(null)
  // Reset override when focused skill changes (file watcher catches up)
  // Skip sync if user is mid-edit to avoid clobbering in-flight changes
  useEffect(() => { if (!showIconPicker) { setIconOverride(undefined) } }, [focusedSkill?.manifest?.icon])
  useEffect(() => { if (!addingPath) { setFocusedPaths(focusedSkill?.manifest?.project_paths ?? []) } }, [focusedSkill?.manifest?.project_paths])
  useEffect(() => { latestManifestRef.current = focusedSkill?.manifest ?? null }, [focusedSkill?.slug, focusedSkill?.manifest])

  const iconEntries = useMemo(() => Object.entries(ICON_NAME_MAP), [])

  const saveFocusedManifest = useCallback(async (updates: Partial<DepotSkillManifest>): Promise<boolean> => {
    if (!focusedSkill?.manifest || !activeWorkspaceId) return false
    setSavingPath(true)
    try {
      const baseManifest = latestManifestRef.current ?? focusedSkill.manifest
      const updated: DepotSkillManifest = { ...baseManifest, ...updates }
      await window.electronAPI.promoteSkillToAgent(activeWorkspaceId, focusedSkill.slug, updated)
      latestManifestRef.current = updated
      return true
    } catch (err) {
      toast.error('Failed to save', { description: err instanceof Error ? err.message : 'Unknown error' })
      return false
    } finally { setSavingPath(false) }
  }, [focusedSkill, activeWorkspaceId])

  const handleFocusedIconSelect = useCallback(async (iconName: string) => {
    const previousIcon = iconOverride
    setIconOverride(iconName)
    setShowIconPicker(false)
    const saved = await saveFocusedManifest({ icon: iconName })
    if (!saved) setIconOverride(previousIcon)
  }, [iconOverride, saveFocusedManifest])

  const handleAddPath = useCallback(async () => {
    const trimmed = newPathValue.trim()
    if (!trimmed || focusedPaths.includes(trimmed)) return
    const updated = [...focusedPaths, trimmed]
    const saved = await saveFocusedManifest({ project_paths: updated })
    if (!saved) return
    setFocusedPaths(updated)
    setNewPathValue('')
    setAddingPath(false)
  }, [newPathValue, focusedPaths, saveFocusedManifest])

  const handleRemovePath = useCallback(async (index: number) => {
    const updated = focusedPaths.filter((_, i) => i !== index)
    const saved = await saveFocusedManifest({ project_paths: updated.length > 0 ? updated : undefined })
    if (!saved) return
    setFocusedPaths(updated)
  }, [focusedPaths, saveFocusedManifest])

  const handleImproveAgent = useCallback(async () => {
    if (!activeWorkspaceId || !focusedSkill) return
    const session = await onCreateSession(activeWorkspaceId, {
      name: `Improve ${focusedSkill.metadata.name}`,
      skillSlug: focusedSkill.slug,
    })
    if (session?.id) {
      const prompt = `I want to improve the "${focusedSkill.metadata.name}" agent. Its SKILL.md is at: ${focusedSkill.path}/SKILL.md\n\nPlease read it, then help me refine it — better instructions, more useful quick commands, clearer description. Show me what you'd change and why.`
      onSendMessage(session.id, prompt, undefined, [focusedSkill.slug])
      navigate(routes.view.skills(focusedSkill.slug, session.id))
    }
  }, [activeWorkspaceId, focusedSkill, onCreateSession, onSendMessage])

  // Delete focused agent
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleDeleteFocusedAgent = useCallback(async () => {
    if (!activeWorkspaceId || !focusedSkill) return
    setDeleteDialogOpen(false)
    try {
      await window.electronAPI.deleteSkill(activeWorkspaceId, focusedSkill.slug)
      toast.success(`Deleted: ${focusedSkill.metadata.name}`)
      navigate(routes.view.skills())
    } catch (err) {
      toast.error('Failed to delete', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }, [activeWorkspaceId, focusedSkill])

  const handleDemoteFocusedAgent = useCallback(async () => {
    if (!activeWorkspaceId || !focusedSkill) return
    setDeleteDialogOpen(false)
    try {
      await window.electronAPI.demoteAgent(activeWorkspaceId, focusedSkill.slug)
      toast.success(`Removed agent configuration: ${focusedSkill.metadata.name}`)
    } catch (err) {
      toast.error('Failed to remove agent configuration', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }, [activeWorkspaceId, focusedSkill])

  if (focusedSkill) {
    const cmds = focusedSkill.manifest?.quick_commands ?? []
    const stats = skillStats.get(focusedSkill.slug)
    const count = stats?.sessionCount ?? 0
    const activity = getActivityStatus(stats?.lastUsedAt)
    const accent = getAccentColor(focusedSkill.slug)
    const recent = Array.from(sessionMetaMap.values())
      .filter(m => m.skillSlug === focusedSkill.slug)
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0)).slice(0, 5)
    return (
      <div className="flex flex-col h-full">
        <PanelHeader title={focusedSkill.metadata.name} />
        <Separator />
        <ScrollArea className="flex-1">
          <motion.div
            className="px-8 py-6 max-w-[640px] mx-auto space-y-5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Header — mirrors dashboard card layout */}
            <motion.div variants={fadeIn}>
              <div className="flex items-start gap-3.5">
                <div className="relative shrink-0 mt-0.5">
                  <button
                    type="button"
                    onClick={() => focusedSkill.manifest && setShowIconPicker(v => !v)}
                    aria-label="Change icon"
                    className="cursor-pointer rounded-xl hover:ring-2 hover:ring-foreground/10 transition-all"
                    title="Change icon"
                  >
                    <AgentIcon skill={focusedSkill} accent={accent} workspaceId={activeWorkspaceId ?? ''} />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  {/* Row 1: Name + activity dot */}
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium truncate">{focusedSkill.metadata.name}</span>
                    <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', ACTIVITY_DOT[activity])} />
                  </div>

                  {/* Row 2: Description */}
                  <p className="text-[13px] leading-relaxed text-muted-foreground/80 line-clamp-2 mt-1">{focusedSkill.metadata.description}</p>

                  {/* Row 3: Project paths as inline badges */}
                  {focusedSkill.manifest && (focusedPaths.length > 0 || addingPath) && (
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      {focusedPaths.map((p, i) => (
                        <span key={i} className={PATH_BADGE}>
                          <FolderOpen className="h-2.5 w-2.5" />
                          <span className="truncate max-w-[180px]">{p}</span>
                          <button
                            type="button"
                            onClick={() => void handleRemovePath(i)}
                            disabled={savingPath}
                            aria-label={`Remove project path ${p}`}
                            title="Remove project path"
                            className="opacity-0 group-hover/path:opacity-100 group-focus-within/path:opacity-100 focus-visible:opacity-100 transition-opacity rounded hover:text-destructive focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                      {addingPath && (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="text"
                            autoFocus
                            placeholder="~/projects/my-app"
                            value={newPathValue}
                            onChange={(e) => setNewPathValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void handleAddPath()
                              if (e.key === 'Escape') { setAddingPath(false); setNewPathValue('') }
                            }}
                            onBlur={() => { if (!newPathValue.trim()) { setAddingPath(false); setNewPathValue('') } }}
                            className="h-5 px-1.5 text-[10px] font-mono rounded border border-border/60 bg-background w-36 focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </span>
                      )}
                    </div>
                  )}

                  {/* Row 4: Meta line — stats + actions */}
                  <div className="flex items-center flex-wrap gap-1.5 mt-2 text-xs text-muted-foreground/60">
                    {count > 0 && <span>{count} session{count !== 1 ? 's' : ''}</span>}
                    {count > 0 && stats?.lastUsedAt && <span aria-hidden>{'·'}</span>}
                    {stats?.lastUsedAt && <span>{formatRelativeTime(stats.lastUsedAt)}</span>}
                    {(count > 0 || stats?.lastUsedAt) && <span aria-hidden>{'·'}</span>}
                    {focusedSkill.manifest && !addingPath && (
                      <button
                        type="button"
                        onClick={() => setAddingPath(true)}
                        className="hover:text-muted-foreground/90 transition-colors cursor-pointer"
                      >
                        + Add path
                      </button>
                    )}
                    {focusedSkill.manifest && !addingPath && <span aria-hidden>{'·'}</span>}
                    <EditPopover
                      trigger={
                        <button type="button" className="inline-flex items-center gap-1 hover:text-muted-foreground/90 transition-colors cursor-pointer">
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                      }
                      {...getEditConfig('skill-metadata', focusedSkill.path)}
                      secondaryAction={{
                        label: 'Edit File',
                        filePath: `${focusedSkill.path}/SKILL.md`,
                      }}
                    />
                    <span aria-hidden>{'·'}</span>
                    <button
                      type="button"
                      onClick={handleImproveAgent}
                      className="inline-flex items-center gap-1 hover:text-muted-foreground/90 transition-colors cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      Improve
                    </button>
                    <span aria-hidden>{'·'}</span>
                    <button
                      type="button"
                      onClick={() => window.electronAPI.showInFolder(`${focusedSkill.path}/SKILL.md`)}
                      className="inline-flex items-center gap-1 hover:text-muted-foreground/90 transition-colors cursor-pointer"
                    >
                      <FolderOpen className="h-3 w-3" />
                      Open folder
                    </button>
                    <span aria-hidden>{'·'}</span>
                    <button
                      type="button"
                      onClick={() => setDeleteDialogOpen(true)}
                      className="inline-flex items-center gap-1 hover:text-destructive/70 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Inline icon picker */}
              {showIconPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 rounded-lg border border-border/60 bg-background p-2"
                >
                  <div className="grid grid-cols-8 gap-1">
                    {iconEntries.map(([name, Icon]) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => handleFocusedIconSelect(name)}
                        aria-label={`Select icon ${name}`}
                        title={name}
                        className={cn(
                          'flex items-center justify-center h-8 w-8 rounded-md transition-colors cursor-pointer',
                          (iconOverride ?? focusedSkill.manifest?.icon) === name
                            ? 'bg-foreground text-background'
                            : 'hover:bg-foreground/[0.08] text-foreground/70',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Quick commands — chip style */}
            <motion.div variants={itemVariants}>
                <h3 className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2.5">
                  {cmds.length > 0 ? 'Run a Task' : 'Start'}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {cmds.map((cmd) => (
                    <button key={cmd.name} type="button" onClick={() => handleQuickCommand(focusedSkill, cmd)} className={FOCUSED_CMD_CHIP}>
                      {getCommandIcon(cmd.name, 'h-4 w-4 opacity-70', cmd.icon)}{cmd.name}
                    </button>
                  ))}
                  <button type="button" onClick={() => handleSkillClick(focusedSkill)} className={cn(FOCUSED_CMD_CHIP, 'text-muted-foreground/60')}>
                    <Plus className="h-4 w-4 opacity-70" />New Chat
                  </button>
                </div>
            </motion.div>

            {/* Recent Sessions */}
            {recent.length > 0 && (
              <motion.div variants={itemVariants}>
                <div className="border-t border-border/20 pt-4 mb-2" />
                <h3 className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2">Recent</h3>
                <div className="space-y-0">
                  {recent.map((s) => (
                    <button key={s.id} type="button" onClick={() => navigate(routes.view.skills(focusedSkill.slug, s.id))}
                      className="w-full flex items-center gap-3 px-0 py-1.5 text-left hover:text-foreground transition-colors cursor-pointer group/recent">
                      <span className="flex-1 min-w-0 text-sm text-foreground/80 truncate group-hover/recent:text-foreground transition-colors">{s.name || 'Untitled'}</span>
                      {s.lastMessageAt && <span className="shrink-0 text-[11px] text-muted-foreground/50">{formatRelativeTime(s.lastMessageAt)}</span>}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </ScrollArea>
        <TemplateVariableModal
          open={pendingVarCommand !== null}
          onOpenChange={(open) => { if (!open) setPendingVarCommand(null) }}
          commandName={pendingVarCommand?.cmd.name ?? ''}
          promptTemplate={pendingVarCommand?.cmd.prompt ?? ''}
          variables={pendingVarCommand?.cmd.variables ?? []}
          onSubmit={handleVariableSubmit}
        />
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent showCloseButton={false} className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Delete {focusedSkill.metadata.name}?</DialogTitle>
              <DialogDescription>
                {isAgent(focusedSkill)
                  ? 'Choose whether to remove the agent configuration only or delete everything.'
                  : 'This will permanently delete the skill and all its files.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              {isAgent(focusedSkill) && (
                <button
                  type="button"
                  onClick={handleDemoteFocusedAgent}
                  className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-background hover:bg-foreground/[0.05] text-foreground transition-colors cursor-pointer"
                >
                  Remove Agent Only
                </button>
              )}
              <button
                type="button"
                onClick={handleDeleteFocusedAgent}
                className="h-8 px-3 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
              >
                Delete Everything
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // --- Main Agents Dashboard (mission control) ---
  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Agents" actions={headerActions} />
      <Separator />
      <ScrollArea className="flex-1">
        <div className="px-8 py-6 max-w-[640px] mx-auto space-y-6">
          {/* Greeting + Search */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-2.5">
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="text-2xl tracking-tight text-foreground" style={{ fontFamily: 'ui-serif, Georgia, "Times New Roman", serif', fontWeight: 500 }}>
                {getDynamicGreeting(userName || undefined)}
              </h2>
              <button type="button" onClick={() => navigate(routes.action.newSession())}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 decoration-foreground/20 hover:decoration-foreground/40 cursor-pointer">
                + New Chat
              </button>
            </div>
            {filteredAgents.length > 2 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <input type="text" placeholder="Search agents..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)} className={cn(INPUT_CLS, 'pl-9')} />
              </div>
            )}
          </motion.div>

          {/* Agent list */}
          {filteredAgents.length > 0 && (
            <motion.div className={gridCls} variants={containerVariants} initial="hidden" animate="visible">
              {filteredAgents.map((skill) => {
                const cmds = skill.manifest?.quick_commands ?? []
                const stats = skillStats.get(skill.slug)
                const count = stats?.sessionCount ?? 0
                const activity = getActivityStatus(stats?.lastUsedAt)
                const accent = getAccentColor(skill.slug)
                return (
                  <motion.div key={skill.slug} variants={itemVariants}
                    className="group py-4 first:pt-0">
                    <div className="flex items-start gap-3.5">
                      <button type="button" onClick={() => navigate(routes.view.skills(skill.slug))} className="shrink-0 mt-0.5 cursor-pointer">
                        <AgentIcon skill={skill} accent={accent} workspaceId={activeWorkspaceId ?? ''} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <button type="button" onClick={() => navigate(routes.view.skills(skill.slug))}
                            className="flex items-center gap-2 text-left rounded-md -mx-1.5 px-1.5 py-0.5 hover:bg-foreground/[0.04] transition-colors cursor-pointer group/title">
                            <span className="text-[13px] font-medium truncate">
                              {skill.metadata.name}
                            </span>
                            <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', ACTIVITY_DOT[activity])} />
                          </button>
                          <div className="shrink-0 flex items-center gap-1.5 text-[10px] text-muted-foreground/55">
                            {count > 0 && <span>{count} session{count !== 1 ? 's' : ''}</span>}
                            {count > 0 && stats?.lastUsedAt && <span aria-hidden>{'·'}</span>}
                            {stats?.lastUsedAt && <span>{formatRelativeTime(stats.lastUsedAt)}</span>}
                          </div>
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground/70 line-clamp-1 mt-0.5">{skill.metadata.description}</p>
                        <div className="flex flex-wrap items-center gap-x-0.5 gap-y-0.5 mt-2">
                          {cmds.slice(0, 4).map((cmd) => (
                            <button key={cmd.name} type="button" onClick={() => handleQuickCommand(skill, cmd)} className={CMD_CHIP}>
                              {getCommandIcon(cmd.name, 'h-3 w-3 opacity-70', cmd.icon)}{cmd.name}
                            </button>
                          ))}
                          {cmds.length > 4 && (
                            <button type="button" onClick={() => navigate(routes.view.skills(skill.slug))} className={cn(CMD_CHIP, 'text-muted-foreground/60')}>
                              +{cmds.length - 4} more
                            </button>
                          )}
                          <button type="button" onClick={() => handleSkillClick(skill)} className={cn(CMD_CHIP, 'text-muted-foreground/60')}>
                            <Plus className="h-3 w-3 opacity-70" />New Chat
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
              {/* Add Agent — last item in the list */}
              <motion.div variants={itemVariants} className="py-3">
                <button type="button" onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-3 rounded-md -mx-1.5 px-1.5 py-1.5 hover:bg-foreground/[0.04] transition-colors cursor-pointer">
                  <div className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md border border-dashed border-foreground/[0.12]">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </div>
                  <span className="text-[12px] text-muted-foreground/70">Add Agent</span>
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* Empty state — no agents configured */}
          {filteredSkills.length === 0 && skills.length === 0 && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="py-8 space-y-8"
            >
              {/* Hero section */}
              <motion.div variants={fadeIn} className="text-center space-y-3">
                <div className="flex items-center justify-center mx-auto h-14 w-14 rounded-2xl bg-foreground/[0.04] border border-border/40">
                  <Bot className="h-7 w-7 text-muted-foreground/60" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-medium text-foreground">Set up your first agent</h3>
                  <p className="text-[13px] text-muted-foreground/60 max-w-[360px] mx-auto leading-relaxed">
                    Agents are reusable instructions that give your AI specialized skills — like code review, writing docs, or debugging.
                  </p>
                </div>
              </motion.div>

              {/* Action cards */}
              <motion.div variants={itemVariants} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="w-full flex items-center gap-3.5 rounded-xl border border-border/60 bg-foreground/[0.02] px-4 py-3.5 text-left hover:bg-foreground/[0.05] hover:border-foreground/15 transition-all cursor-pointer group/card"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-foreground/[0.05] shrink-0">
                    <Plus className="h-4.5 w-4.5 text-muted-foreground/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-foreground">Browse agents</span>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Pick from agents already installed on your machine</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/card:text-muted-foreground/60 transition-colors shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setTemplateBrowserOpen(true)}
                  className="w-full flex items-center gap-3.5 rounded-xl border border-border/60 bg-foreground/[0.02] px-4 py-3.5 text-left hover:bg-foreground/[0.05] hover:border-foreground/15 transition-all cursor-pointer group/card"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-foreground/[0.05] shrink-0">
                    <LayoutGrid className="h-4.5 w-4.5 text-muted-foreground/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-foreground">Start from a template</span>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Pick from curated agent templates and customize them</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/card:text-muted-foreground/60 transition-colors shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={handleCreateAgentSession}
                  className="w-full flex items-center gap-3.5 rounded-xl border border-border/60 bg-foreground/[0.02] px-4 py-3.5 text-left hover:bg-foreground/[0.05] hover:border-foreground/15 transition-all cursor-pointer group/card"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-foreground/[0.05] shrink-0">
                    <Sparkles className="h-4.5 w-4.5 text-muted-foreground/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-foreground">Create a new agent</span>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Describe what you need and AI will build it for you</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/card:text-muted-foreground/60 transition-colors shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate(routes.action.newSession())}
                  className="w-full flex items-center gap-3.5 rounded-xl border border-border/60 bg-foreground/[0.02] px-4 py-3.5 text-left hover:bg-foreground/[0.05] hover:border-foreground/15 transition-all cursor-pointer group/card"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-foreground/[0.05] shrink-0">
                    <MessageSquare className="h-4.5 w-4.5 text-muted-foreground/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-foreground">Just start chatting</span>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Skip agents for now and open a free-form session</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/card:text-muted-foreground/60 transition-colors shrink-0" />
                </button>
              </motion.div>
            </motion.div>
          )}
          {filteredSkills.length === 0 && skills.length > 0 && (
            <motion.div
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center justify-center py-14 gap-4 text-center"
            >
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-foreground/[0.04] border border-border/40">
                <Settings2 className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No agents enabled</p>
                <p className="text-[13px] text-muted-foreground/50">
                  {(() => {
                    const agentCount = skills.filter(isAgent).length
                    const skillCount = skills.length - agentCount
                    const parts: string[] = []
                    if (agentCount > 0) parts.push(`${agentCount} agent${agentCount !== 1 ? 's' : ''}`)
                    if (skillCount > 0) parts.push(`${skillCount} skill${skillCount !== 1 ? 's' : ''} that can become agents`)
                    return `You have ${parts.join(' and ')} — pick which ones to show here.`
                  })()}
                </p>
              </div>
              <button type="button" onClick={() => setPickerOpen(true)}
                className={cn('inline-flex items-center gap-1.5 h-8 px-4 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer')}>
                Choose Agents
              </button>
            </motion.div>
          )}

          {/* Recent Sessions */}
          {recentGlobalSessions.length > 0 && filteredSkills.length > 0 && (
            <motion.div variants={fadeIn} initial="hidden" animate="visible" className="pt-4">
              <div className="border-t border-border/20 pt-4 mb-2" />
              <h3 className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2">Recent</h3>
              <div className="space-y-0">
                {recentGlobalSessions.map((session) => {
                  const sk = session.skillSlug ? skillBySlug.get(session.skillSlug) : null
                  return (
                    <button key={session.id} type="button"
                      onClick={() => { if (session.skillSlug) navigate(routes.view.skills(session.skillSlug, session.id)) }}
                      className="w-full flex items-center gap-3 px-0 py-1.5 text-left hover:text-foreground transition-colors cursor-pointer group/recent">
                      {sk && <span className="shrink-0 text-[10px] text-muted-foreground/60 w-20 truncate">{sk.metadata.name}</span>}
                      <span className="flex-1 min-w-0 text-[13px] text-foreground/80 truncate group-hover/recent:text-foreground transition-colors">{session.name || 'Untitled'}</span>
                      {session.lastMessageAt && <span className="shrink-0 text-[10px] text-muted-foreground/50">{formatRelativeTime(session.lastMessageAt)}</span>}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen}
        workspaceId={activeWorkspaceId ?? ''} enabledSlugs={enabledSlugs} onSave={handleSaveEnabledSlugs}
        onCreateAgent={handleCreateAgentSession}
        onBrowseTemplates={() => setTemplateBrowserOpen(true)}
        onPromoteWithAI={handlePromoteWithAI} />
      <AgentTemplateBrowser
        open={templateBrowserOpen}
        onOpenChange={setTemplateBrowserOpen}
        templates={agentTemplates}
        onCreateFromTemplate={handleCreateFromTemplate}
      />
      <TemplateVariableModal
        open={pendingVarCommand !== null}
        onOpenChange={(open) => { if (!open) setPendingVarCommand(null) }}
        commandName={pendingVarCommand?.cmd.name ?? ''}
        promptTemplate={pendingVarCommand?.cmd.prompt ?? ''}
        variables={pendingVarCommand?.cmd.variables ?? []}
        onSubmit={handleVariableSubmit}
      />
    </div>
  )
}
