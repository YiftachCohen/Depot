/**
 * Tests for Source Auto-Resolution
 *
 * Verifies that resolveAgentSources correctly resolves skill manifest
 * sources against workspace source configs on disk.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveAgentSources } from '../source-resolution.ts';
import type { DepotSkillManifest } from '../types.ts';

// ============================================================
// Helpers
// ============================================================

let workspaceRoot: string;

beforeEach(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'source-res-test-'));
  // Create workspace sources directory
  mkdirSync(join(workspaceRoot, 'sources'), { recursive: true });
});

afterEach(() => {
  if (workspaceRoot && existsSync(workspaceRoot)) {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

/**
 * Create a source config on disk matching the format loadSource expects.
 */
function createSourceOnDisk(slug: string, opts: {
  enabled?: boolean;
  type?: string;
  provider?: string;
  authType?: string;
  isAuthenticated?: boolean;
} = {}) {
  const sourceDir = join(workspaceRoot, 'sources', slug);
  mkdirSync(sourceDir, { recursive: true });

  const config = {
    id: `${slug}_test1234`,
    name: slug,
    slug,
    enabled: opts.enabled ?? true,
    provider: opts.provider ?? slug,
    type: opts.type ?? 'mcp',
    createdAt: Date.now(),
    ...(opts.authType ? {
      mcp: { transport: 'http', url: 'https://example.com', authType: opts.authType },
      isAuthenticated: opts.isAuthenticated ?? false,
    } : {
      mcp: { transport: 'http', url: 'https://example.com' },
    }),
  };

  writeFileSync(join(sourceDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');
}

function makeManifest(overrides: Partial<DepotSkillManifest> = {}): DepotSkillManifest {
  return {
    name: 'Test Agent',
    icon: 'zap',
    description: 'Test',
    quick_commands: [{ name: 'Run', prompt: 'Go' }],
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('resolveAgentSources', () => {
  it('should return all-empty result when no sources are declared', async () => {
    const result = await resolveAgentSources(workspaceRoot, makeManifest());

    expect(result.resolved).toEqual([]);
    expect(result.created).toEqual([]);
    expect(result.needsAuth).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('should return all-empty result when sources is empty array', async () => {
    const result = await resolveAgentSources(workspaceRoot, makeManifest({ sources: [] }));

    expect(result.resolved).toEqual([]);
    expect(result.created).toEqual([]);
    expect(result.needsAuth).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('should resolve an existing usable source', async () => {
    createSourceOnDisk('github', { enabled: true });

    const result = await resolveAgentSources(workspaceRoot, makeManifest({
      sources: ['github'],
    }));

    expect(result.resolved).toEqual(['github']);
    expect(result.needsAuth).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('should mark source as needsAuth when auth is required but not authenticated', async () => {
    createSourceOnDisk('jira', { enabled: true, authType: 'oauth2', isAuthenticated: false });

    const result = await resolveAgentSources(workspaceRoot, makeManifest({
      sources: ['jira'],
    }));

    expect(result.resolved).toEqual([]);
    expect(result.needsAuth).toEqual(['jira']);
  });

  it('should resolve an authenticated source that requires auth', async () => {
    createSourceOnDisk('jira', { enabled: true, authType: 'oauth2', isAuthenticated: true });

    const result = await resolveAgentSources(workspaceRoot, makeManifest({
      sources: ['jira'],
    }));

    expect(result.resolved).toEqual(['jira']);
    expect(result.needsAuth).toEqual([]);
  });

  it('should warn for a source not on disk with no inline config', async () => {
    const result = await resolveAgentSources(workspaceRoot, makeManifest({
      sources: ['missing-source'],
    }));

    expect(result.resolved).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('missing-source');
    expect(result.warnings[0]).toContain('not found');
  });

  it('should auto-create a source from inline config when not on disk', async () => {
    const result = await resolveAgentSources(workspaceRoot, makeManifest({
      sources: ['new-api'],
      source_configs: {
        'new-api': {
          type: 'api',
          provider: 'custom-api',
          api: { baseUrl: 'https://api.example.com', authType: 'none' },
        },
      },
    }));

    expect(result.created).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it('should auto-create api source with missing authType defaulting to none', async () => {
    const result = await resolveAgentSources(workspaceRoot, makeManifest({
      sources: ['bad-api'],
      source_configs: {
        'bad-api': {
          type: 'api',
          provider: 'bad',
          api: { baseUrl: 'https://example.com' },
          // Missing authType → defaults to 'none'
        },
      },
    }));

    expect(result.created).toEqual(['bad-api']);
    expect(result.warnings).toEqual([]);
  });

  it('should handle a mixed scenario with multiple source states', async () => {
    // Usable source
    createSourceOnDisk('github', { enabled: true });
    // Source needing auth
    createSourceOnDisk('jira', { enabled: true, authType: 'oauth2', isAuthenticated: false });
    // 'slack' will be missing with no config → warning

    const result = await resolveAgentSources(workspaceRoot, makeManifest({
      sources: ['github', 'jira', 'slack'],
    }));

    expect(result.resolved).toEqual(['github']);
    expect(result.needsAuth).toEqual(['jira']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('slack');
  });

  it('should skip disabled sources (not included in any bucket)', async () => {
    createSourceOnDisk('disabled-src', { enabled: false });

    const result = await resolveAgentSources(workspaceRoot, makeManifest({
      sources: ['disabled-src'],
    }));

    // Disabled sources are intentionally skipped
    expect(result.resolved).toEqual([]);
    expect(result.needsAuth).toEqual([]);
    expect(result.created).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
