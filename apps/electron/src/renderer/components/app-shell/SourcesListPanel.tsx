import * as React from 'react'
import { DatabaseZap, Plus, Search } from 'lucide-react'
import { SourceAvatar } from '@/components/ui/source-avatar'
import { deriveConnectionStatus } from '@/components/ui/source-status-indicator'
import { EntityPanel } from '@/components/ui/entity-panel'
import { EntityListBadge } from '@/components/ui/entity-list-badge'
import { EntityListEmptyScreen } from '@/components/ui/entity-list-empty'
import { sourceSelection } from '@/hooks/useEntitySelection'
import { SourceMenu } from './SourceMenu'
import { EditPopover, getEditConfig, type EditContextKey } from '@/components/ui/EditPopover'
import { DiscoverSourcesDialog } from './DiscoverSourcesDialog'
import type { LoadedSource, SourceConnectionStatus, SourceFilter } from '../../../shared/types'

const SOURCE_TYPE_CONFIG: Record<string, { label: string; colorClass: string }> = {
  mcp: { label: 'MCP', colorClass: 'bg-accent/10 text-accent' },
  api: { label: 'API', colorClass: 'bg-success/10 text-success' },
  local: { label: 'Local', colorClass: 'bg-info/10 text-info' },
}

const SOURCE_STATUS_CONFIG: Record<string, { label: string; colorClass: string } | null> = {
  connected: null,
  needs_auth: { label: 'Auth Required', colorClass: 'bg-warning/10 text-warning' },
  failed: { label: 'Disconnected', colorClass: 'bg-destructive/10 text-destructive' },
  untested: { label: 'Not Tested', colorClass: 'bg-foreground/10 text-foreground/50' },
  local_disabled: { label: 'Disabled', colorClass: 'bg-foreground/10 text-foreground/50' },
}

const SOURCE_TYPE_FILTER_LABELS: Record<string, string> = {
  api: 'API',
  mcp: 'MCP',
  local: 'local folder',
}

export interface SourcesListPanelProps {
  sources: LoadedSource[]
  sourceFilter?: SourceFilter | null
  workspaceRootPath?: string
  workspaceId?: string
  onDeleteSource: (sourceSlug: string) => void
  onSourceClick: (source: LoadedSource) => void
  onSourcesImported?: () => void
  selectedSourceSlug?: string | null
  localMcpEnabled?: boolean
  className?: string
}

export function SourcesListPanel({
  sources,
  sourceFilter,
  workspaceRootPath,
  workspaceId,
  onDeleteSource,
  onSourceClick,
  onSourcesImported,
  selectedSourceSlug,
  localMcpEnabled = true,
  className,
}: SourcesListPanelProps) {
  const filteredSources = React.useMemo(() => {
    if (!sourceFilter) return sources
    return sources.filter(s => s.config.type === sourceFilter.sourceType)
  }, [sources, sourceFilter])

  const emptyMessage = React.useMemo(() => {
    if (sourceFilter?.kind === 'type') {
      return `No ${SOURCE_TYPE_FILTER_LABELS[sourceFilter.sourceType] ?? sourceFilter.sourceType} sources configured.`
    }
    return 'No sources configured.'
  }, [sourceFilter])

  const editContextKey = sourceFilter?.kind === 'type' ? `add-source-${sourceFilter.sourceType}` as EditContextKey : 'add-source'

  return (
    <EntityPanel<LoadedSource>
      items={filteredSources}
      getId={(s) => s.config.slug}
      selection={sourceSelection}
      selectedId={selectedSourceSlug}
      onItemClick={onSourceClick}
      className={className}
      header={(workspaceRootPath || workspaceId) ? (
        <div className="flex items-center justify-end gap-1 px-2 pt-1.5 pb-0.5">
          {workspaceId && (
            <DiscoverSourcesDialog
              workspaceId={workspaceId}
              onImported={onSourcesImported}
              trigger={
                <button
                  className="inline-flex items-center justify-center h-6 w-6 rounded-[6px] text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
                  aria-label="Discover global MCP servers"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              }
            />
          )}
          {workspaceRootPath && (
            <EditPopover
              align="end"
              trigger={
                <button
                  className="inline-flex items-center justify-center h-6 w-6 rounded-[6px] text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
                  aria-label="Add source"
                >
                  <Plus className="h-4 w-4" />
                </button>
              }
              {...getEditConfig(editContextKey, workspaceRootPath)}
            />
          )}
        </div>
      ) : undefined}
      emptyState={
        <EntityListEmptyScreen
          icon={<DatabaseZap />}
          title={emptyMessage}
          description="Sources connect your agent to external data — MCP servers, REST APIs, and local folders."
          docKey="sources"
        >
          {workspaceId && (
            <DiscoverSourcesDialog
              workspaceId={workspaceId}
              onImported={onSourcesImported}
              trigger={
                <button className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-[8px] bg-background shadow-minimal hover:bg-foreground/[0.03] transition-colors">
                  <Search className="size-3" />
                  Discover MCP Servers
                </button>
              }
            />
          )}
        </EntityListEmptyScreen>
      }
      mapItem={(source) => {
        const connectionStatus = deriveConnectionStatus(source, localMcpEnabled)
        const typeConfig = SOURCE_TYPE_CONFIG[source.config.type]
        const statusConfig = SOURCE_STATUS_CONFIG[connectionStatus]
        const subtitle = source.config.tagline || source.config.provider || ''
        return {
          icon: <SourceAvatar source={source} size="sm" />,
          title: source.config.name,
          badges: (
            <>
              {typeConfig && <EntityListBadge colorClass={typeConfig.colorClass}>{typeConfig.label}</EntityListBadge>}
              {statusConfig && (
                <EntityListBadge colorClass={statusConfig.colorClass} tooltip={source.config.connectionError || undefined} className="cursor-default">
                  {statusConfig.label}
                </EntityListBadge>
              )}
              {subtitle && <span className="truncate">{subtitle}</span>}
            </>
          ),
          menu: (
            <SourceMenu
              sourceSlug={source.config.slug}
              sourceName={source.config.name}
              onOpenInNewWindow={() => window.electronAPI.openUrl(`craftagents://sources/source/${source.config.slug}?window=focused`)}
              onShowInFinder={() => window.electronAPI.showInFolder(source.folderPath)}
              onDelete={() => onDeleteSource(source.config.slug)}
            />
          ),
        }
      }}
    />
  )
}
