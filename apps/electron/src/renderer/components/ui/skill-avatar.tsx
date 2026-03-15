/**
 * SkillAvatar - Thin wrapper around EntityIcon for skills.
 *
 * Resolves the fallback icon from the depot.yaml manifest `icon` field (Lucide name),
 * keyword inference from the skill name, or Zap as a last resort.
 * Use `fluid` prop for fill-parent sizing (e.g., Info_Page.Hero).
 */

import { useMemo } from 'react'
import { EntityIcon } from '@/components/ui/entity-icon'
import { useEntityIcon } from '@/lib/icon-cache'
import { resolveIconComponent } from '@/lib/command-icon'
import type { IconSize } from '@depot/shared/icons'
import type { LoadedSkill } from '../../../shared/types'

interface SkillAvatarProps {
  /** LoadedSkill object */
  skill: LoadedSkill
  /** Size variant */
  size?: IconSize
  /** Fill parent container (h-full w-full). Overrides size. */
  fluid?: boolean
  /** Additional className overrides */
  className?: string
  /** Override container size/shape (forwarded to EntityIcon) */
  containerClassName?: string
  /** Workspace ID for loading local icons */
  workspaceId?: string
  /** Override the Lucide fallback icon name (used for immediate UI feedback before file watcher round-trip) */
  iconOverride?: string
}

export function SkillAvatar({ skill, size = 'md', fluid, className, containerClassName, workspaceId, iconOverride }: SkillAvatarProps) {
  const icon = useEntityIcon({
    workspaceId: workspaceId ?? '',
    entityType: 'skill',
    identifier: skill.slug,
    iconPath: skill.iconPath,
    iconValue: skill.metadata.icon,
  })

  const FallbackIcon = useMemo(
    () => resolveIconComponent(iconOverride ?? skill.manifest?.icon, skill.metadata.name),
    [iconOverride, skill.manifest?.icon, skill.metadata.name],
  )

  return (
    <EntityIcon
      icon={icon}
      size={size}
      fallbackIcon={FallbackIcon}
      alt={skill.metadata.name}
      className={className}
      containerClassName={fluid ? 'h-full w-full' : containerClassName}
    />
  )
}
