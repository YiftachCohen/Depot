import { RPC_CHANNELS } from '@depot/shared/protocol'
import { getWorkspaceByNameOrId } from '@depot/shared/config'
import { pushTyped, type RpcServer } from '@depot/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.agentState.GET,
  RPC_CHANNELS.agentState.GET_MEMORY,
  RPC_CHANNELS.agentState.ADD_MEMORY,
  RPC_CHANNELS.agentState.DELETE_FACT,
  RPC_CHANNELS.agentState.CLEAR_MEMORY,
] as const

export function registerAgentStateHandlers(server: RpcServer, deps: HandlerDeps): void {
  const log = deps.platform.logger

  // Get full agent state for a skill
  server.handle(RPC_CHANNELS.agentState.GET, async (_ctx, workspaceId: string, skillSlug: string) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }
    const { loadAgentState } = await import('@depot/shared/skills')
    return loadAgentState(workspace.rootPath, skillSlug)
  })

  // Get just the memory facts
  server.handle(RPC_CHANNELS.agentState.GET_MEMORY, async (_ctx, workspaceId: string, skillSlug: string) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }
    const { loadAgentState } = await import('@depot/shared/skills')
    const state = loadAgentState(workspace.rootPath, skillSlug)
    return state?.memory?.facts ?? []
  })

  // Add memory facts
  server.handle(RPC_CHANNELS.agentState.ADD_MEMORY, async (_ctx, workspaceId: string, skillSlug: string, facts: string[]) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }
    const { addMemoryFacts } = await import('@depot/shared/skills')
    addMemoryFacts(workspace.rootPath, skillSlug, 'rpc', facts)
    log?.info(`AGENT_STATE: Added ${facts.length} memory facts for ${skillSlug}`)

    // Notify listeners
    pushTyped(server, RPC_CHANNELS.agentState.CHANGED, { to: 'workspace', workspaceId }, { skillSlug })
    return { added: facts.length }
  })

  // Delete a single memory fact
  server.handle(RPC_CHANNELS.agentState.DELETE_FACT, async (_ctx, workspaceId: string, skillSlug: string, factId: string) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }
    const { deleteMemoryFact } = await import('@depot/shared/skills')
    const deleted = deleteMemoryFact(workspace.rootPath, skillSlug, factId)
    if (deleted) {
      log?.info(`AGENT_STATE: Deleted memory fact ${factId} for ${skillSlug}`)
      pushTyped(server, RPC_CHANNELS.agentState.CHANGED, { to: 'workspace', workspaceId }, { skillSlug })
    }
    return { deleted }
  })

  // Clear all memory facts
  server.handle(RPC_CHANNELS.agentState.CLEAR_MEMORY, async (_ctx, workspaceId: string, skillSlug: string) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }
    const { loadAgentState, saveAgentState } = await import('@depot/shared/skills')
    const state = loadAgentState(workspace.rootPath, skillSlug)
    if (state) {
      state.memory.facts = []
      state.memory.updatedAt = Date.now()
      saveAgentState(workspace.rootPath, skillSlug, state)
      log?.info(`AGENT_STATE: Cleared memory for ${skillSlug}`)
    }

    // Notify listeners
    pushTyped(server, RPC_CHANNELS.agentState.CHANGED, { to: 'workspace', workspaceId }, { skillSlug })
    return { cleared: true }
  })
}
