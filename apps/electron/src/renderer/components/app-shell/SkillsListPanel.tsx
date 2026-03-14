import * as React from 'react'
import { useCallback, useState } from 'react'
import { Zap, Download } from 'lucide-react'
import { SkillAvatar } from '@/components/ui/skill-avatar'
import { EntityPanel } from '@/components/ui/entity-panel'
import { EntityListEmptyScreen } from '@/components/ui/entity-list-empty'
import { skillSelection } from '@/hooks/useEntitySelection'
import { SkillMenu } from './SkillMenu'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import type { LoadedSkill } from '../../../shared/types'

export interface SkillsListPanelProps {
  skills: LoadedSkill[]
  onDeleteSkill: (skillSlug: string) => void
  onSkillClick: (skill: LoadedSkill) => void
  onSkillsRefresh?: () => void
  selectedSkillSlug?: string | null
  workspaceId?: string
  workspaceRootPath?: string
  className?: string
}

export function SkillsListPanel({
  skills,
  onDeleteSkill,
  onSkillClick,
  onSkillsRefresh,
  selectedSkillSlug,
  workspaceId,
  workspaceRootPath,
  className,
}: SkillsListPanelProps) {
  const [importing, setImporting] = useState(false)

  const handleImportFromClaude = useCallback(async () => {
    setImporting(true)
    try {
      const imported = await window.electronAPI.importSkillsFromClaude()
      if (imported.length > 0) {
        onSkillsRefresh?.()
      }
    } catch {
      // Import errors are handled silently
    } finally {
      setImporting(false)
    }
  }, [onSkillsRefresh])

  const addSkillButtons = (
    <div className="flex items-center gap-2">
      {workspaceRootPath && (
        <EditPopover
          align="center"
          trigger={
            <button className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-[8px] bg-background shadow-minimal hover:bg-foreground/[0.03] transition-colors">
              Add Agent
            </button>
          }
          {...getEditConfig('add-skill', workspaceRootPath)}
        />
      )}
      <button
        className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-[8px] bg-background shadow-minimal hover:bg-foreground/[0.03] transition-colors disabled:opacity-50"
        onClick={handleImportFromClaude}
        disabled={importing}
      >
        <Download className="h-3 w-3" />
        {importing ? 'Importing...' : 'Import from Claude Code'}
      </button>
    </div>
  )

  return (
    <EntityPanel<LoadedSkill>
      items={skills}
      getId={(s) => s.slug}
      selection={skillSelection}
      selectedId={selectedSkillSlug}
      onItemClick={onSkillClick}
      className={className}
      emptyState={
        <EntityListEmptyScreen
          icon={<Zap />}
          title="No agents or skills configured"
          description="Agents and skills are reusable instructions that teach your AI specialized behaviors."
          docKey="skills"
        >
          {addSkillButtons}
        </EntityListEmptyScreen>
      }
      mapItem={(skill) => ({
        icon: <SkillAvatar skill={skill} size="sm" workspaceId={workspaceId} />,
        title: skill.metadata.name,
        badges: (
          <span className="truncate">{skill.metadata.description}</span>
        ),
        menu: (
          <SkillMenu
            skillSlug={skill.slug}
            skillName={skill.metadata.name}
            onOpenInNewWindow={() => window.electronAPI.openUrl(`craftagents://skills/skill/${skill.slug}?window=focused`)}
            onShowInFinder={() => { if (workspaceId) window.electronAPI.openSkillInFinder(workspaceId, skill.slug) }}
            onDelete={() => onDeleteSkill(skill.slug)}
          />
        ),
      })}
    />
  )
}
