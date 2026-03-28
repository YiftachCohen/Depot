/**
 * Shared utilities, constants, and components for the dashboard.
 * Extracted from SkillDashboard.tsx to enable clean imports by child components.
 */
import * as React from 'react'
import { useMemo } from 'react'
import type { Variants } from 'motion/react'
import { cn } from '@/lib/utils'
import { resolveIconComponent } from '@/lib/command-icon'
import { useEntityIcon } from '@/lib/icon-cache'
import { InlineSvg } from '@/lib/inline-svg'
import type { LoadedSkill } from '../../../../shared/types'

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------
// Warm palette only — no violet/magenta per DESIGN.md (amber brand differentiation)
export const ACCENT_PALETTE = ['#D97706','#16A34A','#2563EB','#DC2626','#0D9488','#CA8A04','#B45309','#0284C7']

export function getAccentColor(slug: string, customColor?: string): string {
  if (customColor) return customColor
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length]!
}

// ---------------------------------------------------------------------------
// Activity helpers
// ---------------------------------------------------------------------------
export function getActivityStatus(lastUsedAt?: number): 'active' | 'recent' | 'idle' {
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

// ---------------------------------------------------------------------------
// Status dot classes
// ---------------------------------------------------------------------------
export const ACTIVITY_DOT: Record<string, string> = { active: 'bg-amber-500', recent: 'bg-amber-300', idle: 'bg-foreground/20' }

export const OBSERVATION_HEALTH_DOT: Record<string, string> = {
  green: 'bg-[#16A34A]',
  yellow: 'bg-[#EAB308]',
  red: 'bg-[#DC2626]',
  gray: 'bg-foreground/20',
}

// ---------------------------------------------------------------------------
// Command chip styles
// ---------------------------------------------------------------------------
export const CMD_CHIP = cn(
  'inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80 cursor-pointer',
  'rounded-md px-1.5 py-0.5 -mx-0.5',
  'hover:bg-foreground/[0.05] hover:text-foreground/80 transition-colors',
)

export const CARD_CMD_CHIP = cn(
  'inline-flex items-center gap-1.5 text-[12px] text-foreground/70 cursor-pointer',
  'rounded-full px-2.5 py-1',
  'border border-border/50 bg-foreground/[0.03]',
  'hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-300/60 dark:hover:border-amber-700/40 hover:text-amber-900 dark:hover:text-amber-300 transition-colors',
)

export const FOCUSED_CMD_CHIP = cn(
  'inline-flex items-center gap-1.5 text-[13px] text-foreground/70 cursor-pointer',
  'rounded-lg px-3 py-1.5',
  'border border-border/60 bg-foreground/[0.02]',
  'hover:bg-foreground/[0.06] hover:border-foreground/20 hover:text-foreground/80 transition-colors',
)

export const PATH_BADGE = cn(
  'inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground/70',
  'rounded-md px-1.5 py-0.5 group/path',
  'hover:text-muted-foreground/70 transition-colors',
)

export const INPUT_CLS = cn(
  'w-full h-8 px-3 text-sm rounded-md bg-background border border-border/60',
  'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring',
)

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------
export const containerVariants: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
}
export const fadeIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

// ---------------------------------------------------------------------------
// Session stats type
// ---------------------------------------------------------------------------
export interface SkillSessionStats { sessionCount: number; lastUsedAt?: number }

// ---------------------------------------------------------------------------
// Knowledge stats type
// ---------------------------------------------------------------------------
export interface KnowledgeStats {
  entityCount: number
  relationshipCount: number
  patternCount: number
  lastObservation: number | null
  observationHealth: 'green' | 'yellow' | 'red' | 'gray'
}

// ---------------------------------------------------------------------------
// AgentIcon — accent-tinted avatar for dashboard cards
// ---------------------------------------------------------------------------
const ICON_SIZES = {
  md: { container: 'h-12 w-12 rounded-xl', icon: 'h-[22px] w-[22px]', svg: '[&>svg]:h-[22px] [&>svg]:w-[22px]' },
  sm: { container: 'h-7 w-7 rounded-lg', icon: 'h-[14px] w-[14px]', svg: '[&>svg]:h-[14px] [&>svg]:w-[14px]' },
} as const

export function AgentIcon({ skill, accent, workspaceId, size = 'md', 'aria-label': ariaLabel }: {
  skill: LoadedSkill; accent: string; workspaceId: string; size?: 'md' | 'sm'; 'aria-label'?: string
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
  const s = ICON_SIZES[size]

  return (
    <div
      className={cn('flex items-center justify-center shrink-0', s.container)}
      style={{ backgroundColor: `${accent}28` }}
      aria-label={ariaLabel}
    >
      {icon.kind === 'emoji' ? (
        <span className="text-base leading-none">{icon.value}</span>
      ) : icon.kind === 'file' && icon.colorable && icon.rawSvg ? (
        <span className={s.svg} style={{ color: accent }}>
          <InlineSvg svg={icon.rawSvg} />
        </span>
      ) : icon.kind === 'file' ? (
        <img src={icon.value} alt={skill.metadata.name} className={cn(s.icon, 'rounded')} />
      ) : (
        <span style={{ color: accent }}>
          <FallbackIcon className={s.icon} />
        </span>
      )}
    </div>
  )
}
