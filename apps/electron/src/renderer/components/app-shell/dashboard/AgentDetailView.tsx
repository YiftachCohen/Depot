/**
 * AgentDetailView — focused agent view with full management UI.
 * Extracted from SkillDashboard.tsx (the `if (focusedSkill)` branch).
 */
import * as React from 'react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion } from 'motion/react'
import { FolderOpen, X, Pencil, Sparkles, Plus, Brain, Copy, MoreHorizontal, Database, Trash2, Zap, Play, Check, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getCommandIcon, ICON_NAME_MAP } from '@/lib/command-icon'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { PanelHeader } from '../PanelHeader'
import { TemplateVariableModal } from '../TemplateVariableModal'
import { AgentMemoryPanel } from '../AgentMemoryPanel'
import { KnowledgeBrowserPanel } from '../KnowledgeBrowserPanel'
import { navigate, routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import { isAgent } from '../../../../shared/types'
import type { LoadedSkill, QuickCommand, DepotSkillManifest } from '../../../../shared/types'
import { type AutomationListItem, type ExecutionEntry, type PromptAction } from '../../automations/types'
import { computeNextRuns, formatShortRelativeTime } from '../../automations/utils'
import {
  AgentIcon, getAccentColor, getActivityStatus, formatRelativeTime,
  ACTIVITY_DOT, OBSERVATION_HEALTH_DOT, FOCUSED_CMD_CHIP, PATH_BADGE,
  containerVariants, itemVariants, fadeIn,
} from './utils'
import type { SkillSessionStats, KnowledgeStats } from './utils'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AgentDetailViewProps {
  focusedSkill: LoadedSkill
  activeWorkspaceId: string | null
  agentStateMap: Map<string, import('@depot/shared/skills').AgentState>
  knowledgeStatsMap: Map<string, KnowledgeStats>
  skillStats: Map<string, SkillSessionStats>
  sessionMetaMap: Map<string, import('@/atoms/sessions').SessionMeta>
  allAutomations: AutomationListItem[]
  onCreateSession: (workspaceId: string, opts: any) => Promise<any>
  onSendMessage: (sessionId: string, message: string, files?: any, skillSlugs?: string[]) => void
  onTestAutomation?: (automationId: string) => void
  getAutomationHistory?: (automationId: string) => Promise<ExecutionEntry[]>
  onAgentStateRefresh: (slug: string) => void
  onQuickCommand: (skill: LoadedSkill, cmd: QuickCommand) => void
  onNewChat: (skill: LoadedSkill) => void
}

// ---------------------------------------------------------------------------
// AgentDetailView
// ---------------------------------------------------------------------------
export function AgentDetailView({
  focusedSkill,
  activeWorkspaceId,
  agentStateMap,
  knowledgeStatsMap,
  skillStats,
  sessionMetaMap,
  allAutomations,
  onCreateSession,
  onSendMessage,
  onTestAutomation,
  getAutomationHistory,
  onAgentStateRefresh,
  onQuickCommand,
  onNewChat,
}: AgentDetailViewProps) {
  const cmds = focusedSkill.manifest?.quick_commands ?? []
  const stats = skillStats.get(focusedSkill.slug)
  const count = stats?.sessionCount ?? 0
  const activity = getActivityStatus(stats?.lastUsedAt)
  const accent = getAccentColor(focusedSkill.slug)

  const recent = useMemo(() =>
    Array.from(sessionMetaMap.values())
      .filter(m => m.skillSlug === focusedSkill.slug)
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0)).slice(0, 5),
  [sessionMetaMap, focusedSkill.slug])

  // --- Local state ---
  const [iconOverride, setIconOverride] = useState<string | undefined>(undefined)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [focusedPaths, setFocusedPaths] = useState<string[]>([])
  const [addingPath, setAddingPath] = useState(false)
  const [newPathValue, setNewPathValue] = useState('')
  const [savingPath, setSavingPath] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingVarCommand, setPendingVarCommand] = useState<{ skill: LoadedSkill; cmd: QuickCommand } | null>(null)
  const latestManifestRef = useRef<DepotSkillManifest | null>(null)

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

  const handleDeleteFocusedAgent = useCallback(async () => {
    if (!activeWorkspaceId || !focusedSkill) return
    setDeleteDialogOpen(false)
    try {
      await window.electronAPI.deleteSkill(activeWorkspaceId, focusedSkill.slug)
      toast.success(`Deleted: ${focusedSkill.metadata.name}`)
      navigate(routes.view.skills())
    } catch (err) {
      toast.error('Failed to delete', { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, [activeWorkspaceId, focusedSkill])

  const handleDemoteFocusedAgent = useCallback(async () => {
    if (!activeWorkspaceId || !focusedSkill) return
    setDeleteDialogOpen(false)
    try {
      await window.electronAPI.demoteAgent(activeWorkspaceId, focusedSkill.slug)
      toast.success(`Removed agent configuration: ${focusedSkill.metadata.name}`)
    } catch (err) {
      toast.error('Failed to remove agent configuration', { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, [activeWorkspaceId, focusedSkill])

  const handleVariableSubmit = useCallback(async (resolvedPrompt: string) => {
    if (!activeWorkspaceId || !pendingVarCommand) return
    const { skill, cmd } = pendingVarCommand
    try {
      const session = await onCreateSession(activeWorkspaceId, {
        name: cmd.name, skillSlug: skill.slug,
        enabledSourceSlugs: skill.manifest?.sources ?? skill.metadata.requiredSources,
      })
      if (!session?.id) { toast.error('Failed to create session'); return }
      if (resolvedPrompt) onSendMessage(session.id, resolvedPrompt, undefined, [skill.slug])
      setPendingVarCommand(null)
      navigate(routes.view.skills(skill.slug, session.id))
    } catch (err) {
      toast.error('Failed to run command', { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, [activeWorkspaceId, pendingVarCommand, onCreateSession, onSendMessage])

  const handleDetailQuickCommand = useCallback((skill: LoadedSkill, cmd: QuickCommand) => {
    if (cmd.variables && cmd.variables.length > 0) {
      setPendingVarCommand({ skill, cmd })
    } else {
      onQuickCommand(skill, cmd)
    }
  }, [onQuickCommand])

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
          {/* Header */}
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
                <div className="flex items-center gap-2">
                  <span className="text-xl font-display truncate">{focusedSkill.metadata.name}</span>
                  <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', ACTIVITY_DOT[activity])} />
                </div>
                <p className="text-[13px] leading-relaxed text-foreground/60 line-clamp-2 mt-1">{focusedSkill.metadata.description}</p>

                {/* Personality + Memory + Knowledge + Permission indicators */}
                {focusedSkill.manifest && (focusedSkill.manifest.personality || focusedSkill.manifest.memory?.enabled || focusedSkill.manifest.permission_mode) && (
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-[11px] text-foreground/40">
                    {focusedSkill.manifest.personality && (
                      <span className="inline-flex items-center gap-1 italic line-clamp-1 max-w-full">
                        <Brain className="h-3 w-3 shrink-0" />{focusedSkill.manifest.personality}
                      </span>
                    )}
                    {(() => {
                      const agentState = agentStateMap.get(focusedSkill.slug)
                      const factCount = agentState?.memory?.facts?.length ?? 0
                      if (!focusedSkill.manifest?.memory?.enabled) return null
                      return <span className="inline-flex items-center gap-1"><Brain className="h-3 w-3 shrink-0" />{factCount > 0 ? `${factCount} fact${factCount !== 1 ? 's' : ''} in memory` : 'No memory yet'}</span>
                    })()}
                    {(() => {
                      const kStats = knowledgeStatsMap.get(focusedSkill.slug)
                      if (!focusedSkill.manifest?.knowledge?.enabled) return null
                      const healthColor = kStats?.observationHealth ?? 'gray'
                      const healthTitle = kStats?.lastObservation
                        ? `Last observation: ${new Date(kStats.lastObservation).toLocaleString()}`
                        : 'No observations yet'
                      if (!kStats || kStats.entityCount === 0) return (
                        <span className="inline-flex items-center gap-1">
                          <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', OBSERVATION_HEALTH_DOT[healthColor])} title={healthTitle} aria-label={`Observation health: ${healthColor}`} />
                          <Database className="h-3 w-3 shrink-0" />No knowledge yet
                        </span>
                      )
                      return (
                        <span className="inline-flex items-center gap-1">
                          <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', OBSERVATION_HEALTH_DOT[healthColor])} title={healthTitle} aria-label={`Observation health: ${healthColor}`} />
                          <Database className="h-3 w-3 shrink-0" />
                          {kStats.entityCount} entit{kStats.entityCount !== 1 ? 'ies' : 'y'}, {kStats.relationshipCount} relationship{kStats.relationshipCount !== 1 ? 's' : ''}
                        </span>
                      )
                    })()}
                    {focusedSkill.manifest.permission_mode && (
                      <span className={cn(
                        'inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-medium',
                        focusedSkill.manifest.permission_mode === 'safe' && 'bg-emerald-500/10 text-emerald-600',
                        focusedSkill.manifest.permission_mode === 'ask' && 'bg-amber-500/10 text-amber-600',
                        focusedSkill.manifest.permission_mode === 'allow-all' && 'bg-red-500/10 text-red-600',
                      )}>
                        {focusedSkill.manifest.permission_mode}
                      </span>
                    )}
                  </div>
                )}

                {/* Project paths */}
                {focusedSkill.manifest && (focusedPaths.length > 0 || addingPath) && (
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {focusedPaths.map((p, i) => (
                      <span key={i} className={PATH_BADGE}>
                        <FolderOpen className="h-2.5 w-2.5" />
                        <span className="truncate max-w-[180px]">{p}</span>
                        <button type="button" onClick={() => void handleRemovePath(i)} disabled={savingPath} aria-label={`Remove project path ${p}`} title="Remove project path"
                          className="opacity-0 group-hover/path:opacity-100 group-focus-within/path:opacity-100 focus-visible:opacity-100 transition-opacity rounded hover:text-destructive focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                    {addingPath && (
                      <span className="inline-flex items-center gap-1">
                        <input type="text" autoFocus placeholder="~/projects/my-app" value={newPathValue}
                          onChange={(e) => setNewPathValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void handleAddPath(); if (e.key === 'Escape') { setAddingPath(false); setNewPathValue('') } }}
                          onBlur={() => { if (!newPathValue.trim()) { setAddingPath(false); setNewPathValue('') } }}
                          className="h-5 px-1.5 text-[10px] font-mono rounded border border-border/60 bg-background w-36 focus:outline-none focus:ring-1 focus:ring-ring" />
                      </span>
                    )}
                  </div>
                )}

                {/* Meta line */}
                <div className="flex items-center gap-1.5 mt-2 text-xs text-foreground/45">
                  {count > 0 && <span>{count} session{count !== 1 ? 's' : ''}</span>}
                  {count > 0 && stats?.lastUsedAt && <span aria-hidden>{'·'}</span>}
                  {stats?.lastUsedAt && <span>{formatRelativeTime(stats.lastUsedAt)}</span>}
                  {(count > 0 || stats?.lastUsedAt) && <span aria-hidden>{'·'}</span>}
                  {focusedSkill.manifest && !addingPath && (
                    <>
                      <button type="button" onClick={() => setAddingPath(true)}
                        className="text-foreground/50 hover:text-foreground/80 transition-colors cursor-pointer">+ Add path</button>
                      <span aria-hidden>{'·'}</span>
                    </>
                  )}
                  <EditPopover
                    trigger={<button type="button" className="inline-flex items-center gap-1 text-foreground/50 hover:text-foreground/80 transition-colors cursor-pointer"><Pencil className="h-3 w-3" />Edit</button>}
                    {...getEditConfig('skill-metadata', focusedSkill.path)}
                    secondaryAction={{ label: 'Edit File', filePath: `${focusedSkill.path}/SKILL.md` }}
                  />
                  <span aria-hidden>{'·'}</span>
                  <button type="button" onClick={handleImproveAgent} className="inline-flex items-center gap-1 text-foreground/50 hover:text-foreground/80 transition-colors cursor-pointer">
                    <Sparkles className="h-3 w-3" />Improve
                  </button>
                  <span aria-hidden>{'·'}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="inline-flex items-center text-foreground/50 hover:text-foreground/80 transition-colors cursor-pointer rounded p-0.5 hover:bg-foreground/[0.06]">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[160px]">
                      <DropdownMenuItem onClick={() => window.electronAPI.showInFolder(`${focusedSkill.path}/SKILL.md`)}>
                        <FolderOpen className="h-3.5 w-3.5 mr-2" />Open folder
                      </DropdownMenuItem>
                      {focusedSkill.manifest && (
                        <DropdownMenuItem onClick={async () => {
                          try {
                            const content = await window.electronAPI.readFile(`${focusedSkill.path}/depot.yaml`)
                            await navigator.clipboard.writeText(content)
                            toast.success('Copied depot.yaml to clipboard')
                          } catch { toast.error('Failed to copy depot.yaml') }
                        }}>
                          <Copy className="h-3.5 w-3.5 mr-2" />Export depot.yaml
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            {/* Inline icon picker */}
            {showIconPicker && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-lg border border-border/60 bg-background p-2">
                <div className="grid grid-cols-8 gap-1">
                  {iconEntries.map(([name, Icon]) => (
                    <button key={name} type="button" onClick={() => handleFocusedIconSelect(name)} aria-label={`Select icon ${name}`} title={name}
                      className={cn('flex items-center justify-center h-8 w-8 rounded-md transition-colors cursor-pointer',
                        (iconOverride ?? focusedSkill.manifest?.icon) === name ? 'bg-foreground text-background' : 'hover:bg-foreground/[0.08] text-foreground/70')}>
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Quick commands */}
          <motion.div variants={itemVariants}>
            <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-widest mb-2.5">
              {cmds.length > 0 ? 'Run a Task' : 'Start'}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {cmds.map((cmd) => (
                <button key={cmd.name} type="button" onClick={() => handleDetailQuickCommand(focusedSkill, cmd)} className={FOCUSED_CMD_CHIP}>
                  {getCommandIcon(cmd.name, 'h-4 w-4 opacity-70', cmd.icon)}{cmd.name}
                </button>
              ))}
              <button type="button" onClick={() => onNewChat(focusedSkill)} className={cn(FOCUSED_CMD_CHIP, 'text-foreground/45')}>
                <Plus className="h-4 w-4 opacity-70" />New Chat
              </button>
            </div>
          </motion.div>

          {/* Agent Automations */}
          <motion.div variants={itemVariants}>
            <div className="border-t border-border/20 pt-4 mb-2" />
            <AgentAutomationsSection
              skillSlug={focusedSkill.slug}
              skillPath={focusedSkill.path}
              automations={allAutomations}
              onTest={onTestAutomation}
              getHistory={getAutomationHistory}
            />
          </motion.div>

          {/* Knowledge Browser */}
          {focusedSkill.manifest?.knowledge?.enabled && activeWorkspaceId && (
            <motion.div variants={itemVariants}>
              <div className="border-t border-border/20 pt-4 mb-2" />
              <KnowledgeBrowserPanel workspaceId={activeWorkspaceId} skillSlug={focusedSkill.slug} onBack={() => {}} />
            </motion.div>
          )}

          {/* Agent Memory */}
          {focusedSkill.manifest?.memory?.enabled !== false && agentStateMap.has(focusedSkill.slug) && activeWorkspaceId && (
            <motion.div variants={itemVariants}>
              <div className="border-t border-border/20 pt-4 mb-2" />
              <AgentMemoryPanel
                workspaceId={activeWorkspaceId}
                skillSlug={focusedSkill.slug}
                facts={agentStateMap.get(focusedSkill.slug)?.memory?.facts ?? []}
                onFactsChanged={() => onAgentStateRefresh(focusedSkill.slug)}
              />
            </motion.div>
          )}

          {/* Recent Sessions */}
          {recent.length > 0 && (
            <motion.div variants={itemVariants}>
              <div className="border-t border-border/20 pt-4 mb-2" />
              <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-widest mb-2">Recent</h3>
              <div className="space-y-0">
                {recent.map((s) => (
                  <button key={s.id} type="button" onClick={() => navigate(routes.view.skills(focusedSkill.slug, s.id))}
                    className="w-full flex items-center gap-3 px-0 py-1.5 text-left hover:text-foreground transition-colors cursor-pointer group/recent">
                    <span className="flex-1 min-w-0 text-sm text-foreground/85 truncate group-hover/recent:text-foreground transition-colors">{s.name || 'Untitled'}</span>
                    {s.lastMessageAt && <span className="shrink-0 text-[11px] text-foreground/35">{formatRelativeTime(s.lastMessageAt)}</span>}
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
              <button type="button" onClick={handleDemoteFocusedAgent}
                className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-background hover:bg-foreground/[0.05] text-foreground transition-colors cursor-pointer">
                Remove Agent Only
              </button>
            )}
            <button type="button" onClick={handleDeleteFocusedAgent}
              className="h-8 px-3 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer">
              Delete Everything
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AgentAutomationsSection — enhanced automation cards
// ---------------------------------------------------------------------------

const STATUS_ICON: Record<string, { icon: typeof Check; cls: string }> = {
  success: { icon: Check, cls: 'text-green-600' },
  error: { icon: XCircle, cls: 'text-red-600' },
  blocked: { icon: AlertTriangle, cls: 'text-yellow-600' },
}

interface AgentAutomationsSectionProps {
  skillSlug: string
  skillPath: string
  automations: AutomationListItem[]
  onTest?: (automationId: string) => void
  getHistory?: (automationId: string) => Promise<ExecutionEntry[]>
}

function AgentAutomationsSection({ skillSlug, skillPath, automations, onTest, getHistory }: AgentAutomationsSectionProps) {
  const [historyMap, setHistoryMap] = useState<Record<string, ExecutionEntry[]>>({})
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())

  const agentAutomations = useMemo(() => {
    return automations.filter(a => {
      if (a.skillSlug === skillSlug) return true
      if (a.source !== 'skill' && !a.skillSlug) {
        return a.actions.some(action => {
          if (action.type !== 'prompt') return false
          const prompt = (action as PromptAction).prompt
          const idx = prompt.indexOf(`@${skillSlug}`)
          if (idx === -1) return false
          const after = prompt[idx + skillSlug.length + 1]
          return after === undefined || /\W/.test(after)
        })
      }
      return false
    })
  }, [automations, skillSlug])

  const autoIds = agentAutomations.map(a => a.id).join(',')
  useEffect(() => {
    if (!getHistory || agentAutomations.length === 0) return
    let stale = false
    const fetchAll = async () => {
      const results = await Promise.allSettled(
        agentAutomations.map(async (auto) => {
          const history = await getHistory(auto.id)
          return { id: auto.id, entries: history.slice(0, 2) }
        }),
      )
      if (stale) return
      const entries: Record<string, ExecutionEntry[]> = {}
      for (const r of results) {
        if (r.status === 'fulfilled') entries[r.value.id] = r.value.entries
      }
      setHistoryMap(entries)
    }
    fetchAll()
    const cleanup = window.electronAPI.onAutomationsChanged?.(() => { if (!stale) fetchAll() })
    return () => { stale = true; cleanup?.() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoIds, getHistory])

  const handleRun = useCallback((automationId: string, name: string) => {
    if (!onTest || runningIds.has(automationId)) return
    setRunningIds(prev => new Set(prev).add(automationId))
    try {
      onTest(automationId)
      toast(`Running: ${name}`, { description: 'Automation triggered' })
    } catch { toast.error(`Failed to trigger: ${name}`) }
    setTimeout(() => {
      setRunningIds(prev => { const next = new Set(prev); next.delete(automationId); return next })
    }, 3000)
  }, [onTest, runningIds])

  return (
    <>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-widest">
          Automations{agentAutomations.length > 0 && ` (${agentAutomations.length})`}
        </h3>
        <EditPopover
          trigger={<button type="button" className="inline-flex items-center gap-1 text-[11px] text-foreground/40 hover:text-foreground/70 transition-colors cursor-pointer"><Plus className="h-3 w-3" />Add</button>}
          {...getEditConfig('skill-automation', skillPath)}
        />
      </div>
      {agentAutomations.length === 0 ? (
        <div className="flex items-center gap-2 text-[11px] text-foreground/30 italic">
          <Zap className="h-3.5 w-3.5 text-foreground/15" />No automations configured for this agent.
        </div>
      ) : (
        <div className="space-y-2.5">
          {agentAutomations.map((auto) => {
            const entries = historyMap[auto.id] ?? []
            const isWorkspace = auto.source !== 'skill' && !auto.skillSlug
            const isRunning = runningIds.has(auto.id)
            const nextRuns = auto.cron ? computeNextRuns(auto.cron, 1) : []
            const nextRun = nextRuns[0]
            return (
              <div key={auto.id} className="group">
                <div role="button" tabIndex={0}
                  onClick={() => navigate(routes.view.automations({ automationId: auto.id }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(routes.view.automations({ automationId: auto.id })) } }}
                  aria-label={`View ${auto.name} automation`}
                  className="w-full flex items-center gap-2 text-[12px] text-left rounded-md -mx-1 px-1 py-1 hover:bg-foreground/[0.03] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50">
                  <Zap className={cn('h-3 w-3 shrink-0', auto.enabled ? 'text-amber-500' : 'text-foreground/20')} />
                  <span className={cn('min-w-0 truncate font-medium', !auto.enabled && 'text-foreground/40 line-through')}>{auto.name}</span>
                  {isWorkspace && <span className="shrink-0 text-[9px] text-stone-400 bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded-full leading-none">workspace</span>}
                  <span className={cn('shrink-0 inline-block h-1.5 w-1.5 rounded-full', auto.enabled ? 'bg-green-600' : 'bg-stone-400')} />
                  {auto.lastExecutedAt && (
                    <span className="shrink-0 text-[10px] text-foreground/30">
                      {formatShortRelativeTime(auto.lastExecutedAt)}
                      {entries[0] && <span className={cn('ml-0.5', STATUS_ICON[entries[0].status]?.cls)}>{entries[0].status === 'success' ? '✓' : entries[0].status === 'error' ? '✗' : '⚠'}</span>}
                    </span>
                  )}
                  {nextRun && <span className="shrink-0 text-[10px] text-foreground/20">→ {nextRun.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
                  <span className="flex-1" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleRun(auto.id, auto.name) }} disabled={isRunning} aria-label={`Run ${auto.name}`}
                    className={cn('shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity', 'p-0.5 rounded hover:bg-foreground/[0.08]', 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50', 'disabled:opacity-50')}>
                    {isRunning ? <Loader2 className="h-3 w-3 text-amber-500 animate-spin" /> : <Play className="h-3 w-3 text-foreground/40" />}
                  </button>
                </div>
                {entries.length > 0 && (
                  <div className="ml-5 mt-0.5 space-y-0.5">
                    {entries.map((entry) => {
                      const statusCfg = STATUS_ICON[entry.status] ?? STATUS_ICON.error
                      const StatusIcon = statusCfg.icon
                      return (
                        <button key={entry.id} type="button"
                          onClick={() => { if (entry.sessionId) navigate(routes.view.skills(skillSlug, entry.sessionId)) }}
                          disabled={!entry.sessionId}
                          className={cn('flex items-center gap-1.5 text-[11px] w-full text-left rounded py-0.5 px-1 -mx-1',
                            entry.sessionId && 'hover:bg-foreground/[0.03] cursor-pointer', !entry.sessionId && 'cursor-default',
                            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50')}
                          aria-label={entry.sessionId ? `Open session for ${auto.name} execution` : undefined}>
                          <StatusIcon className={cn('h-2.5 w-2.5 shrink-0', statusCfg.cls)} />
                          <span className="text-foreground/35">{formatShortRelativeTime(entry.timestamp)}</span>
                          {entry.actionSummary && (
                            <span className={cn('flex-1 min-w-0 truncate', entry.status === 'error' ? 'text-red-500/70' : 'text-foreground/25')}>
                              {entry.actionSummary.length > 50 ? entry.actionSummary.slice(0, 50) + '…' : entry.actionSummary}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
