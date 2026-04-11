/**
 * AgentDetailView — Two-column "Living Dossier" layout orchestrator.
 *
 * Left: AgentProfileColumn (280px sticky rail)
 * Right: Scrollable content cards ordered by page mode
 *
 * Responsive: below 720px collapses to single column.
 */
import * as React from 'react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { Variants } from 'motion/react'
import { cn } from '@/lib/utils'
import { navigate, routes } from '@/lib/navigate'
import { PanelHeader } from '../PanelHeader'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TemplateVariableModal } from '../TemplateVariableModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { RenameDialog } from '@/components/ui/rename-dialog'

import { AgentProfileColumn } from './AgentProfileColumn'
import { getAccentColor, formatRelativeTime } from './utils'
import { AgentPromptBar } from './AgentPromptBar'
import { AgentHandoffCard } from './AgentHandoffCard'
import { AgentActivityTimeline } from './AgentActivityTimeline'
import { KnowledgeStoryCard } from './KnowledgeStoryCard'
import { determinePageMode } from './types'
import type { AgentPageMode, KnowledgeStatsData, SkillSessionStats } from './types'

import type { LoadedSkill, QuickCommand, DepotSkillManifest } from '../../../../shared/types'
import { isAgent } from '../../../../shared/types'
import type { AgentState, ObservationRun } from '@depot/shared/skills'
import type { FileAttachment } from '@depot/shared/protocol'
import type { AutomationListItem, ExecutionEntry, PromptAction } from '../../automations/types'

// ---------------------------------------------------------------------------
// Animation variants (from SkillDashboard, with reduced-motion support)
// ---------------------------------------------------------------------------
const containerVariants: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}
const noMotionVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AgentDetailViewProps {
  focusedSkill: LoadedSkill
  activeWorkspaceId: string
  skillStats: Map<string, SkillSessionStats>
  agentStateMap: Map<string, AgentState>
  setAgentStateMap?: React.Dispatch<React.SetStateAction<Map<string, AgentState>>>
  knowledgeStatsMap: Map<string, KnowledgeStatsData>
  allAutomations: AutomationListItem[]
  sessionMetaMap: Map<string, { id: string; name?: string; lastMessageAt?: number; skillSlug?: string }>

  // Handlers
  onCreateSession: (workspaceId: string, opts: {
    name?: string; skillSlug?: string; enabledSourceSlugs?: string[]
  }) => Promise<{ id: string } | undefined>
  onSendMessage: (sessionId: string, prompt: string, attachments?: FileAttachment[], skillSlugs?: string[]) => void
  onTestAutomation?: (automationId: string) => void
  onToggleAutomation?: (automationId: string) => void
  onDeleteAutomation?: (automationId: string) => void
  getAutomationHistory?: (automationId: string) => Promise<ExecutionEntry[]>
  onAgentStateRefresh?: (slug: string) => void
  onQuickCommand?: (skill: LoadedSkill, cmd: QuickCommand) => void
  onNewChat?: (skill: LoadedSkill) => void
}

export function AgentDetailView({
  focusedSkill,
  activeWorkspaceId,
  skillStats,
  agentStateMap,
  setAgentStateMap,
  knowledgeStatsMap,
  allAutomations,
  sessionMetaMap,
  onCreateSession,
  onSendMessage,
  onTestAutomation,
  onToggleAutomation,
  onDeleteAutomation,
  getAutomationHistory,
  onAgentStateRefresh,
}: AgentDetailViewProps) {
  const prefersReducedMotion = useReducedMotion() ?? false
  const containerRef = useRef<HTMLDivElement>(null)
  const [isNarrow, setIsNarrow] = useState(false)

  // Responsive: measure container width
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 720)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Derived data
  const agentState = agentStateMap.get(focusedSkill.slug)
  const knowledgeStats = knowledgeStatsMap.get(focusedSkill.slug)
  const stats = skillStats.get(focusedSkill.slug)
  const cmds = focusedSkill.manifest?.quick_commands ?? []

  // Agent automations for this skill
  const agentAutomations = useMemo(() => {
    return allAutomations.filter(a => {
      if (a.skillSlug === focusedSkill.slug) return true
      if (a.source !== 'skill' && !a.skillSlug) {
        return a.actions.some(action => {
          if (action.type !== 'prompt') return false
          const prompt = (action as PromptAction).prompt
          const idx = prompt.indexOf(`@${focusedSkill.slug}`)
          if (idx === -1) return false
          const after = prompt[idx + focusedSkill.slug.length + 1]
          return after === undefined || /\W/.test(after)
        })
      }
      return false
    })
  }, [allAutomations, focusedSkill.slug])

  // Page mode
  const pageMode = useMemo(
    () => determinePageMode(focusedSkill, agentState, agentAutomations, stats?.sessionCount ?? 0),
    [focusedSkill, agentState, agentAutomations, stats?.sessionCount],
  )

  // Recent sessions for this agent
  const recentSessions = useMemo(
    () => Array.from(sessionMetaMap.values())
      .filter(m => m.skillSlug === focusedSkill.slug)
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
      .slice(0, 5),
    [sessionMetaMap, focusedSkill.slug],
  )

  // Observation history (loaded per focused skill)
  const [observationHistory, setObservationHistory] = useState<ObservationRun[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [automationHistory, setAutomationHistory] = useState<ExecutionEntry[]>([])

  const loadTimelineData = useCallback(async () => {
    setTimelineLoading(true)
    setTimelineError(null)
    try {
      const [historyResult, autoHistoryResults] = await Promise.all([
        window.electronAPI.getObservationHistory(activeWorkspaceId, focusedSkill.slug).catch(() => []),
        // Fetch automation history for timeline
        Promise.all(
          agentAutomations.slice(0, 5).map(async (auto) => {
            try {
              const entries = getAutomationHistory ? await getAutomationHistory(auto.id) : []
              return entries.slice(0, 3)
            } catch { return [] }
          }),
        ),
      ])
      setObservationHistory(historyResult ?? [])
      setAutomationHistory(autoHistoryResults.flat())
    } catch {
      setTimelineError('Couldn\'t load activity')
    } finally {
      setTimelineLoading(false)
    }
  }, [activeWorkspaceId, focusedSkill.slug, agentAutomations, getAutomationHistory])

  useEffect(() => { loadTimelineData() }, [loadTimelineData])

  // Icon picker state
  const [iconOverride, setIconOverride] = useState<string | undefined>(undefined)
  const [showIconPicker, setShowIconPicker] = useState(false)

  // Path state
  const [focusedPaths, setFocusedPaths] = useState<string[]>([])
  const [addingPath, setAddingPath] = useState(false)
  const [newPathValue, setNewPathValue] = useState('')
  const [savingPath, setSavingPath] = useState(false)
  const latestManifestRef = useRef<DepotSkillManifest | null>(null)

  useEffect(() => { if (!showIconPicker) setIconOverride(undefined) }, [focusedSkill?.manifest?.icon])
  useEffect(() => { if (!addingPath) setFocusedPaths(focusedSkill?.manifest?.project_paths ?? []) }, [focusedSkill?.manifest?.project_paths])
  useEffect(() => { latestManifestRef.current = focusedSkill?.manifest ?? null }, [focusedSkill?.slug, focusedSkill?.manifest])

  // Template variable modal
  const [pendingVarCommand, setPendingVarCommand] = useState<{ skill: LoadedSkill; cmd: QuickCommand } | null>(null)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Rename dialog
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')

  // --- Manifest save helper ---
  const saveFocusedManifest = useCallback(async (updates: Partial<DepotSkillManifest>): Promise<boolean> => {
    if (!focusedSkill?.manifest) return false
    setSavingPath(true)
    try {
      const baseManifest = latestManifestRef.current ?? focusedSkill.manifest
      const updated: DepotSkillManifest = { ...baseManifest, ...updates }
      await window.electronAPI.promoteSkillToAgent(activeWorkspaceId, focusedSkill.slug, updated)
      latestManifestRef.current = updated
      return true
    } catch (err) {
      const { toast } = await import('sonner')
      toast.error('Failed to save', { description: err instanceof Error ? err.message : 'Unknown error' })
      return false
    } finally { setSavingPath(false) }
  }, [focusedSkill, activeWorkspaceId])

  // --- Handlers ---
  const handleSourcesChange = useCallback(async (slugs: string[]) => {
    await saveFocusedManifest({ sources: slugs })
  }, [saveFocusedManifest])

  const handleRenameStart = useCallback(() => {
    setRenameName(focusedSkill.manifest?.name ?? focusedSkill.metadata.name)
    setRenameOpen(true)
  }, [focusedSkill])

  const handleRenameSubmit = useCallback(async () => {
    const trimmed = renameName.trim()
    if (!trimmed) return
    const saved = await saveFocusedManifest({ name: trimmed })
    if (saved) setRenameOpen(false)
  }, [renameName, saveFocusedManifest])

  const handleColorChange = useCallback(async (color: string) => {
    await saveFocusedManifest({ color })
  }, [saveFocusedManifest])

  const handleModelChange = useCallback(async (modelId: string) => {
    await saveFocusedManifest({ model: modelId || undefined })
  }, [saveFocusedManifest])

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

  const handleQuickCommand = useCallback(async (skill: LoadedSkill, cmd: QuickCommand) => {
    if (cmd.variables && cmd.variables.length > 0) {
      setPendingVarCommand({ skill, cmd })
      return
    }
    const session = await onCreateSession(activeWorkspaceId, {
      name: cmd.name,
      skillSlug: skill.slug,
      enabledSourceSlugs: skill.manifest?.sources ?? skill.metadata.requiredSources,
    })
    if (session?.id && cmd.prompt) onSendMessage(session.id, cmd.prompt, undefined, [skill.slug])
    if (session?.id) navigate(routes.view.skills(skill.slug, session.id))
  }, [activeWorkspaceId, onCreateSession, onSendMessage])

  const handleVariableSubmit = useCallback(async (resolvedPrompt: string) => {
    if (!pendingVarCommand) return
    const { skill, cmd } = pendingVarCommand
    try {
      const session = await onCreateSession(activeWorkspaceId, {
        name: cmd.name,
        skillSlug: skill.slug,
        enabledSourceSlugs: skill.manifest?.sources ?? skill.metadata.requiredSources,
      })
      if (!session?.id) {
        const { toast } = await import('sonner')
        toast.error('Failed to create session')
        return
      }
      if (resolvedPrompt) onSendMessage(session.id, resolvedPrompt, undefined, [skill.slug])
      setPendingVarCommand(null)
      navigate(routes.view.skills(skill.slug, session.id))
    } catch (err) {
      const { toast } = await import('sonner')
      toast.error('Failed to run command', { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, [activeWorkspaceId, pendingVarCommand, onCreateSession, onSendMessage])

  const handleNewChat = useCallback(async () => {
    const session = await onCreateSession(activeWorkspaceId, {
      skillSlug: focusedSkill.slug,
      enabledSourceSlugs: focusedSkill.manifest?.sources ?? focusedSkill.metadata.requiredSources,
    })
    if (session?.id) navigate(routes.view.skills(focusedSkill.slug, session.id))
  }, [activeWorkspaceId, focusedSkill, onCreateSession])

  const handlePromptSubmit = useCallback(async (prompt: string) => {
    const session = await onCreateSession(activeWorkspaceId, {
      skillSlug: focusedSkill.slug,
      enabledSourceSlugs: focusedSkill.manifest?.sources ?? focusedSkill.metadata.requiredSources,
    })
    if (session?.id) {
      onSendMessage(session.id, prompt, undefined, [focusedSkill.slug])
      navigate(routes.view.skills(focusedSkill.slug, session.id))
    }
  }, [activeWorkspaceId, focusedSkill, onCreateSession, onSendMessage])

  const handleImproveAgent = useCallback(async () => {
    const session = await onCreateSession(activeWorkspaceId, {
      name: `Improve ${focusedSkill.metadata.name}`,
      skillSlug: focusedSkill.slug,
    })
    if (session?.id) {
      const prompt = `I want to improve the "${focusedSkill.metadata.name}" agent. Its SKILL.md is at: ${focusedSkill.path}/SKILL.md\n\nPlease read it, then help me refine it \u2014 better instructions, more useful quick commands, clearer description. Show me what you'd change and why.`
      onSendMessage(session.id, prompt, undefined, [focusedSkill.slug])
      navigate(routes.view.skills(focusedSkill.slug, session.id))
    }
  }, [activeWorkspaceId, focusedSkill, onCreateSession, onSendMessage])

  const handleDeleteAgent = useCallback(async () => {
    setDeleteDialogOpen(false)
    try {
      await window.electronAPI.deleteSkill(activeWorkspaceId, focusedSkill.slug)
      const { toast } = await import('sonner')
      toast.success(`Deleted: ${focusedSkill.metadata.name}`)
      navigate(routes.view.skills())
    } catch (err) {
      const { toast } = await import('sonner')
      toast.error('Failed to delete', { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, [activeWorkspaceId, focusedSkill])

  const handleDemoteAgent = useCallback(async () => {
    setDeleteDialogOpen(false)
    try {
      await window.electronAPI.demoteAgent(activeWorkspaceId, focusedSkill.slug)
      const { toast } = await import('sonner')
      toast.success(`Removed agent configuration: ${focusedSkill.metadata.name}`)
    } catch (err) {
      const { toast } = await import('sonner')
      toast.error('Failed to remove agent configuration', { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, [activeWorkspaceId, focusedSkill])

  const handleFactsChanged = useCallback(() => {
    if (onAgentStateRefresh) {
      onAgentStateRefresh(focusedSkill.slug)
      return
    }
    if (!activeWorkspaceId || !setAgentStateMap) return
    window.electronAPI.getAgentState(activeWorkspaceId, focusedSkill.slug)
      .then((state) => {
        setAgentStateMap((prev) => {
          const next = new Map(prev)
          if (state) next.set(focusedSkill.slug, state)
          else next.delete(focusedSkill.slug)
          return next
        })
      }).catch(() => {})
  }, [activeWorkspaceId, focusedSkill.slug, setAgentStateMap, onAgentStateRefresh])

  // Choose animation variants
  const cVariants = prefersReducedMotion ? noMotionVariants : containerVariants
  const iVariants = prefersReducedMotion ? noMotionVariants : itemVariants

  // --- Render ---
  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      <PanelHeader title={focusedSkill.metadata.name} />
      <Separator />

      <ScrollArea className="flex-1">
        <div className="max-w-[960px] mx-auto">
          {/* Full-width Prompt Bar — above both columns */}
          <div className={cn('pl-4 pt-4', isNarrow ? 'pr-4 pb-3' : 'pr-[calc((100%_-_260px_-_580px)_/_2_+_24px)] pb-4')}>
            <AgentPromptBar
              skill={focusedSkill}
              onSubmitPrompt={handlePromptSubmit}
              onQuickCommand={handleQuickCommand}
            />
          </div>

          {/* Two-column layout */}
          <div className={cn('flex', isNarrow ? 'flex-col' : 'flex-row')}>
            {/* Left Rail — Profile Column */}
            <div className={cn(
              isNarrow
                ? 'w-full'
                : 'w-[260px] shrink-0 sticky top-0 self-start h-[calc(100vh-130px)] overflow-y-auto',
            )}>
              <AgentProfileColumn
                skill={focusedSkill}
                workspaceId={activeWorkspaceId}
                agentState={agentState}
                knowledgeStats={knowledgeStats}
                stats={stats}
                pageMode={pageMode}
                collapsed={isNarrow}
                showIconPicker={showIconPicker}
                onToggleIconPicker={() => setShowIconPicker(v => !v)}
                iconOverride={iconOverride}
                onIconSelect={handleFocusedIconSelect}
                focusedPaths={focusedPaths}
                addingPath={addingPath}
                setAddingPath={setAddingPath}
                newPathValue={newPathValue}
                setNewPathValue={setNewPathValue}
                savingPath={savingPath}
                onAddPath={handleAddPath}
                onRemovePath={handleRemovePath}
                onQuickCommand={handleQuickCommand}
                onNewChat={handleNewChat}
                onImprove={handleImproveAgent}
                onDelete={() => setDeleteDialogOpen(true)}
                onPermissionModeChange={(mode) => void saveFocusedManifest({ permission_mode: mode as 'safe' | 'ask' | 'allow-all' })}
                onSourcesChange={handleSourcesChange}
                onColorChange={handleColorChange}
                onModelChange={handleModelChange}
                onRenameStart={handleRenameStart}
                agentAutomations={agentAutomations}
                allAutomations={allAutomations}
                onTestAutomation={onTestAutomation}
                onToggleAutomation={onToggleAutomation}
                onDeleteAutomation={onDeleteAutomation}
                getAutomationHistory={getAutomationHistory}
                lastSession={recentSessions[0] ?? null}
                skillSlug={focusedSkill.slug}
              />
            </div>

            {/* Right Column — Content Cards */}
            <div className={cn(
              'flex-1 min-w-0 flex justify-center',
              isNarrow ? 'px-4 py-4' : 'py-4',
            )}>
              <motion.div
                className="w-full max-w-[580px] space-y-5 px-6"
                variants={cVariants}
                initial="hidden"
                animate="visible"
              >
                {renderContentCards({
                  pageMode,
                  focusedSkill,
                  activeWorkspaceId,
                  agentState,
                  knowledgeStats,
                  observationHistory,
                  recentSessions,
                  agentAutomations,
                  allAutomations,
                  automationHistory,
                  agentStateMap,
                  timelineLoading,
                  timelineError,
                  loadTimelineData,
                  handleNewChat,
                  onTestAutomation,
                  onToggleAutomation,
                  onDeleteAutomation,
                  getAutomationHistory,
                  prefersReducedMotion,
                  iVariants,
                })}
              </motion.div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Template Variable Modal */}
      <TemplateVariableModal
        open={pendingVarCommand !== null}
        onOpenChange={(open) => { if (!open) setPendingVarCommand(null) }}
        commandName={pendingVarCommand?.cmd.name ?? ''}
        promptTemplate={pendingVarCommand?.cmd.prompt ?? ''}
        variables={pendingVarCommand?.cmd.variables ?? []}
        onSubmit={handleVariableSubmit}
      />

      {/* Rename Dialog */}
      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename Agent"
        value={renameName}
        onValueChange={setRenameName}
        onSubmit={handleRenameSubmit}
        placeholder="Agent name..."
      />

      {/* Delete Dialog */}
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
                onClick={handleDemoteAgent}
                className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-background hover:bg-foreground/[0.05] text-foreground transition-colors cursor-pointer"
              >
                Remove Agent Only
              </button>
            )}
            <button
              type="button"
              onClick={handleDeleteAgent}
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

// ---------------------------------------------------------------------------
// Content card ordering by page mode
// ---------------------------------------------------------------------------
function renderContentCards(ctx: {
  pageMode: AgentPageMode
  focusedSkill: LoadedSkill
  activeWorkspaceId: string
  agentState: AgentState | undefined
  knowledgeStats: KnowledgeStatsData | undefined
  observationHistory: ObservationRun[]
  recentSessions: Array<{ id: string; name?: string; lastMessageAt?: number; skillSlug?: string; messageCount?: number }>
  agentAutomations: AutomationListItem[]
  allAutomations: AutomationListItem[]
  automationHistory: ExecutionEntry[]
  agentStateMap: Map<string, AgentState>
  timelineLoading: boolean
  timelineError: string | null
  loadTimelineData: () => void
  handleNewChat: () => void
  onTestAutomation?: (automationId: string) => void
  onToggleAutomation?: (automationId: string) => void
  onDeleteAutomation?: (automationId: string) => void
  getAutomationHistory?: (automationId: string) => Promise<ExecutionEntry[]>
  prefersReducedMotion: boolean
  iVariants: Variants
}): React.ReactNode[] {
  const cards: React.ReactNode[] = []
  const M = motion.div

  // 1. Handoff card (always first)
  cards.push(
    <M key="handoff" variants={ctx.iVariants}>
      <AgentHandoffCard
        mode={ctx.pageMode}
        observationHistory={ctx.observationHistory}
        knowledgeStats={ctx.knowledgeStats}
        agentState={ctx.agentState}
        recentSessions={ctx.recentSessions}
        automations={ctx.agentAutomations}
        onNewChat={ctx.handleNewChat}
        reducedMotion={ctx.prefersReducedMotion}
      />
    </M>,
  )

  // 2. Activity Timeline (always)
  cards.push(
    <M key="timeline" variants={ctx.iVariants}>
      <AgentActivityTimeline
        skillSlug={ctx.focusedSkill.slug}
        observationHistory={ctx.observationHistory}
        recentSessions={ctx.recentSessions}
        memoryFacts={ctx.agentState?.memory?.facts ?? []}
        automationHistory={ctx.automationHistory}
        loading={ctx.timelineLoading}
        error={ctx.timelineError}
        onRetry={ctx.loadTimelineData}
        onNewChat={ctx.handleNewChat}
      />
    </M>,
  )

  // 3. Knowledge Story (knowledge-enabled mode only)
  if (ctx.focusedSkill.manifest?.knowledge?.enabled) {
    cards.push(
      <M key="knowledge" variants={ctx.iVariants}>
        <KnowledgeStoryCard
          workspaceId={ctx.activeWorkspaceId}
          skillSlug={ctx.focusedSkill.slug}
          knowledgeStats={ctx.knowledgeStats}
          reducedMotion={ctx.prefersReducedMotion}
        />
      </M>,
    )
  }

  // Automations are now shown exclusively in the left profile column.

  return cards
}
