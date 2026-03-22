import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import {
  checkObservationGuards,
  setObservationFlag,
  trackObservationFailure,
} from './knowledge-observation-guards'
import { updateKnowledgeTokenUsage } from '@depot/shared/skills'

// Helper to create a temp workspace with agent state
function createTempWorkspace() {
  const dir = join(tmpdir(), `kobs-test-${randomUUID().slice(0, 8)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function writeAgentState(workspaceRoot: string, skillSlug: string, state: Record<string, unknown>) {
  const skillDir = join(workspaceRoot, 'skills', skillSlug)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'agent-state.json'), JSON.stringify(state))
}

function readAgentState(workspaceRoot: string, skillSlug: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(join(workspaceRoot, 'skills', skillSlug, 'agent-state.json'), 'utf-8'))
  } catch {
    return null
  }
}

function validState(overrides: Record<string, unknown> = {}) {
  return {
    agentId: randomUUID(),
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    sourceSetupStatus: {},
    memory: { facts: [], updatedAt: Date.now() },
    ...overrides,
  }
}

describe('checkObservationGuards', () => {
  let workspace: string

  beforeEach(() => { workspace = createTempWorkspace() })
  afterEach(() => { rmSync(workspace, { recursive: true, force: true }) })

  it('blocks when observationInProgress=true and startedAt < 1 hour ago', async () => {
    writeAgentState(workspace, 'test-agent', validState({
      observationInProgress: true,
      observationStartedAt: Date.now() - 30 * 60_000, // 30 min ago
    }))
    const result = await checkObservationGuards(workspace, 'test-agent')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('already in progress')
  })

  it('clears stale flag and allows when observationInProgress=true and startedAt > 1 hour ago', async () => {
    writeAgentState(workspace, 'test-agent', validState({
      observationInProgress: true,
      observationStartedAt: Date.now() - 2 * 3_600_000, // 2 hours ago
    }))
    const result = await checkObservationGuards(workspace, 'test-agent')
    expect(result.allowed).toBe(true)
    // Verify flag was cleared
    const state = readAgentState(workspace, 'test-agent')
    expect(state?.observationInProgress).toBe(false)
  })

  it('blocks when token budget exceeded for today', async () => {
    const today = new Intl.DateTimeFormat('en-CA').format(new Date())
    writeAgentState(workspace, 'test-agent', validState({
      knowledgeTokenUsage: { date: today, tokensUsed: 600_000 },
    }))
    const result = await checkObservationGuards(workspace, 'test-agent')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('token budget')
  })

  it('allows when token budget exceeded but date is yesterday', async () => {
    const yesterday = new Date(Date.now() - 86_400_000)
    const yesterdayStr = new Intl.DateTimeFormat('en-CA').format(yesterday)
    writeAgentState(workspace, 'test-agent', validState({
      knowledgeTokenUsage: { date: yesterdayStr, tokensUsed: 999_999 },
    }))
    const result = await checkObservationGuards(workspace, 'test-agent')
    expect(result.allowed).toBe(true)
  })

  it('allows when all guards pass', async () => {
    writeAgentState(workspace, 'test-agent', validState())
    const result = await checkObservationGuards(workspace, 'test-agent')
    expect(result.allowed).toBe(true)
  })

  it('treats missing agent state as empty (allows)', async () => {
    // No agent state file at all
    const result = await checkObservationGuards(workspace, 'test-agent')
    expect(result.allowed).toBe(true)
  })
})

describe('setObservationFlag', () => {
  let workspace: string

  beforeEach(() => { workspace = createTempWorkspace() })
  afterEach(() => { rmSync(workspace, { recursive: true, force: true }) })

  it('sets observationInProgress=true with timestamp', () => {
    writeAgentState(workspace, 'test-agent', validState())
    setObservationFlag(workspace, 'test-agent', true)
    const state = readAgentState(workspace, 'test-agent')
    expect(state?.observationInProgress).toBe(true)
    expect(typeof state?.observationStartedAt).toBe('number')
  })

  it('clears observationInProgress=false and removes timestamp', () => {
    writeAgentState(workspace, 'test-agent', validState({
      observationInProgress: true,
      observationStartedAt: Date.now(),
    }))
    setObservationFlag(workspace, 'test-agent', false)
    const state = readAgentState(workspace, 'test-agent')
    expect(state?.observationInProgress).toBe(false)
    expect(state?.observationStartedAt).toBeUndefined()
  })
})

describe('updateKnowledgeTokenUsage', () => {
  let workspace: string

  beforeEach(() => { workspace = createTempWorkspace() })
  afterEach(() => { rmSync(workspace, { recursive: true, force: true }) })

  it('adds tokens to existing same-day usage', () => {
    const today = new Intl.DateTimeFormat('en-CA').format(new Date())
    writeAgentState(workspace, 'test-agent', validState({
      knowledgeTokenUsage: { date: today, tokensUsed: 1000 },
    }))
    updateKnowledgeTokenUsage(workspace, 'test-agent', 500)
    const state = readAgentState(workspace, 'test-agent')
    expect((state?.knowledgeTokenUsage as any)?.tokensUsed).toBe(1500)
  })

  it('resets usage on new day', () => {
    const yesterday = new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() - 86_400_000))
    writeAgentState(workspace, 'test-agent', validState({
      knowledgeTokenUsage: { date: yesterday, tokensUsed: 9999 },
    }))
    updateKnowledgeTokenUsage(workspace, 'test-agent', 300)
    const state = readAgentState(workspace, 'test-agent')
    const today = new Intl.DateTimeFormat('en-CA').format(new Date())
    expect((state?.knowledgeTokenUsage as any)?.date).toBe(today)
    expect((state?.knowledgeTokenUsage as any)?.tokensUsed).toBe(300)
  })
})

describe('trackObservationFailure', () => {
  let workspace: string

  beforeEach(() => { workspace = createTempWorkspace() })
  afterEach(() => { rmSync(workspace, { recursive: true, force: true }) })

  it('increments counter on failure', () => {
    writeAgentState(workspace, 'test-agent', validState())
    trackObservationFailure(workspace, 'test-agent', true)
    const state = readAgentState(workspace, 'test-agent')
    expect((state as any)?.consecutiveObservationFailures).toBe(1)
  })

  it('resets counter on success', () => {
    writeAgentState(workspace, 'test-agent', validState({ consecutiveObservationFailures: 2 }))
    trackObservationFailure(workspace, 'test-agent', false)
    const state = readAgentState(workspace, 'test-agent')
    expect((state as any)?.consecutiveObservationFailures).toBe(0)
  })

  it('returns shouldNotify=true when counter reaches 3', () => {
    writeAgentState(workspace, 'test-agent', validState({ consecutiveObservationFailures: 2 }))
    const result = trackObservationFailure(workspace, 'test-agent', true)
    expect(result.shouldNotify).toBe(true)
  })

  it('returns shouldNotify=false when counter < 3', () => {
    writeAgentState(workspace, 'test-agent', validState({ consecutiveObservationFailures: 0 }))
    const result = trackObservationFailure(workspace, 'test-agent', true)
    expect(result.shouldNotify).toBe(false)
  })
})
