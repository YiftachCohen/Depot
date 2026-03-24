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
import { Plus, Settings2, Search, Sparkles, Bot, MessageSquare, ArrowRight, LayoutGrid } from 'lucide-react'
import { toast } from 'sonner'
import { TeamHealthBar } from './dashboard/TeamHealthBar'
import { AgentGrid } from './dashboard/AgentGrid'
import { ActivityFeed } from './dashboard/ActivityFeed'
import { AgentDetailView } from './dashboard/AgentDetailView'
import { skillsAtom } from '@/atoms/skills'
import { sessionMetaMapAtom } from '@/atoms/sessions'
import { automationsAtom } from '@/atoms/automations'
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
memory:
  enabled: true
knowledge:
  enabled: true
  domains:
    - "general"
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
// Helpers — canonical definitions in dashboard/utils.tsx
// ---------------------------------------------------------------------------
import { getAccentColor, getActivityStatus, formatRelativeTime } from './dashboard/utils'
import type { SkillSessionStats } from './dashboard/utils'
export { getAccentColor, formatRelativeTime }
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

const INPUT_CLS = cn(
  'w-full h-8 px-3 text-sm rounded-md bg-background border border-border/60',
  'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring',
)

// ---------------------------------------------------------------------------
// SkillDashboard
// ---------------------------------------------------------------------------
export function SkillDashboard({ focusedSkillSlug }: { focusedSkillSlug?: string } = {}) {
  const skills = useAtomValue(skillsAtom)
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const allAutomations = useAtomValue(automationsAtom)
  const { activeWorkspaceId, onCreateSession, onSendMessage, onEnabledSkillSlugsChange, onTestAutomation, getAutomationHistory } = useAppShellContext()
  const [searchQuery, setSearchQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [enabledSlugs, setEnabledSlugs] = useState<string[] | undefined>(undefined)
  const [userName, setUserName] = useState('')
  const previousSkillSlugsRef = useRef<Set<string>>(new Set())
  const hasInitializedSkillFilterRef = useRef(false)
  const [pendingVarCommand, setPendingVarCommand] = useState<{ skill: LoadedSkill; cmd: QuickCommand } | null>(null)
  const [templateBrowserOpen, setTemplateBrowserOpen] = useState(false)
  const [agentTemplates, setAgentTemplates] = useState<AgentTemplate[]>([])
  const [agentStateMap, setAgentStateMap] = useState<Map<string, import('@depot/shared/skills').AgentState>>(new Map())
  const [knowledgeStatsMap, setKnowledgeStatsMap] = useState<Map<string, { entityCount: number; relationshipCount: number; patternCount: number; lastObservation: number | null; observationHealth: 'green' | 'yellow' | 'red' | 'gray' }>>(new Map())
  const [observationsToday, setObservationsToday] = useState<number | null>(null)
  const [selectedAgentSlug, setSelectedAgentSlug] = useState<string | null>(null)

  // Load templates on mount
  useEffect(() => {
    window.electronAPI.getAgentTemplates()
      .then(setAgentTemplates)
      .catch((err) => {
        console.error('Failed to load agent templates:', err)
      })
  }, [])

  // Load agent states for all agent skills + subscribe to changes
  useEffect(() => {
    if (!activeWorkspaceId) return
    const agents = skills.filter(isAgent)
    if (agents.length === 0) return

    // Batch-load agent states
    Promise.all(agents.map(async (s) => {
      try {
        const state = await window.electronAPI.getAgentState(activeWorkspaceId, s.slug)
        return [s.slug, state] as const
      } catch { return [s.slug, null] as const }
    })).then((entries) => {
      const map = new Map<string, import('@depot/shared/skills').AgentState>()
      for (const [slug, state] of entries) {
        if (state) map.set(slug, state)
      }
      setAgentStateMap(map)
    })

    // Batch-load knowledge stats for knowledge-enabled agents
    const knowledgeAgents = agents.filter(s => s.manifest?.knowledge?.enabled)
    if (knowledgeAgents.length > 0) {
      Promise.all(knowledgeAgents.map(async (s) => {
        try {
          const stats = await window.electronAPI.getKnowledgeStats(activeWorkspaceId, s.slug)
          return [s.slug, stats] as const
        } catch { return [s.slug, null] as const }
      })).then((entries) => {
        const map = new Map<string, { entityCount: number; relationshipCount: number; patternCount: number; lastObservation: number | null; observationHealth: 'green' | 'yellow' | 'red' | 'gray' }>()
        for (const [slug, stats] of entries) {
          if (stats) map.set(slug, { ...stats, observationHealth: (stats.observationHealth ?? 'gray') as 'green' | 'yellow' | 'red' | 'gray' })
        }
        setKnowledgeStatsMap(map)
      })

      // Compute observations today from observation history
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayMs = todayStart.getTime()
      Promise.all(knowledgeAgents.map(async (s) => {
        try {
          const history = await window.electronAPI.getObservationHistory(activeWorkspaceId, s.slug)
          return history.filter(h => h.timestamp >= todayMs).length
        } catch { return 0 }
      })).then((counts) => {
        setObservationsToday(counts.reduce((a, b) => a + b, 0))
      })
    }

    // Subscribe to changes
    const unsubscribe = window.electronAPI.onAgentStateChanged(({ skillSlug }) => {
      window.electronAPI.getAgentState(activeWorkspaceId, skillSlug)
        .then((state) => {
          setAgentStateMap((prev) => {
            const next = new Map(prev)
            if (state) next.set(skillSlug, state)
            else next.delete(skillSlug)
            return next
          })
        }).catch(() => {})
      // Also refresh knowledge stats for this agent
      const isKnowledgeAgent = agents.find(s => s.slug === skillSlug)?.manifest?.knowledge?.enabled
      if (isKnowledgeAgent) {
        window.electronAPI.getKnowledgeStats(activeWorkspaceId, skillSlug)
          .then((stats) => {
            setKnowledgeStatsMap((prev) => {
              const next = new Map(prev)
              if (stats) next.set(skillSlug, { ...stats, observationHealth: (stats.observationHealth ?? 'gray') as 'green' | 'yellow' | 'red' | 'gray' })
              else next.delete(skillSlug)
              return next
            })
          }).catch(() => {})
      }
    })
    return unsubscribe
  }, [activeWorkspaceId, skills])

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

  // Count automations per skill (for dashboard badges)
  const skillAutomationCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const automation of allAutomations) {
      if (automation.skillSlug) {
        counts.set(automation.skillSlug, (counts.get(automation.skillSlug) ?? 0) + 1)
      }
    }
    return counts
  }, [allAutomations])

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

  // Total enabled agents (before search filtering) — used for search visibility
  const totalAgentCount = useMemo(() => {
    let base = skills
    if (enabledSlugs) {
      const set = new Set(enabledSlugs)
      base = skills.filter((s) => set.has(s.slug))
    }
    return base.filter(isAgent).length
  }, [skills, enabledSlugs])

  // Sort agents by most recently used
  const sortedAgents = useMemo(() => {
    return [...filteredAgents].sort((a, b) => {
      const aTime = skillStats.get(a.slug)?.lastUsedAt ?? 0
      const bTime = skillStats.get(b.slug)?.lastUsedAt ?? 0
      return bTime - aTime
    })
  }, [filteredAgents, skillStats])

  // Accent color map — stable per agent slug
  const accentMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of filteredAgents) map.set(s.slug, getAccentColor(s.slug))
    return map
  }, [filteredAgents])

  // Auto-select first agent if none selected or selection is no longer valid
  useEffect(() => {
    if (sortedAgents.length > 0 && (!selectedAgentSlug || !sortedAgents.some(s => s.slug === selectedAgentSlug))) {
      setSelectedAgentSlug(sortedAgents[0].slug)
    }
  }, [sortedAgents, selectedAgentSlug])

  // Sessions scoped to selected agent
  const selectedAgentSessions = useMemo(() => {
    if (!selectedAgentSlug) return []
    return Array.from(sessionMetaMap.values())
      .filter(m => m.skillSlug === selectedAgentSlug)
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
      .slice(0, 10)
  }, [sessionMetaMap, selectedAgentSlug])

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
      <button type="button" onClick={() => setPickerOpen(true)} aria-label="Manage Agents"
        className="p-1.5 rounded-md hover:bg-foreground/[0.05] transition-colors cursor-pointer" title="Manage Agents">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  )

  const ACTION_BTN = cn(
    'inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground/60',
    'rounded-md px-2.5 py-1.5',
    'hover:bg-foreground/[0.05] hover:text-foreground/80 transition-colors cursor-pointer',
    'focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none',
  )

  // --- Team Health Bar metrics (computed before conditional returns) ---
  const activeCount = useMemo(() => {
    return filteredAgents.filter(s => getActivityStatus(skillStats.get(s.slug)?.lastUsedAt) === 'active').length
  }, [filteredAgents, skillStats])

  const totalEntities = useMemo(() => {
    let total = 0
    for (const stats of knowledgeStatsMap.values()) total += stats.entityCount
    return total
  }, [knowledgeStatsMap])

  const isStatsLoading = filteredAgents.length > 0 && agentStateMap.size === 0

  const enabledSlugsSet = useMemo(() => new Set(filteredAgents.map(s => s.slug)), [filteredAgents])
  const filteredRecentSessions = useMemo(() =>
    recentGlobalSessions.filter(s => s.skillSlug && enabledSlugsSet.has(s.skillSlug)),
  [recentGlobalSessions, enabledSlugsSet])

  // --- Focused Agent View ---
  const focusedSkill = focusedSkillSlug ? skills.find(s => s.slug === focusedSkillSlug) : null

  const handleAgentStateRefresh = useCallback((slug: string) => {
    if (!activeWorkspaceId) return
    window.electronAPI.getAgentState(activeWorkspaceId, slug)
      .then((state) => {
        setAgentStateMap((prev) => {
          const next = new Map(prev)
          if (state) next.set(slug, state)
          else next.delete(slug)
          return next
        })
      }).catch(() => {})
  }, [activeWorkspaceId])

  if (focusedSkill) {
    return (
      <AgentDetailView
        focusedSkill={focusedSkill}
        activeWorkspaceId={activeWorkspaceId}
        agentStateMap={agentStateMap}
        knowledgeStatsMap={knowledgeStatsMap}
        skillStats={skillStats}
        sessionMetaMap={sessionMetaMap}
        allAutomations={allAutomations}
        onCreateSession={onCreateSession}
        onSendMessage={onSendMessage}
        onTestAutomation={onTestAutomation}
        getAutomationHistory={getAutomationHistory}
        onAgentStateRefresh={handleAgentStateRefresh}
        onQuickCommand={handleQuickCommand}
        onNewChat={handleSkillClick}
      />
    )
  }

  // --- Main Agents Dashboard (Team Overview) ---
  const hasAgents = sortedAgents.length > 0

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Agents" actions={headerActions} />
      <Separator />
      <ScrollArea className="flex-1">
        <div className="px-8 py-6 max-w-[960px] mx-auto space-y-6">

          {/* Team Health Bar + Actions row — stays visible during search */}
          {totalAgentCount > 0 && (
            <div className="flex items-center justify-between gap-4">
              <TeamHealthBar
                agentCount={sortedAgents.length}
                activeCount={activeCount}
                observationsToday={observationsToday}
                totalEntities={totalEntities}
                isLoading={isStatsLoading}
              />
              <div className="flex items-center gap-0.5 shrink-0">
                <button type="button" onClick={() => setTemplateBrowserOpen(true)} className={ACTION_BTN}>
                  <LayoutGrid className="h-3.5 w-3.5" />Templates
                </button>
                <button type="button" onClick={handleCreateAgentSession} className={ACTION_BTN}>
                  <Sparkles className="h-3.5 w-3.5" />Create
                </button>
                <button type="button" onClick={() => setPickerOpen(true)} className={ACTION_BTN}>
                  <Plus className="h-3.5 w-3.5" />Add
                </button>
              </div>
            </div>
          )}

          {/* Search — only when more than 2 agents (uses pre-filter count so it stays visible during search) */}
          {totalAgentCount > 2 && (
            <motion.div variants={fadeIn} initial="hidden" animate="visible">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <input type="text" placeholder="Search agents..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)} className={cn(INPUT_CLS, 'pl-9')} />
              </div>
            </motion.div>
          )}

          {/* Agent Grid */}
          {(hasAgents || searchQuery.trim()) && (
            <AgentGrid
              agents={sortedAgents}
              activeWorkspaceId={activeWorkspaceId ?? ''}
              skillStats={skillStats}
              agentStateMap={agentStateMap}
              knowledgeStatsMap={knowledgeStatsMap}
              skillAutomationCounts={skillAutomationCounts}
              isStatsLoading={isStatsLoading}
              searchQuery={searchQuery}
              onNavigateToAgent={(slug) => navigate(routes.view.skills(slug))}
              onQuickCommand={handleQuickCommand}
              onNewChat={handleSkillClick}
              onAddAgent={() => setPickerOpen(true)}
            />
          )}

          {/* Empty state — no agents configured */}
          {filteredSkills.length === 0 && skills.length === 0 && !searchQuery.trim() && (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="py-8 space-y-8">
              <motion.div variants={fadeIn} className="space-y-3">
                <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-foreground/[0.04] border border-border/40">
                  <Bot className="h-7 w-7 text-muted-foreground/60" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-medium text-foreground">Set up your first agent</h3>
                  <p className="text-[13px] text-muted-foreground/60 max-w-[360px] leading-relaxed">
                    Agents are reusable instructions that give your AI specialized skills — like code review, writing docs, or debugging.
                  </p>
                </div>
              </motion.div>
              <motion.div variants={itemVariants} className="space-y-2">
                <button type="button" onClick={() => setPickerOpen(true)}
                  className="w-full flex items-center gap-3.5 rounded-[10px] border border-border/60 bg-foreground/[0.02] px-4 py-3.5 text-left hover:bg-foreground/[0.05] hover:border-foreground/15 transition-all cursor-pointer group/card">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-foreground/[0.05] shrink-0"><Plus className="h-4.5 w-4.5 text-muted-foreground/70" /></div>
                  <div className="flex-1 min-w-0"><span className="text-[13px] font-medium text-foreground">Browse agents</span><p className="text-[11px] text-muted-foreground/50 mt-0.5">Pick from agents already installed on your machine</p></div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/card:text-muted-foreground/60 transition-colors shrink-0" />
                </button>
                <button type="button" onClick={() => setTemplateBrowserOpen(true)}
                  className="w-full flex items-center gap-3.5 rounded-[10px] border border-border/60 bg-foreground/[0.02] px-4 py-3.5 text-left hover:bg-foreground/[0.05] hover:border-foreground/15 transition-all cursor-pointer group/card">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-foreground/[0.05] shrink-0"><LayoutGrid className="h-4.5 w-4.5 text-muted-foreground/70" /></div>
                  <div className="flex-1 min-w-0"><span className="text-[13px] font-medium text-foreground">Start from a template</span><p className="text-[11px] text-muted-foreground/50 mt-0.5">Pick from curated agent templates and customize them</p></div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/card:text-muted-foreground/60 transition-colors shrink-0" />
                </button>
                <button type="button" onClick={handleCreateAgentSession}
                  className="w-full flex items-center gap-3.5 rounded-[10px] border border-border/60 bg-foreground/[0.02] px-4 py-3.5 text-left hover:bg-foreground/[0.05] hover:border-foreground/15 transition-all cursor-pointer group/card">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-foreground/[0.05] shrink-0"><Sparkles className="h-4.5 w-4.5 text-muted-foreground/70" /></div>
                  <div className="flex-1 min-w-0"><span className="text-[13px] font-medium text-foreground">Create a new agent</span><p className="text-[11px] text-muted-foreground/50 mt-0.5">Describe what you need and AI will build it for you</p></div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/card:text-muted-foreground/60 transition-colors shrink-0" />
                </button>
                <button type="button" onClick={() => navigate(routes.action.newSession())}
                  className="w-full flex items-center gap-3.5 rounded-[10px] border border-border/60 bg-foreground/[0.02] px-4 py-3.5 text-left hover:bg-foreground/[0.05] hover:border-foreground/15 transition-all cursor-pointer group/card">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-foreground/[0.05] shrink-0"><MessageSquare className="h-4.5 w-4.5 text-muted-foreground/70" /></div>
                  <div className="flex-1 min-w-0"><span className="text-[13px] font-medium text-foreground">Just start chatting</span><p className="text-[11px] text-muted-foreground/50 mt-0.5">Skip agents for now and open a free-form session</p></div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/card:text-muted-foreground/60 transition-colors shrink-0" />
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* No agents enabled (but skills exist) — don't show during active search */}
          {filteredSkills.length === 0 && skills.length > 0 && !searchQuery.trim() && (
            <motion.div variants={fadeIn} initial="hidden" animate="visible"
              className="flex flex-col items-start gap-4 py-14">
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

          {/* Activity Feed */}
          {totalAgentCount > 0 && (
            <ActivityFeed
              sessions={filteredRecentSessions}
              skillMap={skillBySlug}
              onNavigate={(skillSlug, sessionId) => navigate(routes.view.skills(skillSlug, sessionId))}
            />
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
