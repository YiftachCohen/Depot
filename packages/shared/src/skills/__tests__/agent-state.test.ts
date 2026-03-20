/**
 * Tests for Agent State Storage
 *
 * Verifies the lifecycle of agent state persistence: initialization,
 * load/save round-trips, memory operations, and prompt formatting.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  loadAgentState,
  saveAgentState,
  initAgentState,
  addMemoryFacts,
  deleteMemoryFact,
  replaceMemoryFacts,
  touchAgentState,
  formatAgentMemoryForPrompt,
  getAgentStatePath,
  MEMORY_CONSOLIDATION_THRESHOLD,
} from '../agent-state.ts';
import type { AgentState, AgentMemoryFact } from '../agent-state.ts';

// ============================================================
// Temp Directory Setup
// ============================================================

let workspaceRoot: string;

beforeEach(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'agent-state-test-'));
});

afterEach(() => {
  if (workspaceRoot && existsSync(workspaceRoot)) {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

// ============================================================
// Tests: getAgentStatePath
// ============================================================

describe('getAgentStatePath', () => {
  it('should return the correct path under skills/{slug}', () => {
    const path = getAgentStatePath('/workspace', 'my-agent');
    expect(path).toBe('/workspace/skills/my-agent/agent-state.json');
  });
});

// ============================================================
// Tests: initAgentState
// ============================================================

describe('initAgentState', () => {
  it('should create a state file on disk', () => {
    const state = initAgentState(workspaceRoot, 'test-agent');
    const filePath = getAgentStatePath(workspaceRoot, 'test-agent');
    expect(existsSync(filePath)).toBe(true);
  });

  it('should return a valid AgentState with UUID, empty facts, and timestamps', () => {
    const before = Date.now();
    const state = initAgentState(workspaceRoot, 'test-agent');
    const after = Date.now();

    expect(state.agentId).toBeDefined();
    expect(state.agentId.length).toBeGreaterThan(0);
    expect(state.createdAt).toBeGreaterThanOrEqual(before);
    expect(state.createdAt).toBeLessThanOrEqual(after);
    expect(state.lastActiveAt).toBeGreaterThanOrEqual(before);
    expect(state.lastActiveAt).toBeLessThanOrEqual(after);
    expect(state.sourceSetupStatus).toEqual({});
    expect(state.memory.facts).toEqual([]);
    expect(state.memory.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('should create skill directory if it does not exist', () => {
    const skillDir = join(workspaceRoot, 'skills', 'new-agent');
    expect(existsSync(skillDir)).toBe(false);

    initAgentState(workspaceRoot, 'new-agent');
    expect(existsSync(skillDir)).toBe(true);
  });
});

// ============================================================
// Tests: loadAgentState
// ============================================================

describe('loadAgentState', () => {
  it('should return null when file does not exist', () => {
    const state = loadAgentState(workspaceRoot, 'nonexistent');
    expect(state).toBeNull();
  });

  it('should return null for malformed JSON', () => {
    const skillDir = join(workspaceRoot, 'skills', 'bad-json');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'agent-state.json'), '{invalid json!!!}', 'utf-8');

    const state = loadAgentState(workspaceRoot, 'bad-json');
    expect(state).toBeNull();
  });

  it('should return null for JSON missing agentId', () => {
    const skillDir = join(workspaceRoot, 'skills', 'missing-id');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'agent-state.json'), JSON.stringify({
      memory: { facts: [], updatedAt: 1 },
    }), 'utf-8');

    const state = loadAgentState(workspaceRoot, 'missing-id');
    expect(state).toBeNull();
  });

  it('should return null for JSON missing memory', () => {
    const skillDir = join(workspaceRoot, 'skills', 'missing-mem');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'agent-state.json'), JSON.stringify({
      agentId: 'abc',
    }), 'utf-8');

    const state = loadAgentState(workspaceRoot, 'missing-mem');
    expect(state).toBeNull();
  });

  it('should load a valid state from disk', () => {
    const original = initAgentState(workspaceRoot, 'round-trip');
    const loaded = loadAgentState(workspaceRoot, 'round-trip');

    expect(loaded).not.toBeNull();
    expect(loaded!.agentId).toBe(original.agentId);
    expect(loaded!.createdAt).toBe(original.createdAt);
    expect(loaded!.memory.facts).toEqual([]);
  });
});

// ============================================================
// Tests: saveAgentState
// ============================================================

describe('saveAgentState', () => {
  it('should write state that round-trips through load', () => {
    const state: AgentState = {
      agentId: 'test-uuid',
      createdAt: 1000,
      lastActiveAt: 2000,
      sourceSetupStatus: { github: 'configured' },
      memory: {
        facts: [
          { id: 'f1', content: 'User likes TypeScript', createdAt: 1500, sourceSessionId: 's1' },
        ],
        updatedAt: 1500,
      },
    };

    saveAgentState(workspaceRoot, 'save-test', state);
    const loaded = loadAgentState(workspaceRoot, 'save-test');

    expect(loaded).not.toBeNull();
    expect(loaded!.agentId).toBe('test-uuid');
    expect(loaded!.sourceSetupStatus.github).toBe('configured');
    expect(loaded!.memory.facts).toHaveLength(1);
    expect(loaded!.memory.facts[0]!.content).toBe('User likes TypeScript');
  });

  it('should create directories if they do not exist', () => {
    const skillDir = join(workspaceRoot, 'skills', 'deep-agent');
    expect(existsSync(skillDir)).toBe(false);

    const state: AgentState = {
      agentId: 'x',
      createdAt: 1,
      lastActiveAt: 1,
      sourceSetupStatus: {},
      memory: { facts: [], updatedAt: 1 },
    };
    saveAgentState(workspaceRoot, 'deep-agent', state);

    expect(existsSync(skillDir)).toBe(true);
  });
});

// ============================================================
// Tests: addMemoryFacts
// ============================================================

describe('addMemoryFacts', () => {
  it('should add facts to an existing agent state', () => {
    initAgentState(workspaceRoot, 'add-test');
    addMemoryFacts(workspaceRoot, 'add-test', 'session-1', ['Fact A', 'Fact B']);

    const state = loadAgentState(workspaceRoot, 'add-test');
    expect(state!.memory.facts).toHaveLength(2);
    expect(state!.memory.facts[0]!.content).toBe('Fact A');
    expect(state!.memory.facts[1]!.content).toBe('Fact B');
  });

  it('should initialize agent state if none exists', () => {
    addMemoryFacts(workspaceRoot, 'auto-init', 'session-1', ['First fact']);

    const state = loadAgentState(workspaceRoot, 'auto-init');
    expect(state).not.toBeNull();
    expect(state!.agentId).toBeDefined();
    expect(state!.memory.facts).toHaveLength(1);
  });

  it('should be a no-op for empty facts array', () => {
    initAgentState(workspaceRoot, 'noop');
    const before = loadAgentState(workspaceRoot, 'noop');

    addMemoryFacts(workspaceRoot, 'noop', 'session-1', []);

    const after = loadAgentState(workspaceRoot, 'noop');
    expect(after!.memory.facts).toHaveLength(0);
    // updatedAt should not change
    expect(after!.memory.updatedAt).toBe(before!.memory.updatedAt);
  });

  it('should assign unique IDs and correct sessionId to each fact', () => {
    addMemoryFacts(workspaceRoot, 'ids-test', 'sess-42', ['A', 'B']);

    const state = loadAgentState(workspaceRoot, 'ids-test');
    const ids = state!.memory.facts.map(f => f.id);
    expect(new Set(ids).size).toBe(2); // unique
    expect(state!.memory.facts[0]!.sourceSessionId).toBe('sess-42');
    expect(state!.memory.facts[1]!.sourceSessionId).toBe('sess-42');
  });

  it('should trim fact content', () => {
    addMemoryFacts(workspaceRoot, 'trim-test', 'session-1', ['  padded fact  ']);

    const state = loadAgentState(workspaceRoot, 'trim-test');
    expect(state!.memory.facts[0]!.content).toBe('padded fact');
  });

  it('should accumulate facts across multiple calls', () => {
    addMemoryFacts(workspaceRoot, 'accum', 'sess-1', ['Fact 1']);
    addMemoryFacts(workspaceRoot, 'accum', 'sess-2', ['Fact 2', 'Fact 3']);

    const state = loadAgentState(workspaceRoot, 'accum');
    expect(state!.memory.facts).toHaveLength(3);
  });
});

// ============================================================
// Tests: deleteMemoryFact
// ============================================================

describe('deleteMemoryFact', () => {
  it('should delete a fact by ID and return true', () => {
    addMemoryFacts(workspaceRoot, 'del-test', 'sess-1', ['Fact A', 'Fact B']);
    const state = loadAgentState(workspaceRoot, 'del-test');
    const factId = state!.memory.facts[0]!.id;

    const result = deleteMemoryFact(workspaceRoot, 'del-test', factId);
    expect(result).toBe(true);

    const after = loadAgentState(workspaceRoot, 'del-test');
    expect(after!.memory.facts).toHaveLength(1);
    expect(after!.memory.facts[0]!.content).toBe('Fact B');
  });

  it('should return false for non-existent fact ID', () => {
    addMemoryFacts(workspaceRoot, 'del-miss', 'sess-1', ['Fact A']);
    const result = deleteMemoryFact(workspaceRoot, 'del-miss', 'nonexistent');
    expect(result).toBe(false);

    const state = loadAgentState(workspaceRoot, 'del-miss');
    expect(state!.memory.facts).toHaveLength(1);
  });

  it('should return false when agent state does not exist', () => {
    const result = deleteMemoryFact(workspaceRoot, 'ghost', 'any-id');
    expect(result).toBe(false);
  });
});

// ============================================================
// Tests: replaceMemoryFacts
// ============================================================

describe('replaceMemoryFacts', () => {
  it('should replace all facts and set consolidatedAt', () => {
    addMemoryFacts(workspaceRoot, 'replace-test', 'sess-1', ['Old A', 'Old B', 'Old C']);

    const consolidated: AgentMemoryFact[] = [
      { id: 'c1', content: 'Merged fact', createdAt: Date.now(), sourceSessionId: 'consolidation' },
    ];
    replaceMemoryFacts(workspaceRoot, 'replace-test', consolidated);

    const state = loadAgentState(workspaceRoot, 'replace-test');
    expect(state!.memory.facts).toHaveLength(1);
    expect(state!.memory.facts[0]!.content).toBe('Merged fact');
    expect(state!.memory.consolidatedAt).toBeDefined();
  });

  it('should be a no-op if agent state does not exist', () => {
    replaceMemoryFacts(workspaceRoot, 'ghost', []);
    expect(loadAgentState(workspaceRoot, 'ghost')).toBeNull();
  });
});

// ============================================================
// Tests: touchAgentState
// ============================================================

describe('touchAgentState', () => {
  it('should update lastActiveAt without changing other fields', () => {
    const original = initAgentState(workspaceRoot, 'touch-test');
    addMemoryFacts(workspaceRoot, 'touch-test', 'sess-1', ['Remember this']);

    // Small delay to ensure timestamp differs
    const beforeTouch = loadAgentState(workspaceRoot, 'touch-test');
    touchAgentState(workspaceRoot, 'touch-test');
    const afterTouch = loadAgentState(workspaceRoot, 'touch-test');

    expect(afterTouch!.lastActiveAt).toBeGreaterThanOrEqual(beforeTouch!.lastActiveAt);
    expect(afterTouch!.agentId).toBe(original.agentId);
    expect(afterTouch!.memory.facts).toHaveLength(1);
  });

  it('should be a no-op if agent state does not exist', () => {
    touchAgentState(workspaceRoot, 'no-state');
    expect(loadAgentState(workspaceRoot, 'no-state')).toBeNull();
  });
});

// ============================================================
// Tests: formatAgentMemoryForPrompt
// ============================================================

describe('formatAgentMemoryForPrompt', () => {
  it('should return empty string for null state', () => {
    expect(formatAgentMemoryForPrompt(null)).toBe('');
  });

  it('should return empty string for state with zero facts', () => {
    const state = initAgentState(workspaceRoot, 'empty-mem');
    expect(formatAgentMemoryForPrompt(state)).toBe('');
  });

  it('should return XML block with bullet points for populated facts', () => {
    addMemoryFacts(workspaceRoot, 'fmt-test', 'sess-1', ['Likes TypeScript', 'Uses Bun']);
    const state = loadAgentState(workspaceRoot, 'fmt-test');

    const result = formatAgentMemoryForPrompt(state, 'fmt-test');

    expect(result).toContain('<agent_memory skill="fmt-test">');
    expect(result).toContain('- Likes TypeScript');
    expect(result).toContain('- Uses Bun');
    expect(result).toContain('</agent_memory>');
  });

  it('should default skill name to "agent" when not provided', () => {
    addMemoryFacts(workspaceRoot, 'default-slug', 'sess-1', ['A fact']);
    const state = loadAgentState(workspaceRoot, 'default-slug');

    const result = formatAgentMemoryForPrompt(state);
    expect(result).toContain('<agent_memory skill="agent">');
  });
});

// ============================================================
// Tests: MEMORY_CONSOLIDATION_THRESHOLD
// ============================================================

describe('MEMORY_CONSOLIDATION_THRESHOLD', () => {
  it('should equal 50', () => {
    expect(MEMORY_CONSOLIDATION_THRESHOLD).toBe(50);
  });
});
