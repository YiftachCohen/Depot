import * as React from 'react'
import { Search, Download, Check, Loader2, Terminal, Globe, Radio } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { DiscoveredMcpServer, FolderSourceConfig } from '../../../shared/types'

const getServerKey = (server: DiscoveredMcpServer) =>
  `${server.name}::${server.origin}::${server.transport}::${server.command ?? ''}::${server.url ?? ''}`

const ORIGIN_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'claude-code-local': 'Claude Code (local)',
  'claude-desktop': 'Claude Desktop',
}

const TRANSPORT_CONFIG: Record<string, { label: string; icon: React.ReactNode; colorClass: string }> = {
  stdio: { label: 'stdio', icon: <Terminal className="size-3" />, colorClass: 'bg-info/10 text-info' },
  http: { label: 'http', icon: <Globe className="size-3" />, colorClass: 'bg-success/10 text-success' },
  sse: { label: 'sse', icon: <Radio className="size-3" />, colorClass: 'bg-warning/10 text-warning' },
}

interface DiscoverSourcesDialogProps {
  workspaceId: string
  trigger: React.ReactNode
  onImported?: () => void
}

export function DiscoverSourcesDialog({ workspaceId, trigger, onImported }: DiscoverSourcesDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [servers, setServers] = React.useState<DiscoveredMcpServer[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [importing, setImporting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const discover = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.discoverGlobalMcpServers(workspaceId)
      setServers(result)
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan for MCP servers')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  React.useEffect(() => {
    if (open) {
      discover()
    }
  }, [open, discover])

  const toggleServer = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const selectAll = () => {
    const importable = servers.filter(s => !s.alreadyImported).map(getServerKey)
    setSelected(new Set(importable))
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      for (const server of servers) {
        if (!selected.has(getServerKey(server))) continue
        const payload: Partial<FolderSourceConfig> = {
          name: server.name,
          provider: server.name,
          type: 'mcp',
          enabled: true,
          mcp: {
            transport: server.transport,
            command: server.command,
            args: server.args,
            env: server.env,
            url: server.url,
            authType: 'none',
          },
        }
        await window.electronAPI.createSource(workspaceId, payload)
      }
      setOpen(false)
      onImported?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import servers')
    } finally {
      setImporting(false)
    }
  }

  const importableCount = servers.filter(s => !s.alreadyImported).length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="size-4" />
            Discover MCP Servers
          </DialogTitle>
          <DialogDescription>
            Import MCP servers from Claude Code and Claude Desktop configs.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[120px] max-h-[320px] overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" />
              <span className="text-sm">Scanning config files...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8 text-destructive">
              <span className="text-sm">{error}</span>
            </div>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <span className="text-sm">No MCP servers found.</span>
              <span className="text-xs mt-1">Checked Claude Code and Claude Desktop configs.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {importableCount > 1 && (
                <button
                  onClick={selectAll}
                  className="text-xs text-accent hover:underline self-end mb-1"
                >
                  Select all ({importableCount})
                </button>
              )}
              {servers.map((server) => {
                const serverKey = getServerKey(server)
                const transport = TRANSPORT_CONFIG[server.transport]
                const isSelected = selected.has(serverKey)
                const subtitle = server.transport === 'stdio'
                  ? [server.command, ...(server.args ?? [])].join(' ')
                  : server.url ?? ''

                return (
                  <button
                    key={serverKey}
                    onClick={() => !server.alreadyImported && toggleServer(serverKey)}
                    disabled={server.alreadyImported}
                    className={`
                      flex items-start gap-3 px-3 py-2.5 rounded-[8px] text-left transition-colors w-full
                      ${server.alreadyImported
                        ? 'opacity-50 cursor-default'
                        : isSelected
                          ? 'bg-accent/5 ring-1 ring-accent/20'
                          : 'hover:bg-foreground/[0.03]'
                      }
                    `}
                  >
                    {/* Checkbox area */}
                    <div className="mt-0.5 shrink-0">
                      {server.alreadyImported ? (
                        <div className="size-4 rounded border border-foreground/20 bg-foreground/5 flex items-center justify-center">
                          <Check className="size-3 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className={`size-4 rounded border flex items-center justify-center ${
                          isSelected ? 'border-accent bg-accent text-white' : 'border-foreground/20'
                        }`}>
                          {isSelected && <Check className="size-3" />}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{server.name}</span>
                        {transport && (
                          <span className={`shrink-0 h-[18px] px-1.5 text-[10px] font-medium flex items-center gap-1 rounded ${transport.colorClass}`}>
                            {transport.icon}
                            {transport.label}
                          </span>
                        )}
                        {server.alreadyImported && (
                          <span className="shrink-0 h-[18px] px-1.5 text-[10px] font-medium flex items-center rounded bg-foreground/5 text-muted-foreground">
                            Imported
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate" title={subtitle}>
                        {subtitle}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {ORIGIN_LABELS[server.origin] ?? server.origin}
                        {server.env && Object.keys(server.env).length > 0 && (
                          <span className="ml-2">
                            env: {Object.keys(server.env).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {servers.length > 0 && (
          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-[8px] hover:bg-foreground/[0.03] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-[8px] bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Download className="size-3" />
              )}
              Import{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
