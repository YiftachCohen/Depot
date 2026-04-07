/**
 * useSourceDiscovery — async lifecycle for discovering MCP servers.
 *
 * Owns ONLY the async operations (discover, import single server).
 * Selection and batch import state stays in consuming components.
 *
 * Extracted from DiscoverSourcesDialog.tsx to be reusable in both
 * the existing dialog and the CreateAgentFlow inline panel.
 */

import { useState, useCallback } from 'react'
import type { DiscoveredMcpServer } from '../../../../shared/types'

export interface UseSourceDiscoveryReturn {
  /** Discovered servers from the last scan */
  servers: DiscoveredMcpServer[]
  /** Whether a scan is in progress */
  loading: boolean
  /** Global discovery error (scan failure) */
  discoveryError: string | null
  /** Per-server import errors, keyed by server key */
  importErrors: Map<string, string>
  /** Servers successfully imported in this session */
  imported: Set<string>
  /** Start scanning for MCP servers */
  discover: () => Promise<void>
  /** Import a single discovered server */
  importServer: (server: DiscoveredMcpServer) => Promise<boolean>
  /** Get unique key for a server */
  getServerKey: (server: DiscoveredMcpServer) => string
  /** Reset all state */
  reset: () => void
}

function makeServerKey(server: DiscoveredMcpServer): string {
  return `${server.name}::${server.origin}::${server.transport}::${server.command ?? ''}::${server.url ?? ''}`
}

export function useSourceDiscovery(workspaceId: string): UseSourceDiscoveryReturn {
  const [servers, setServers] = useState<DiscoveredMcpServer[]>([])
  const [loading, setLoading] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [importErrors, setImportErrors] = useState<Map<string, string>>(new Map())
  const [imported, setImported] = useState<Set<string>>(new Set())

  const discover = useCallback(async () => {
    setLoading(true)
    setDiscoveryError(null)
    setServers([])
    setImportErrors(new Map())
    setImported(new Set())
    try {
      const result = await window.electronAPI.discoverGlobalMcpServers(workspaceId)
      setServers(result)
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : 'Failed to scan for MCP servers')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  const importServer = useCallback(async (server: DiscoveredMcpServer): Promise<boolean> => {
    const key = makeServerKey(server)
    try {
      await window.electronAPI.importDiscoveredServer(workspaceId, server.name, server.origin)
      setImported(prev => new Set(prev).add(key))
      return true
    } catch (err) {
      setImportErrors(prev => {
        const next = new Map(prev)
        next.set(key, err instanceof Error ? err.message : 'Import failed')
        return next
      })
      return false
    }
  }, [workspaceId])

  const reset = useCallback(() => {
    setServers([])
    setLoading(false)
    setDiscoveryError(null)
    setImportErrors(new Map())
    setImported(new Set())
  }, [])

  return {
    servers,
    loading,
    discoveryError,
    importErrors,
    imported,
    discover,
    importServer,
    getServerKey: makeServerKey,
    reset,
  }
}
