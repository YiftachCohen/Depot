/**
 * SourceDiscoveryInline — inline MCP server discovery panel.
 * Styled to match the warm stone aesthetic of the creation flow.
 */

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Loader2, Download, Check, Terminal, Globe, Radio, AlertCircle, Search } from 'lucide-react'
import { useSourceDiscovery } from '../hooks/useSourceDiscovery'

const TRANSPORT_ICON: Record<string, typeof Globe> = {
  stdio: Terminal,
  http: Globe,
  sse: Radio,
}

interface SourceDiscoveryInlineProps {
  workspaceId: string
  onImported?: (serverName: string) => void
}

export function SourceDiscoveryInline({ workspaceId, onImported }: SourceDiscoveryInlineProps) {
  const {
    servers,
    loading,
    discoveryError,
    importErrors,
    imported,
    discover,
    importServer,
    getServerKey,
  } = useSourceDiscovery(workspaceId)

  useEffect(() => {
    discover()
  }, [discover])

  const handleImport = async (server: typeof servers[number]) => {
    const ok = await importServer(server)
    if (ok) onImported?.(server.name)
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-thin overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-stone-400" />
          <span className="text-xs font-semibold text-stone-700">MCP Servers</span>
        </div>
        {!loading && servers.length > 0 && (
          <button
            type="button"
            onClick={discover}
            className="text-[10px] text-amber-600 hover:text-amber-700 font-medium"
          >
            Rescan
          </button>
        )}
      </div>

      <div className="p-3 min-h-[60px]">
        {loading ? (
          <div className="flex items-center justify-center py-4 text-stone-400">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-xs">Scanning config files...</span>
          </div>
        ) : discoveryError ? (
          <div className="flex items-center justify-center py-4 text-red-500">
            <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
            <span className="text-xs">{discoveryError}</span>
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-stone-400">No MCP servers found</p>
            <p className="text-[10px] text-stone-300 mt-0.5">Checked Claude Code and Claude Desktop configs</p>
          </div>
        ) : (
          <div className="space-y-1">
            {servers.map((server) => {
              const key = getServerKey(server)
              const isImported = server.alreadyImported || imported.has(key)
              const TransportIcon = TRANSPORT_ICON[server.transport] ?? Globe
              const error = importErrors.get(key)

              return (
                <div
                  key={key}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                    isImported ? 'opacity-50' : 'hover:bg-stone-50',
                  )}
                >
                  <div className="flex items-center justify-center h-7 w-7 rounded-md bg-stone-100 shrink-0">
                    <TransportIcon className="h-3.5 w-3.5 text-stone-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-medium text-stone-600 truncate block">{server.name}</span>
                    {error && <span className="text-[10px] text-red-500">{error}</span>}
                  </div>

                  {isImported ? (
                    <Check className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleImport(server)}
                      className={cn(
                        'inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium rounded-lg transition-colors shrink-0',
                        'bg-amber-600 text-white hover:bg-amber-700',
                      )}
                    >
                      <Download className="h-3 w-3" />
                      Import
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
