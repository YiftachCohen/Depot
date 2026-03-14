import { useMemo, useCallback } from "react"
import { useAtomValue } from "jotai"
import { Zap } from "lucide-react"
import { parseLabelEntry } from "@depot/shared/labels"
import { EntityListLabelBadge } from "@/components/ui/entity-list-label-badge"
import { useSessionListContext } from "@/context/SessionListContext"
import { skillsAtom } from "@/atoms/skills"
import { navigate, routes } from "@/lib/navigate"
import type { SessionMeta } from "@/atoms/sessions"
import type { LabelConfig } from "@depot/shared/labels"

interface SessionBadgesProps {
  item: SessionMeta
}

/**
 * SkillBadge - Pill-shaped badge showing the skill name for skill-originated sessions.
 * Looks up the skill by slug from skillsAtom and displays its name with a Zap icon.
 */
function SkillBadge({ skillSlug }: { skillSlug: string }) {
  const skills = useAtomValue(skillsAtom)
  const skill = useMemo(() => skills.find(s => s.slug === skillSlug), [skills, skillSlug])
  const displayName = skill?.metadata.name ?? skillSlug

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(routes.view.skills(skillSlug))
  }, [skillSlug])

  return (
    <button
      onClick={handleClick}
      className="shrink-0 h-[18px] max-w-[120px] px-1.5 text-[10px] font-medium rounded flex items-center whitespace-nowrap gap-0.5 hover:opacity-80 transition-opacity cursor-pointer"
      title={`Go to ${displayName}`}
      style={{
        backgroundColor: 'rgba(var(--foreground-rgb), 0.05)',
        color: 'rgba(var(--foreground-rgb), 0.7)',
      }}
    >
      <Zap className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{displayName}</span>
    </button>
  )
}

export function SessionBadges({ item }: SessionBadgesProps) {
  const ctx = useSessionListContext()

  const resolvedLabels = useMemo(() => {
    if (!item.labels || item.labels.length === 0 || ctx.flatLabels.length === 0) return []
    return item.labels
      .map(entry => {
        const parsed = parseLabelEntry(entry)
        const config = ctx.flatLabels.find(l => l.id === parsed.id)
        if (!config) return null
        return { config, rawValue: parsed.rawValue }
      })
      .filter((l): l is { config: LabelConfig; rawValue: string | undefined } => l != null)
  }, [item.labels, ctx.flatLabels])

  const hasLabels = resolvedLabels.length > 0
  const hasSkill = !!item.skillSlug

  if (!hasLabels && !hasSkill) return null

  return (
    <>
      {hasSkill && <SkillBadge skillSlug={item.skillSlug!} />}
      {resolvedLabels.map(({ config, rawValue }, idx) => (
        <EntityListLabelBadge
          key={`${config.id}-${idx}`}
          label={config}
          rawValue={rawValue}
          sessionLabels={item.labels || []}
          onLabelsChange={(updated) => ctx.onLabelsChange?.(item.id, updated)}
        />
      ))}
    </>
  )
}
