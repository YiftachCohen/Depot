/**
 * Tests for Agent State Storage
 *
 * Verifies the lifecycle of agent state persistence: initialization,
 * load/save round-trips, and touch operations.
 * Memory operations have been removed — facts are now stored via Knowledge Fabric.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  loadAgentState,
  saveAgentState,
  initAgentState,
  touchAgentState,
  getAgentStatePath,
} from '../agent-state.ts';
import type { AgentState } from '../agent-state.ts';

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

  it('should return a valid AgentState with UUID and timestamps', () => {
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
    // memory should not be created by default
    expect(state.memory).toBeUndefined();
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
      sourceSetupStatus: {},
    }), 'utf-8');

    const state = loadAgentState(workspaceRoot, 'missing-id');
    expect(state).toBeNull();
  });

  it('should load state without memory field (memory is now optional)', () => {
    const skillDir = join(workspaceRoot, 'skills', 'no-mem');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'agent-state.json'), JSON.stringify({
      agentId: 'abc',
      createdAt: 1,
      lastActiveAt: 1,
      sourceSetupStatus: {},
    }), 'utf-8');

    const state = loadAgentState(workspaceRoot, 'no-mem');
    expect(state).not.toBeNull();
    expect(state!.agentId).toBe('abc');
  });

  it('should load state with legacy memory field', () => {
    const skillDir = join(workspaceRoot, 'skills', 'legacy-mem');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'agent-state.json'), JSON.stringify({
      agentId: 'abc',
      createdAt: 1,
      lastActiveAt: 1,
      sourceSetupStatus: {},
      memory: { facts: [{ id: 'f1', content: 'test', createdAt: 1, sourceSessionId: 's1' }], updatedAt: 1 },
    }), 'utf-8');

    const state = loadAgentState(workspaceRoot, 'legacy-mem');
    expect(state).not.toBeNull();
    expect(state!.agentId).toBe('abc');
    expect(state!.memory?.facts).toHaveLength(1);
  });

  it('should load a valid state from disk', () => {
    const original = initAgentState(workspaceRoot, 'round-trip');
    const loaded = loadAgentState(workspaceRoot, 'round-trip');

    expect(loaded).not.toBeNull();
    expect(loaded!.agentId).toBe(original.agentId);
    expect(loaded!.createdAt).toBe(original.createdAt);
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
    };

    saveAgentState(workspaceRoot, 'save-test', state);
    const loaded = loadAgentState(workspaceRoot, 'save-test');

    expect(loaded).not.toBeNull();
    expect(loaded!.agentId).toBe('test-uuid');
    expect(loaded!.sourceSetupStatus.github).toBe('configured');
  });

  it('should create directories if they do not exist', () => {
    const skillDir = join(workspaceRoot, 'skills', 'deep-agent');
    expect(existsSync(skillDir)).toBe(false);

    const state: AgentState = {
      agentId: 'x',
      createdAt: 1,
      lastActiveAt: 1,
      sourceSetupStatus: {},
    };
    saveAgentState(workspaceRoot, 'deep-agent', state);

    expect(existsSync(skillDir)).toBe(true);
  });
});

// ============================================================
// Tests: touchAgentState
// ============================================================

describe('touchAgentState', () => {
  it('should update lastActiveAt without changing other fields', () => {
    const original = initAgentState(workspaceRoot, 'touch-test');

    const beforeTouch = loadAgentState(workspaceRoot, 'touch-test');
    touchAgentState(workspaceRoot, 'touch-test');
    const afterTouch = loadAgentState(workspaceRoot, 'touch-test');

    expect(afterTouch!.lastActiveAt).toBeGreaterThanOrEqual(beforeTouch!.lastActiveAt);
    expect(afterTouch!.agentId).toBe(original.agentId);
  });

  it('should be a no-op if agent state does not exist', () => {
    touchAgentState(workspaceRoot, 'no-state');
    expect(loadAgentState(workspaceRoot, 'no-state')).toBeNull();
  });
});
