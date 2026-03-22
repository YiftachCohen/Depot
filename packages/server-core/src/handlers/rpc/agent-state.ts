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
  RPC_CHANNELS.agentState.GET_KNOWLEDGE_STATS,
  RPC_CHANNELS.agentState.QUERY_KNOWLEDGE_ENTITIES,
  RPC_CHANNELS.agentState.QUERY_KNOWLEDGE_PATTERNS,
  RPC_CHANNELS.agentState.TRIGGER_CONSOLIDATION,
  RPC_CHANNELS.agentState.TRIGGER_OBSERVATION,
  RPC_CHANNELS.agentState.SET_OBSERVATION_PAUSED,
  RPC_CHANNELS.agentState.GET_OBSERVATION_HISTORY,
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

  // Get knowledge stats for a skill
  server.handle(RPC_CHANNELS.agentState.GET_KNOWLEDGE_STATS, async (_ctx, workspaceId: string, skillSlug: string) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }
    try {
      const { KnowledgeStoreManager } = await import('@depot/shared/skills/knowledge')
      const { loadSkillBySlug } = await import('@depot/shared/skills')
      const manager = KnowledgeStoreManager.getInstance()
      // Resolve the actual skill directory (handles global vs workspace skills)
      const skill = loadSkillBySlug(workspace.rootPath, skillSlug)
      const store = await manager.open(workspace.rootPath, skillSlug, skill?.path)
      return store.getStats()
    } catch {
      return { entityCount: 0, relationshipCount: 0, patternCount: 0, lastObservation: null, observationHealth: 'gray' }
    }
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

  // Query knowledge entities
  server.handle(RPC_CHANNELS.agentState.QUERY_KNOWLEDGE_ENTITIES, async (_ctx, workspaceId: string, skillSlug: string, options?: { domain?: string; entityType?: string; query?: string; tags?: string[]; limit?: number }) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
    try {
      const { KnowledgeStoreManager } = await import('@depot/shared/skills/knowledge')
      const { loadSkillBySlug } = await import('@depot/shared/skills')
      const skill = loadSkillBySlug(workspace.rootPath, skillSlug)
      const store = await KnowledgeStoreManager.getInstance().open(workspace.rootPath, skillSlug, skill?.path)
      const entities = store.queryEntities({
        domain: options?.domain,
        entityType: options?.entityType,
        query: options?.query,
        tags: options?.tags,
        limit: options?.limit ?? 100,
      })
      // For each entity, fetch relationships
      const entitiesWithRelationships = entities.map(entity => ({
        ...entity,
        relationships: store.queryRelationshipsForEntity(entity.id),
      }))
      return entitiesWithRelationships
    } catch (e) {
      log?.error?.(`AGENT_STATE: Failed to query knowledge entities for ${skillSlug}:`, e)
      return []
    }
  })

  // Query knowledge patterns
  server.handle(RPC_CHANNELS.agentState.QUERY_KNOWLEDGE_PATTERNS, async (_ctx, workspaceId: string, skillSlug: string, options?: { limit?: number }) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
    try {
      const { KnowledgeStoreManager } = await import('@depot/shared/skills/knowledge')
      const { loadSkillBySlug } = await import('@depot/shared/skills')
      const skill = loadSkillBySlug(workspace.rootPath, skillSlug)
      const store = await KnowledgeStoreManager.getInstance().open(workspace.rootPath, skillSlug, skill?.path)
      return store.queryPatterns(options?.limit ?? 100)
    } catch (e) {
      log?.error?.(`AGENT_STATE: Failed to query knowledge patterns for ${skillSlug}:`, e)
      return []
    }
  })

  // Trigger manual consolidation
  server.handle(RPC_CHANNELS.agentState.TRIGGER_CONSOLIDATION, async (_ctx, workspaceId: string, skillSlug: string) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
    const { KnowledgeStoreManager, runConsolidation } = await import('@depot/shared/skills/knowledge')
    const { loadSkillBySlug } = await import('@depot/shared/skills')
    const skill = loadSkillBySlug(workspace.rootPath, skillSlug)
    const store = await KnowledgeStoreManager.getInstance().open(workspace.rootPath, skillSlug, skill?.path)
    const result = await runConsolidation(store)
    log?.info(`AGENT_STATE: Consolidation for ${skillSlug}: dedup=${result.deduplicated}, decay=${result.decayed}, archive=${result.archived}, purge=${result.purged}`)
    pushTyped(server, RPC_CHANNELS.agentState.CHANGED, { to: 'workspace', workspaceId }, { skillSlug })
    return result
  })

  // Trigger manual observation
  server.handle(RPC_CHANNELS.agentState.TRIGGER_OBSERVATION, async (_ctx, workspaceId: string, skillSlug: string) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
    if (!deps.sessionManager) throw new Error('SessionManager not available')
    const { loadSkillBySlug } = await import('@depot/shared/skills')
    const skill = loadSkillBySlug(workspace.rootPath, skillSlug)
    const { checkObservationGuards } = await import('../../sessions/knowledge-observation-guards')
    const guardResult = await checkObservationGuards(
      workspace.rootPath,
      skillSlug,
      skill?.path,
      skill?.manifest?.knowledge?.tokenBudget?.perDay,
    )
    if (!guardResult.allowed) {
      throw new Error(`Observation blocked: ${guardResult.reason}`)
    }
    const { DEFAULT_OBSERVATION_PROMPT } = await import('@depot/shared/skills')
    const observationPrompt = skill?.manifest?.knowledge?.observationPrompt
      ?? DEFAULT_OBSERVATION_PROMPT
    const result = await deps.sessionManager.executePromptAutomation(
      workspaceId,
      workspace.rootPath,
      observationPrompt,
      ['__knowledge_observation__'],
      (skill?.manifest?.knowledge?.observationPermissionMode ?? 'safe') as any,
      undefined,
      undefined,
      undefined,
      `Knowledge observation: ${skillSlug}`,
      skillSlug,
    )
    if (!result.sessionId) {
      throw new Error(`Observation blocked: ${guardResult.reason ?? 'unknown reason'}`)
    }
    return result
  })

  // Set observation paused state
  server.handle(RPC_CHANNELS.agentState.SET_OBSERVATION_PAUSED, async (_ctx, workspaceId: string, skillSlug: string, paused: boolean) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
    const { loadAgentState, saveAgentState } = await import('@depot/shared/skills')
    const { loadSkillBySlug } = await import('@depot/shared/skills')
    const skill = loadSkillBySlug(workspace.rootPath, skillSlug)
    const state = loadAgentState(workspace.rootPath, skillSlug, skill?.path)
    if (!state) throw new Error(`Agent state not found for ${skillSlug}`)
    state.observationPaused = paused
    saveAgentState(workspace.rootPath, skillSlug, state, skill?.path)
    log?.info(`AGENT_STATE: Observation ${paused ? 'paused' : 'resumed'} for ${skillSlug}`)
    pushTyped(server, RPC_CHANNELS.agentState.CHANGED, { to: 'workspace', workspaceId }, { skillSlug })
    return { paused }
  })

  // Get observation history
  server.handle(RPC_CHANNELS.agentState.GET_OBSERVATION_HISTORY, async (_ctx, workspaceId: string, skillSlug: string) => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
    const { loadAgentState } = await import('@depot/shared/skills')
    const { loadSkillBySlug } = await import('@depot/shared/skills')
    const skill = loadSkillBySlug(workspace.rootPath, skillSlug)
    const state = loadAgentState(workspace.rootPath, skillSlug, skill?.path)
    return state?.observationHistory ?? []
  })
}
