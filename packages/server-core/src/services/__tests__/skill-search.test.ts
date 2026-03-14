import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { searchSessionsBySkill } from '../skill-search'

/**
 * Helper to create a session JSONL file with a header and messages.
 */
function createSessionJsonl(
  sessionsDir: string,
  sessionId: string,
  header: Record<string, unknown>,
  messages: Array<Record<string, unknown>> = []
): void {
  const sessionDir = join(sessionsDir, sessionId)
  mkdirSync(sessionDir, { recursive: true })

  const lines = [JSON.stringify(header)]
  for (const msg of messages) {
    lines.push(JSON.stringify(msg))
  }

  writeFileSync(join(sessionDir, 'session.jsonl'), lines.join('\n'), 'utf-8')
}

describe('searchSessionsBySkill', () => {
  let sessionsDir: string

  beforeEach(() => {
    sessionsDir = join(tmpdir(), `skill-search-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(sessionsDir, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(sessionsDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  it('finds matches in sessions with the matching skillSlug', async () => {
    createSessionJsonl(sessionsDir, 'session-1', {
      id: 'session-1',
      name: 'Test Session',
      skillSlug: 'my-skill',
      messageCount: 2,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, contextTokens: 0, costUsd: 0 },
    }, [
      { id: 'msg-1', type: 'user', content: 'Hello world, how do I deploy?' },
      { id: 'msg-2', type: 'assistant', content: 'You can deploy by running the deploy command.' },
    ])

    const results = await searchSessionsBySkill(sessionsDir, 'my-skill', 'deploy')

    expect(results).toHaveLength(1)
    expect(results[0]!.sessionId).toBe('session-1')
    expect(results[0]!.sessionName).toBe('Test Session')
    expect(results[0]!.skillSlug).toBe('my-skill')
    expect(results[0]!.matches).toHaveLength(2)
    expect(results[0]!.matches[0]!.role).toBe('user')
    expect(results[0]!.matches[0]!.snippet).toContain('deploy')
    expect(results[0]!.matches[1]!.role).toBe('assistant')
  })

  it('skips sessions without matching skillSlug', async () => {
    createSessionJsonl(sessionsDir, 'session-matching', {
      id: 'session-matching',
      name: 'Matching',
      skillSlug: 'target-skill',
      messageCount: 1,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, contextTokens: 0, costUsd: 0 },
    }, [
      { id: 'msg-1', type: 'user', content: 'Search for this text' },
    ])

    createSessionJsonl(sessionsDir, 'session-other', {
      id: 'session-other',
      name: 'Other Skill',
      skillSlug: 'other-skill',
      messageCount: 1,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, contextTokens: 0, costUsd: 0 },
    }, [
      { id: 'msg-1', type: 'user', content: 'Search for this text' },
    ])

    createSessionJsonl(sessionsDir, 'session-none', {
      id: 'session-none',
      name: 'No Skill',
      messageCount: 1,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, contextTokens: 0, costUsd: 0 },
    }, [
      { id: 'msg-1', type: 'user', content: 'Search for this text' },
    ])

    const results = await searchSessionsBySkill(sessionsDir, 'target-skill', 'Search')

    expect(results).toHaveLength(1)
    expect(results[0]!.sessionId).toBe('session-matching')
  })

  it('returns snippets with surrounding context', async () => {
    const longContent = 'A'.repeat(100) + ' deploy command here ' + 'B'.repeat(100)

    createSessionJsonl(sessionsDir, 'session-ctx', {
      id: 'session-ctx',
      name: 'Context Test',
      skillSlug: 'ctx-skill',
      messageCount: 1,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, contextTokens: 0, costUsd: 0 },
    }, [
      { id: 'msg-1', type: 'user', content: longContent },
    ])

    const results = await searchSessionsBySkill(sessionsDir, 'ctx-skill', 'deploy')

    expect(results).toHaveLength(1)
    const snippet = results[0]!.matches[0]!.snippet
    expect(snippet).toContain('deploy')
    // Should have ellipsis for truncated context
    expect(snippet).toContain('...')
    // Snippet should be shorter than the original content
    expect(snippet.length).toBeLessThan(longContent.length)
  })

  it('respects the limit option', async () => {
    // Create a session with many matching messages
    const messages = Array.from({ length: 10 }, (_, i) => ({
      id: `msg-${i}`,
      type: 'user' as const,
      content: `Message number ${i} about deployment`,
    }))

    createSessionJsonl(sessionsDir, 'session-limit', {
      id: 'session-limit',
      name: 'Limit Test',
      skillSlug: 'limit-skill',
      messageCount: messages.length,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, contextTokens: 0, costUsd: 0 },
    }, messages)

    const results = await searchSessionsBySkill(sessionsDir, 'limit-skill', 'deployment', { limit: 3 })

    const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0)
    expect(totalMatches).toBeLessThanOrEqual(3)
  })

  it('performs case-insensitive matching', async () => {
    createSessionJsonl(sessionsDir, 'session-case', {
      id: 'session-case',
      name: 'Case Test',
      skillSlug: 'case-skill',
      messageCount: 2,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, contextTokens: 0, costUsd: 0 },
    }, [
      { id: 'msg-1', type: 'user', content: 'DEPLOY the application' },
      { id: 'msg-2', type: 'assistant', content: 'Running Deploy now' },
    ])

    const results = await searchSessionsBySkill(sessionsDir, 'case-skill', 'deploy')

    expect(results).toHaveLength(1)
    expect(results[0]!.matches).toHaveLength(2)
  })

  it('returns empty array for empty query', async () => {
    createSessionJsonl(sessionsDir, 'session-empty', {
      id: 'session-empty',
      skillSlug: 'some-skill',
      messageCount: 1,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, contextTokens: 0, costUsd: 0 },
    }, [
      { id: 'msg-1', type: 'user', content: 'Some content' },
    ])

    const results = await searchSessionsBySkill(sessionsDir, 'some-skill', '')
    expect(results).toHaveLength(0)
  })

  it('returns empty array for non-existent sessions directory', async () => {
    const results = await searchSessionsBySkill('/nonexistent/path', 'skill', 'query')
    expect(results).toHaveLength(0)
  })

  it('skips intermediate messages', async () => {
    createSessionJsonl(sessionsDir, 'session-intermediate', {
      id: 'session-intermediate',
      name: 'Intermediate Test',
      skillSlug: 'int-skill',
      messageCount: 2,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, contextTokens: 0, costUsd: 0 },
    }, [
      { id: 'msg-1', type: 'assistant', content: 'Thinking about deploy...', isIntermediate: true },
      { id: 'msg-2', type: 'assistant', content: 'Here is how to deploy' },
    ])

    const results = await searchSessionsBySkill(sessionsDir, 'int-skill', 'deploy')

    expect(results).toHaveLength(1)
    // Only the non-intermediate message should match
    expect(results[0]!.matches).toHaveLength(1)
    expect(results[0]!.matches[0]!.snippet).toContain('Here is how to deploy')
  })
})
