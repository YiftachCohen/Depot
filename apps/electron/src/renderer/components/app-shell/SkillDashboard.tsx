/**
 * SkillDashboard - Mission-control style landing view for workspace skills.
 *
 * Renders a responsive grid of agent cards with launchable quick-command buttons,
 * a greeting header, recent sessions feed, and agent management actions.
 */
import * as React from 'react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { Zap, Plus, Settings2, Search } from 'lucide-react'
import { skillsAtom } from '@/atoms/skills'
import { sessionMetaMapAtom } from '@/atoms/sessions'
import { SkillAvatar } from '@/components/ui/skill-avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { PanelHeader } from './PanelHeader'
import { SkillPicker } from './SkillPicker'
import { useAppShellContext } from '@/context/AppShellContext'
import { navigate, routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import { isAgent } from '../../../shared/types'
import type { LoadedSkill, QuickCommand } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ACCENT_PALETTE = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#6366f1']

export function getAccentColor(slug: string): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length]
}
function accentToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}
function getActivityStatus(lastUsedAt?: number): 'active' | 'recent' | 'idle' {
  if (!lastUsedAt) return 'idle'
  const diff = Date.now() - lastUsedAt
  return diff < 3600_000 ? 'active' : diff < 86400_000 ? 'recent' : 'idle'
}
function formatRelativeTime(epochMs: number): string {
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
function getGreeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
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

// Shared class strings — command buttons
const cmdBase = 'inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-150'
const CMD_BTN = cn(cmdBase, 'bg-foreground/[0.04] hover:bg-foreground/[0.10] text-foreground/70')
const CMD_BTN_NEW = cn(cmdBase, 'bg-transparent border border-dashed border-foreground/[0.12] hover:bg-foreground/[0.04] text-foreground/50')
const FOCUSED_ACTION_BTN = cn(
  'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all',
  'border border-border/60 bg-background hover:bg-foreground/[0.03]',
  'hover:border-foreground/20 shadow-minimal hover:shadow-sm',
)
const INPUT_CLS = cn(
  'w-full h-8 px-3 text-sm rounded-md bg-background border border-border/60',
  'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring',
)

interface SkillSessionStats { sessionCount: number; lastUsedAt?: number }
const ACTIVITY_DOT: Record<string, string> = { active: 'bg-success', recent: 'bg-info', idle: 'bg-foreground/20' }

// ---------------------------------------------------------------------------
// SkillDashboard
// ---------------------------------------------------------------------------
export function SkillDashboard({ focusedSkillSlug }: { focusedSkillSlug?: string } = {}) {
  const skills = useAtomValue(skillsAtom)
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const { activeWorkspaceId, onCreateSession, onSendMessage } = useAppShellContext()
  const [searchQuery, setSearchQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [enabledSlugs, setEnabledSlugs] = useState<string[] | undefined>(undefined)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI.getWorkspaceSettings(activeWorkspaceId)
      .then((ws) => setEnabledSlugs(ws?.enabledSkillSlugs)).catch(() => {})
  }, [activeWorkspaceId])

  useEffect(() => {
    window.electronAPI.readPreferences()
      .then(({ content }) => {
        try { const prefs = JSON.parse(content); if (prefs.name) setUserName(prefs.name) } catch {}
      }).catch(() => {})
  }, [])

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
    if (enabledSlugs && enabledSlugs.length > 0) {
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
    const session = await onCreateSession(activeWorkspaceId, {
      name: cmd.name, skillSlug: skill.slug,
      enabledSourceSlugs: skill.manifest?.sources ?? skill.metadata.requiredSources,
    })
    if (session?.id && cmd.prompt) onSendMessage(session.id, cmd.prompt, undefined, [skill.slug])
    if (session?.id) navigate(routes.view.skills(skill.slug, session.id))
  }, [activeWorkspaceId, onCreateSession, onSendMessage])

  const handleSkillClick = useCallback(async (skill: LoadedSkill) => {
    if (!activeWorkspaceId) return
    const session = await onCreateSession(activeWorkspaceId, {
      skillSlug: skill.slug,
      enabledSourceSlugs: skill.manifest?.sources ?? skill.metadata.requiredSources,
    })
    if (session?.id) navigate(routes.view.skills(skill.slug, session.id))
  }, [activeWorkspaceId, onCreateSession])

  const handleSaveEnabledSlugs = useCallback((slugs: string[]) => {
    if (!activeWorkspaceId) return
    const value = slugs.length === 0 ? undefined : slugs
    setEnabledSlugs(value)
    window.electronAPI.updateWorkspaceSetting(activeWorkspaceId, 'enabledSkillSlugs', value)
      .catch((err: unknown) => console.error('Failed to save enabledSkillSlugs:', err))
  }, [activeWorkspaceId])

  const handleCreateSkill = useCallback(async () => {
    if (!createName.trim()) return
    const slug = createName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!slug) return
    setCreating(true)
    try {
      await window.electronAPI.createSkill(slug, createName.trim(), createDesc.trim())
      if (activeWorkspaceId && enabledSlugs && enabledSlugs.length > 0) {
        const updated = [...enabledSlugs, slug]
        setEnabledSlugs(updated)
        await window.electronAPI.updateWorkspaceSetting(activeWorkspaceId, 'enabledSkillSlugs', updated)
      }
      setCreateName(''); setCreateDesc(''); setShowCreateForm(false)
    } catch (err) { console.error('Failed to create skill:', err) }
    finally { setCreating(false) }
  }, [createName, createDesc, activeWorkspaceId, enabledSlugs])

  const headerActions = (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => setShowCreateForm((v) => !v)}
        className="p-1.5 rounded-md hover:bg-foreground/[0.05] transition-colors" title="Create Agent">
        <Plus className="h-4 w-4 text-muted-foreground" />
      </button>
      <button type="button" onClick={() => setPickerOpen(true)}
        className="p-1.5 rounded-md hover:bg-foreground/[0.05] transition-colors" title="Manage Agents">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  )

  const gridCls = filteredAgents.length <= 2
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'

  // --- Focused Agent View ---
  const focusedSkill = focusedSkillSlug ? skills.find(s => s.slug === focusedSkillSlug) : null
  if (focusedSkill) {
    const cmds = focusedSkill.manifest?.quick_commands ?? []
    const stats = skillStats.get(focusedSkill.slug)
    const recent = Array.from(sessionMetaMap.values())
      .filter(m => m.skillSlug === focusedSkill.slug)
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0)).slice(0, 5)
    return (
      <div className="flex flex-col h-full">
        <PanelHeader title={focusedSkill.metadata.name} />
        <Separator />
        <ScrollArea className="flex-1">
          <div className="px-6 py-6 max-w-2xl mx-auto space-y-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0"><SkillAvatar skill={focusedSkill} size="lg" workspaceId={activeWorkspaceId ?? ''} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mt-1">{focusedSkill.metadata.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/70">
                  {stats && stats.sessionCount > 0 && <span>{stats.sessionCount} session{stats.sessionCount !== 1 ? 's' : ''}</span>}
                  {stats?.lastUsedAt && <span>Last used {formatRelativeTime(stats.lastUsedAt)}</span>}
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {cmds.length > 0 ? 'Run a Task' : 'Start'}
              </h3>
              <div className="space-y-2">
                {cmds.length > 0 ? cmds.map((cmd) => (
                  <button key={cmd.name} type="button" onClick={() => handleQuickCommand(focusedSkill, cmd)} className={FOCUSED_ACTION_BTN}>
                    <div className="flex items-center justify-center h-8 w-8 rounded-md bg-foreground/[0.05] shrink-0">
                      <Zap className="h-4 w-4 text-foreground/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{cmd.name}</span>
                      {cmd.prompt && <p className="text-xs text-muted-foreground truncate mt-0.5">{cmd.prompt.slice(0, 80)}{cmd.prompt.length > 80 ? '...' : ''}</p>}
                    </div>
                  </button>
                )) : (
                  <button type="button" onClick={() => handleSkillClick(focusedSkill)} className={FOCUSED_ACTION_BTN}>
                    <div className="flex items-center justify-center h-8 w-8 rounded-md bg-foreground/[0.05] shrink-0">
                      <Zap className="h-4 w-4 text-foreground/70" />
                    </div>
                    <span className="text-sm font-medium">New Chat</span>
                  </button>
                )}
              </div>
            </div>
            {recent.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Recent Sessions</h3>
                <div className="space-y-1">
                  {recent.map((s) => (
                    <button key={s.id} type="button" onClick={() => navigate(routes.view.skills(focusedSkill.slug, s.id))}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-foreground/[0.03]">
                      <span className="flex-1 min-w-0 text-sm truncate">{s.name || 'Untitled'}</span>
                      {s.lastMessageAt && <span className="text-[10px] text-muted-foreground/60 shrink-0">{formatRelativeTime(s.lastMessageAt)}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // --- Main Agents Dashboard (mission control) ---
  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Agents" actions={headerActions} />
      <Separator />
      <ScrollArea className="flex-1">
        <div className="px-6 py-5 max-w-[900px] mx-auto space-y-5">
          {/* Greeting + Search */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-medium text-foreground/80">
                {getGreeting()}{userName ? `, ${userName}` : ''}
              </h2>
              <button type="button" onClick={() => navigate(routes.action.newSession())}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 decoration-foreground/20 hover:decoration-foreground/40">
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

          {/* Inline create form */}
          {showCreateForm && (
            <div className="border border-border/60 rounded-xl p-4 space-y-2 bg-foreground/[0.02]">
              <input type="text" placeholder="Agent name" value={createName} onChange={(e) => setCreateName(e.target.value)} autoFocus className={INPUT_CLS} />
              <input type="text" placeholder="What does this agent do?" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} className={INPUT_CLS} />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => { setShowCreateForm(false); setCreateName(''); setCreateDesc('') }}
                  className="h-7 px-3 text-xs font-medium rounded-md hover:bg-foreground/[0.05] transition-colors">Cancel</button>
                <button type="button" disabled={!createName.trim() || creating} onClick={handleCreateSkill}
                  className={cn('h-7 px-3 text-xs font-medium rounded-md transition-colors bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:pointer-events-none')}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* Agent cards grid */}
          {filteredAgents.length > 0 && (
            <motion.div className={gridCls} variants={containerVariants} initial="hidden" animate="visible">
              {filteredAgents.map((skill) => {
                const cmds = skill.manifest?.quick_commands ?? []
                const stats = skillStats.get(skill.slug)
                const count = stats?.sessionCount ?? 0
                const accent = getAccentColor(skill.slug)
                const rgb = accentToRgb(accent)
                const activity = getActivityStatus(stats?.lastUsedAt)
                return (
                  <motion.div key={skill.slug} variants={itemVariants}
                    className="group relative flex flex-col rounded-xl bg-background hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                    style={{
                      boxShadow: `rgba(${rgb}, 0.20) 0px 0px 0px 1px, rgba(${rgb}, 0.07) 0px 2px 6px -1px, rgba(${rgb}, 0.04) 0px 8px 12px -3px`,
                      background: `linear-gradient(to bottom, rgba(${rgb}, 0.03) 0%, rgba(${rgb}, 0) 40%)`,
                    }}>
                    <div className="flex flex-col flex-1 p-3.5 gap-2.5">
                      <button type="button" onClick={() => navigate(routes.view.skills(skill.slug))} className="flex items-start gap-2.5 text-left">
                        <div className="shrink-0 mt-0.5"><SkillAvatar skill={skill} size="md" workspaceId={activeWorkspaceId ?? ''} /></div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold truncate flex items-center gap-1.5">
                            {skill.metadata.name}
                            <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', ACTIVITY_DOT[activity])} />
                          </span>
                          <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2 mt-0.5">{skill.metadata.description}</p>
                        </div>
                      </button>
                      <div className="flex flex-wrap gap-1">
                        {cmds.map((cmd, i) => (
                          <button key={cmd.name} type="button" onClick={() => handleQuickCommand(skill, cmd)}
                            className={i === 0 ? cn(cmdBase, 'text-white/90 hover:brightness-110') : CMD_BTN}
                            style={i === 0 ? { backgroundColor: accent } : undefined}>
                            <Zap className="h-3 w-3" />{cmd.name}
                          </button>
                        ))}
                        <button type="button" onClick={() => handleSkillClick(skill)} className={CMD_BTN_NEW}>
                          <Plus className="h-3 w-3" />New Chat
                        </button>
                      </div>
                      {(count > 0 || stats?.lastUsedAt) && (
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 mt-auto">
                          {count > 0 && <span>{count} session{count !== 1 ? 's' : ''}</span>}
                          {count > 0 && stats?.lastUsedAt && <span aria-hidden>{'·'}</span>}
                          {stats?.lastUsedAt && <span>{formatRelativeTime(stats.lastUsedAt)}</span>}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}

          {/* Add Agent — compact inline action */}
          {filteredAgents.length > 0 && (
            <motion.div variants={fadeIn} initial="hidden" animate="visible">
              <button type="button" onClick={() => setPickerOpen(true)} className={cn(
                'group/add w-full flex items-center justify-center gap-2 py-2.5 rounded-lg',
                'border border-dashed border-border/50 hover:border-foreground/15',
                'hover:bg-foreground/[0.02] transition-all duration-200',
              )}>
                <Plus className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200 group-hover/add:scale-110" />
                <span className="text-xs font-medium text-muted-foreground/60">Add Agent</span>
              </button>
            </motion.div>
          )}

          {/* Empty states */}
          {filteredSkills.length === 0 && skills.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-foreground/[0.04]">
                <Zap className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No agents configured</p>
              <p className="text-xs text-muted-foreground">Agents are reusable instructions that teach your AI specialized behaviors.</p>
              <button type="button" onClick={() => navigate(routes.view.settings('workspace'))}
                className={cn('inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-lg bg-background shadow-minimal hover:bg-foreground/[0.03] transition-colors')}>
                <Plus className="h-3.5 w-3.5" />Add Agents
              </button>
            </div>
          )}
          {filteredSkills.length === 0 && skills.length > 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <p className="text-sm text-muted-foreground">No agents enabled yet.</p>
              <button type="button" onClick={() => setPickerOpen(true)}
                className={cn('inline-flex items-center gap-1.5 h-8 px-4 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors')}>
                Choose Agents
              </button>
            </div>
          )}

          {/* Recent Sessions */}
          {recentGlobalSessions.length > 0 && filteredSkills.length > 0 && (
            <motion.div variants={fadeIn} initial="hidden" animate="visible">
              <h3 className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2">Recent</h3>
              <div className="rounded-lg border border-border/30 overflow-hidden divide-y divide-border/20">
                {recentGlobalSessions.map((session) => {
                  const sk = session.skillSlug ? skillBySlug.get(session.skillSlug) : null
                  const accent = session.skillSlug ? getAccentColor(session.skillSlug) : '#6b7280'
                  return (
                    <button key={session.id} type="button"
                      onClick={() => { if (session.skillSlug) navigate(routes.view.skills(session.skillSlug, session.id)) }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-foreground/[0.02] transition-colors border-l-2"
                      style={{ borderLeftColor: accent }}>
                      {sk && <span className="shrink-0 text-[10px] font-medium text-muted-foreground/60 w-20 truncate">{sk.metadata.name}</span>}
                      <span className="flex-1 min-w-0 text-sm truncate">{session.name || 'Untitled'}</span>
                      {session.lastMessageAt && <span className="shrink-0 text-[10px] text-muted-foreground/40">{formatRelativeTime(session.lastMessageAt)}</span>}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen}
        workspaceId={activeWorkspaceId ?? ''} enabledSlugs={enabledSlugs} onSave={handleSaveEnabledSlugs} />
    </div>
  )
}
