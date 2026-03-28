/**
 * AgentProfileColumn — Sticky left rail for the agent detail "Living Dossier".
 *
 * Three zones: Identity, Vital Signs, Quick Commands + Actions Footer.
 */
import * as React from 'react'
import { useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  Brain, Database, FolderOpen, X, Pencil, Sparkles,
  Plus, MoreHorizontal, Copy, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getCommandIcon, ICON_NAME_MAP, resolveIconComponent } from '@/lib/command-icon'
import { useEntityIcon } from '@/lib/icon-cache'
import { InlineSvg } from '@/lib/inline-svg'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAtomValue } from 'jotai'
import { navigate, routes } from '@/lib/navigate'
import { SourceSelectorPopover } from '@/components/ui/SourceSelectorPopover'
import { SourceAvatar } from '@/components/ui/source-avatar'
import { sourcesAtom } from '@/atoms/sources'
import { MODEL_REGISTRY, getModelShortName } from '@config/models'
import type { LoadedSkill, QuickCommand, DepotSkillManifest } from '../../../../shared/types'
import type { AgentState } from '@depot/shared/skills'
import type { AgentPageMode, KnowledgeStatsData, SkillSessionStats } from './types'
import type { AutomationListItem } from '../../automations/types'
import { AgentPulseStrip } from './AgentPulseStrip'
import { AgentAutomationsCard } from './AgentAutomationsCard'
import { AgentLastChatTeaser } from './AgentLastChatTeaser'
import {
  ACCENT_PALETTE, getAccentColor, getActivityStatus, formatRelativeTime,
  ACTIVITY_DOT, OBSERVATION_HEALTH_DOT, PATH_BADGE,
} from './utils'

const FOCUSED_CMD_CHIP = cn(
  'inline-flex items-center gap-1.5 text-[12px] text-foreground/70 cursor-pointer',
  'rounded-lg px-2.5 py-1.5 w-full',
  'border border-border/60 bg-foreground/[0.02]',
  'hover:bg-foreground/[0.06] hover:border-foreground/20 hover:text-foreground/80 transition-colors',
)

// ---------------------------------------------------------------------------
// AgentIcon (reused from SkillDashboard)
// ---------------------------------------------------------------------------
export function AgentIcon({ skill, accent, workspaceId, size = 'md' }: {
  skill: LoadedSkill; accent: string; workspaceId: string; size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
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
  const sizes = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-12 w-12', xl: 'h-14 w-14' }
  const iconSizes = { sm: 'h-[14px] w-[14px]', md: 'h-[18px] w-[18px]', lg: 'h-[24px] w-[24px]', xl: 'h-[28px] w-[28px]' }
  const textSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-xl', xl: 'text-2xl' }

  return (
    <div
      className={cn('flex items-center justify-center rounded-xl shrink-0', sizes[size])}
      style={{ backgroundColor: `${accent}14` }}
    >
      {icon.kind === 'emoji' ? (
        <span className={cn('leading-none', textSizes[size])}>{icon.value}</span>
      ) : icon.kind === 'file' && icon.colorable && icon.rawSvg ? (
        <span className={cn('[&>svg]:h-[18px] [&>svg]:w-[18px]', size === 'lg' && '[&>svg]:h-[24px] [&>svg]:w-[24px]', size === 'xl' && '[&>svg]:h-[28px] [&>svg]:w-[28px]', size === 'sm' && '[&>svg]:h-[14px] [&>svg]:w-[14px]')} style={{ color: accent }}>
          <InlineSvg svg={icon.rawSvg} />
        </span>
      ) : icon.kind === 'file' ? (
        <img src={icon.value} alt={skill.metadata.name} className={cn('rounded', iconSizes[size])} />
      ) : (
        <span style={{ color: accent }}>
          <FallbackIcon className={iconSizes[size]} />
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AgentProfileColumnProps {
  skill: LoadedSkill
  workspaceId: string
  agentState: AgentState | undefined
  knowledgeStats: KnowledgeStatsData | undefined
  stats: SkillSessionStats | undefined
  pageMode: AgentPageMode
  collapsed: boolean

  // Icon picker state
  showIconPicker: boolean
  onToggleIconPicker: () => void
  iconOverride: string | undefined
  onIconSelect: (name: string) => void

  // Path management
  focusedPaths: string[]
  addingPath: boolean
  setAddingPath: (v: boolean) => void
  newPathValue: string
  setNewPathValue: (v: string) => void
  savingPath: boolean
  onAddPath: () => void
  onRemovePath: (index: number) => void

  // Actions
  onQuickCommand: (skill: LoadedSkill, cmd: QuickCommand) => void
  onNewChat: (skill: LoadedSkill) => void
  onImprove: () => void
  onDelete: () => void
  onPermissionModeChange?: (mode: string) => void

  // Sources
  onSourcesChange?: (slugs: string[]) => void

  // Color / Model / Rename
  onColorChange?: (color: string) => void
  onModelChange?: (modelId: string) => void
  onRenameStart?: () => void

  // Aliveness features (rendered in left rail)
  agentAutomations?: AutomationListItem[]
  allAutomations?: AutomationListItem[]
  onTestAutomation?: (automationId: string) => void
  onToggleAutomation?: (automationId: string) => void
  onDeleteAutomation?: (automationId: string) => void
  getAutomationHistory?: (automationId: string) => Promise<import('../../automations/types').ExecutionEntry[]>
  lastSession?: { id: string; name?: string; lastMessageAt?: number; messageCount?: number } | null
  skillSlug?: string
}

export function AgentProfileColumn({
  skill,
  workspaceId,
  agentState,
  knowledgeStats,
  stats,
  pageMode,
  collapsed,
  showIconPicker,
  onToggleIconPicker,
  iconOverride,
  onIconSelect,
  focusedPaths,
  addingPath,
  setAddingPath,
  newPathValue,
  setNewPathValue,
  savingPath,
  onAddPath,
  onRemovePath,
  onQuickCommand,
  onNewChat,
  onImprove,
  onDelete,
  onPermissionModeChange,
  onSourcesChange,
  onColorChange,
  onModelChange,
  onRenameStart,
  agentAutomations,
  allAutomations,
  onTestAutomation,
  onToggleAutomation,
  onDeleteAutomation,
  getAutomationHistory,
  lastSession,
  skillSlug,
}: AgentProfileColumnProps) {
  const accent = getAccentColor(skill.slug, skill.manifest?.color)
  const activity = getActivityStatus(stats?.lastUsedAt)
  const count = stats?.sessionCount ?? 0
  const cmds = skill.manifest?.quick_commands ?? []
  const iconEntries = useMemo(() => Object.entries(ICON_NAME_MAP), [])
  const [descExpanded, setDescExpanded] = useState(false)

  // Sources
  const allSources = useAtomValue(sourcesAtom)
  const selectedSourceSlugs = skill.manifest?.sources ?? skill.metadata.requiredSources ?? []
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)
  const sourcePickerRef = useRef<HTMLButtonElement>(null)

  // Collapsed mode: compact horizontal header
  if (collapsed) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
        <AgentIcon skill={skill} accent={accent} workspaceId={workspaceId} size="sm" />
        <span className="text-sm font-display truncate flex-1">{skill.metadata.name}</span>
        <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', ACTIVITY_DOT[activity])} />
        {/* Condensed vital signs as pills */}
        <div className="flex items-center gap-2 text-[10px] text-foreground/40">
          {count > 0 && <span>{count} session{count !== 1 ? 's' : ''}</span>}
          {knowledgeStats && (
            <span className="inline-flex items-center gap-0.5">
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full', OBSERVATION_HEALTH_DOT[knowledgeStats.observationHealth])} />
              {knowledgeStats.entityCount}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Identity Zone */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        {/* Icon (clickable — opens icon + color picker) */}
        <button
          type="button"
          onClick={() => skill.manifest && onToggleIconPicker()}
          aria-label="Change icon"
          className="cursor-pointer rounded-xl hover:ring-2 hover:ring-foreground/10 transition-all"
          title="Change icon & color"
        >
          <AgentIcon skill={skill} accent={accent} workspaceId={workspaceId} size="xl" />
        </button>

        {/* Name + activity dot + rename pencil */}
        <div className="flex items-center gap-2 group/name">
          <h2 className="text-xl font-bold font-display truncate max-w-[200px]" title={skill.metadata.name}>
            {skill.metadata.name}
          </h2>
          <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', ACTIVITY_DOT[activity])} />
          {skill.manifest && onRenameStart && (
            <button
              type="button"
              onClick={onRenameStart}
              aria-label="Rename agent"
              className="opacity-0 group-hover/name:opacity-100 text-foreground/30 hover:text-foreground/60 transition-all cursor-pointer"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Description — click to expand */}
        <button
          type="button"
          onClick={() => setDescExpanded(v => !v)}
          className="text-left text-[12px] leading-relaxed text-foreground/55 cursor-pointer hover:text-foreground/70 transition-colors"
        >
          <span className={descExpanded ? undefined : 'line-clamp-3'}>{skill.metadata.description}</span>
        </button>

        {/* Personality badge */}
        {skill.manifest?.personality && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-foreground/40">
            <span className="inline-flex items-center gap-1 italic line-clamp-1 max-w-full">
              <Brain className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{skill.manifest.personality}</span>
            </span>
          </div>
        )}

        {/* Project paths */}
        {skill.manifest && (focusedPaths.length > 0 || addingPath) && (
          <div className="flex flex-wrap items-center gap-1">
            {focusedPaths.map((p, i) => (
              <span key={i} className={PATH_BADGE}>
                <FolderOpen className="h-2.5 w-2.5" />
                <span className="truncate max-w-[160px]">{p}</span>
                <button
                  type="button"
                  onClick={() => void onRemovePath(i)}
                  disabled={savingPath}
                  aria-label={`Remove project path ${p}`}
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
                    if (e.key === 'Enter') void onAddPath()
                    if (e.key === 'Escape') { setAddingPath(false); setNewPathValue('') }
                  }}
                  onBlur={() => { if (!newPathValue.trim()) { setAddingPath(false); setNewPathValue('') } }}
                  className="h-5 px-1.5 text-[10px] font-mono rounded border border-border/60 bg-background w-36 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </span>
            )}
          </div>
        )}

        {/* Inline icon + color picker */}
        {showIconPicker && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-border/60 bg-background p-2 space-y-2"
          >
            <div className="max-h-[200px] overflow-y-auto">
              <div className="grid grid-cols-6 gap-1">
                {iconEntries.map(([name, Icon]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onIconSelect(name)}
                    aria-label={`Select icon ${name}`}
                    title={name}
                    className={cn(
                      'flex items-center justify-center h-7 w-7 rounded-md transition-colors cursor-pointer',
                      (iconOverride ?? skill.manifest?.icon) === name
                        ? 'bg-foreground text-background'
                        : 'hover:bg-foreground/[0.08] text-foreground/70',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
            {/* Color swatches */}
            <div className="border-t border-border/40 pt-2">
              <div className="text-[9px] text-foreground/30 uppercase tracking-widest mb-1.5">Color</div>
              <div className="flex items-center gap-1.5">
                {ACCENT_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onColorChange?.(c)}
                    aria-label={`Accent color ${c}`}
                    className={cn(
                      'h-5 w-5 rounded-full cursor-pointer transition-all shrink-0',
                      accent === c ? 'ring-2 ring-offset-1 ring-offset-background' : 'hover:scale-110',
                    )}
                    style={{ backgroundColor: c, ...(accent === c ? { ['--tw-ring-color' as string]: c } : {}) }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Vital Signs */}
      <div className="px-4 py-3 border-t border-border/20">
        <h4 className="text-[10px] font-medium text-foreground/30 uppercase tracking-widest mb-2.5">Stats</h4>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          {agentState?.createdAt && (
            <div>
              <div className="text-[10px] text-foreground/35">Created</div>
              <div className="text-[12px] text-foreground/70 font-medium tabular-nums">{formatRelativeTime(agentState.createdAt)}</div>
            </div>
          )}
          <div>
            <div className="text-[10px] text-foreground/35">Sessions</div>
            <div className="text-[12px] text-foreground/70 font-medium tabular-nums">{count}</div>
          </div>
          {stats?.lastUsedAt && (
            <div>
              <div className="text-[10px] text-foreground/35">Last active</div>
              <div className={cn(
                'text-[12px] font-medium tabular-nums',
                activity === 'active' ? 'text-emerald-500' : activity === 'recent' ? 'text-amber-500' : 'text-foreground/70',
              )}>{formatRelativeTime(stats.lastUsedAt)}</div>
            </div>
          )}
          {/* Entity/pattern counts removed — shown in Knowledge Story card to avoid duplication */}
          {skill.manifest && (
            <div>
              <div className="text-[10px] text-foreground/35">Permissions</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium cursor-pointer transition-colors',
                    (skill.manifest.permission_mode ?? 'ask') === 'safe' && 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20',
                    (skill.manifest.permission_mode ?? 'ask') === 'ask' && 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20',
                    (skill.manifest.permission_mode ?? 'ask') === 'allow-all' && 'bg-red-500/10 text-red-600 hover:bg-red-500/20',
                  )}>
                    {skill.manifest.permission_mode ?? 'ask'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[140px]">
                  {(['safe', 'ask', 'allow-all'] as const).map((mode) => (
                    <DropdownMenuItem
                      key={mode}
                      onClick={() => onPermissionModeChange?.(mode)}
                      className={cn(
                        'text-xs',
                        (skill.manifest?.permission_mode ?? 'ask') === mode && 'font-semibold',
                      )}
                    >
                      <span className={cn(
                        'inline-block h-2 w-2 rounded-full mr-2 shrink-0',
                        mode === 'safe' && 'bg-emerald-500',
                        mode === 'ask' && 'bg-amber-500',
                        mode === 'allow-all' && 'bg-red-500',
                      )} />
                      {mode}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          {/* Model selector */}
          {skill.manifest && (
            <div>
              <div className="text-[10px] text-foreground/35">Model</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium cursor-pointer transition-colors bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08]">
                    {skill.manifest.model ? getModelShortName(skill.manifest.model) : 'Default'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[160px]">
                  <DropdownMenuItem
                    onClick={() => onModelChange?.('')}
                    className={cn('text-xs', !skill.manifest?.model && 'font-semibold')}
                  >
                    Default
                  </DropdownMenuItem>
                  {MODEL_REGISTRY.map((m) => (
                    <DropdownMenuItem
                      key={m.id}
                      onClick={() => onModelChange?.(m.id)}
                      className={cn('text-xs', skill.manifest?.model === m.id && 'font-semibold')}
                    >
                      {m.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* Sources */}
      {skill.manifest && (
        <div className="px-4 py-3 border-t border-border/20">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-[10px] font-medium text-foreground/30 uppercase tracking-widest">Sources</h4>
            <button
              ref={sourcePickerRef}
              type="button"
              onClick={() => setSourcePickerOpen(true)}
              className="text-foreground/40 hover:text-foreground/70 transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          {selectedSourceSlugs.length > 0 ? (
            <div className="flex flex-col gap-1">
              {selectedSourceSlugs.map((slug) => {
                const source = allSources.find((s) => s.config.slug === slug)
                return (
                  <div key={slug} className="flex items-center gap-2 group rounded-md hover:bg-foreground/[0.04] px-1.5 py-1 -mx-1.5 transition-colors">
                    <button
                      type="button"
                      onClick={() => setSourcePickerOpen(true)}
                      className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                    >
                      {source ? <SourceAvatar source={source} size="sm" /> : <Database className="h-3.5 w-3.5 text-foreground/40" />}
                      <span className="text-[12px] text-foreground/70 truncate">{source?.config.name ?? slug}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = selectedSourceSlugs.filter((s) => s !== slug)
                        onSourcesChange?.(next)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-foreground/60 transition-all cursor-pointer shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSourcePickerOpen(true)}
              className="text-[11px] text-foreground/30 hover:text-foreground/50 transition-colors cursor-pointer"
            >
              No sources connected — click to add
            </button>
          )}
          <SourceSelectorPopover
            open={sourcePickerOpen}
            onOpenChange={setSourcePickerOpen}
            anchorRef={sourcePickerRef}
            sources={allSources}
            selectedSlugs={selectedSourceSlugs}
            onToggleSlug={(slug) => {
              const next = selectedSourceSlugs.includes(slug)
                ? selectedSourceSlugs.filter((s) => s !== slug)
                : [...selectedSourceSlugs, slug]
              onSourcesChange?.(next)
            }}
          />
        </div>
      )}

      {/* Actions — always visible right after stats */}
      <div className="px-4 py-3 border-t border-border/20">
        <div className="flex items-center gap-1.5 text-xs text-foreground/45">
          {skill.manifest && !addingPath && (
            <button
              type="button"
              onClick={() => setAddingPath(true)}
              className="text-foreground/50 hover:text-foreground/80 transition-colors cursor-pointer"
            >
              + Path
            </button>
          )}
          {skill.manifest && !addingPath && <span aria-hidden>{'·'}</span>}
          <EditPopover
            trigger={
              <button type="button" className="inline-flex items-center gap-1 text-foreground/50 hover:text-foreground/80 transition-colors cursor-pointer">
                <Pencil className="h-3 w-3" />Edit
              </button>
            }
            {...getEditConfig('skill-metadata', skill.path)}
            secondaryAction={{ label: 'Edit File', filePath: `${skill.path}/SKILL.md` }}
            skillSlug={skill.slug}
          />
          <span aria-hidden>{'·'}</span>
          <button
            type="button"
            onClick={onImprove}
            className="inline-flex items-center gap-1 text-foreground/50 hover:text-foreground/80 transition-colors cursor-pointer"
          >
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
              <DropdownMenuItem onClick={() => window.electronAPI.showInFolder(`${skill.path}/SKILL.md`)}>
                <FolderOpen className="h-3.5 w-3.5 mr-2" />Open folder
              </DropdownMenuItem>
              {skill.manifest && (
                <DropdownMenuItem onClick={async () => {
                  try {
                    const content = await window.electronAPI.readFile(`${skill.path}/depot.yaml`)
                    await navigator.clipboard.writeText(content)
                    toast.success('Copied depot.yaml to clipboard')
                  } catch { toast.error('Failed to copy depot.yaml') }
                }}>
                  <Copy className="h-3.5 w-3.5 mr-2" />Export depot.yaml
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Automations — full list with actions */}
      {allAutomations && skillSlug && (
        <div className="px-4 py-3 border-t border-border/20">
          <AgentAutomationsCard
            skillSlug={skillSlug}
            skillPath={skill.path}
            automations={allAutomations}
            onTest={onTestAutomation}
            onToggle={onToggleAutomation}
            onDelete={onDeleteAutomation}
            getHistory={getAutomationHistory}
            compact
          />
        </div>
      )}

      {/* Last Chat Teaser — "still here" signal */}
      {lastSession && skillSlug && (
        <div className="px-4 py-3 border-t border-border/20">
          <h4 className="text-[10px] font-medium text-foreground/30 uppercase tracking-widest mb-2">Continue where you left off</h4>
          <AgentLastChatTeaser skillSlug={skillSlug} session={lastSession} />
        </div>
      )}

      {/* New Chat button (quick commands are now in the prompt bar) */}
      <div className="px-4 py-3 border-t border-border/20 flex-1">
        <button type="button" onClick={() => onNewChat(skill)} className={cn(FOCUSED_CMD_CHIP, 'text-foreground/40')}>
          <Plus className="h-3.5 w-3.5 opacity-70 shrink-0" />
          <span>New Chat</span>
        </button>
      </div>
    </div>
  )
}
