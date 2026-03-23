/**
 * Tests for the getTokenForBuild pattern used in SessionManager.buildServersFromSources().
 *
 * Verifies that OAuth sources use ensureFreshToken() (which returns non-refreshable
 * tokens as-is without expiry check), while non-OAuth sources use getToken()
 * (which does check expiry).
 *
 * This test recreates the getTokenForBuild logic locally to test it in isolation
 * without pulling in the full SessionManager dependency tree.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { isOAuthSource, type LoadedSource, type FolderSourceConfig } from '../types.ts';
import { TokenRefreshManager, type TokenRefreshResult } from '../token-refresh-manager.ts';
import type { SourceCredentialManager } from '../credential-manager.ts';

// Mock storage module to prevent disk I/O
mock.module('../storage.ts', () => ({
  markSourceAuthenticated: mock(() => true),
}));

/**
 * Replicate the getTokenForBuild logic from SessionManager.
 * This is the exact same pattern — extracted here for isolated testing.
 */
async function getTokenForBuild(
  source: LoadedSource,
  credManager: SourceCredentialManager,
  tokenRefreshManager?: TokenRefreshManager
): Promise<string | null> {
  if (tokenRefreshManager && isOAuthSource(source)) {
    const result = await tokenRefreshManager.ensureFreshToken(source);
    return result.success ? (result.token ?? null) : null;
  }
  return credManager.getToken(source);
}

function createSource(overrides: Partial<FolderSourceConfig>): LoadedSource {
  return {
    config: {
      id: 'test-id',
      name: 'Test',
      slug: 'test',
      enabled: true,
      type: 'mcp',
      isAuthenticated: true,
      ...overrides,
    } as FolderSourceConfig,
    guide: null,
    folderPath: '/mock',
    workspaceRootPath: '/mock/workspace',
    workspaceId: 'mock-ws',
  };
}

function createMockCredManager(overrides: Partial<SourceCredentialManager> = {}): SourceCredentialManager {
  return {
    getToken: mock(async () => 'fallback-token'),
    load: mock(async () => null),
    save: mock(async () => {}),
    delete: mock(async () => false),
    getApiCredential: mock(async () => null),
    getCredentialId: mock(() => ({ type: 'source_oauth' as const, workspaceId: 'w', sourceId: 's' })),
    isExpired: mock(() => false),
    needsRefresh: mock(() => false),
    hasValidCredentials: mock(async () => true),
    markSourceNeedsReauth: mock(() => {}),
    detectProvider: mock(() => 'mcp' as const),
    prepareOAuth: mock(async () => ({} as any)),
    exchangeAndStore: mock(async () => ({ success: true })),
    authenticate: mock(async () => ({ success: true })),
    refresh: mock(async () => null),
    ...overrides,
  } as unknown as SourceCredentialManager;
}

describe('getTokenForBuild', () => {
  test('OAuth source with refresh manager delegates to ensureFreshToken', async () => {
    const mcpOAuthSource = createSource({
      type: 'mcp',
      mcp: { url: 'https://example.com', authType: 'oauth' },
    });

    const credManager = createMockCredManager({
      load: mock(async () => ({ value: 'old-token' })),
    });

    const refreshManager = new TokenRefreshManager(credManager);

    // ensureFreshToken will find no refresh token → return value as-is
    const token = await getTokenForBuild(mcpOAuthSource, credManager, refreshManager);

    // Should return the stored token (ensureFreshToken returns non-refreshable as-is)
    expect(token).toBe('old-token');
    // Should NOT have called getToken (the fallback path)
    expect(credManager.getToken).not.toHaveBeenCalled();
  });

  test('OAuth source without refresh manager falls back to getToken', async () => {
    const mcpOAuthSource = createSource({
      type: 'mcp',
      mcp: { url: 'https://example.com', authType: 'oauth' },
    });

    const credManager = createMockCredManager();

    const token = await getTokenForBuild(mcpOAuthSource, credManager, undefined);

    expect(token).toBe('fallback-token');
    expect(credManager.getToken).toHaveBeenCalled();
  });

  test('non-OAuth source always uses getToken regardless of refresh manager', async () => {
    const bearerSource = createSource({
      type: 'mcp',
      mcp: { url: 'https://example.com', authType: 'bearer' },
    });

    const credManager = createMockCredManager();
    const refreshManager = new TokenRefreshManager(credManager);

    const token = await getTokenForBuild(bearerSource, credManager, refreshManager);

    expect(token).toBe('fallback-token');
    expect(credManager.getToken).toHaveBeenCalled();
  });

  test('returns null when ensureFreshToken fails', async () => {
    const mcpOAuthSource = createSource({
      type: 'mcp',
      mcp: { url: 'https://example.com', authType: 'oauth' },
    });

    const credManager = createMockCredManager({
      load: mock(async () => null), // No credential at all
    });

    const refreshManager = new TokenRefreshManager(credManager);

    const token = await getTokenForBuild(mcpOAuthSource, credManager, refreshManager);

    expect(token).toBeNull();
  });

  test('API OAuth source (Google) uses ensureFreshToken', async () => {
    const googleSource = createSource({
      type: 'api',
      provider: 'google',
      api: { baseUrl: 'https://gmail.googleapis.com', authType: 'bearer' },
    });

    const credManager = createMockCredManager({
      load: mock(async () => ({ value: 'google-token' })),
    });

    const refreshManager = new TokenRefreshManager(credManager);

    const token = await getTokenForBuild(googleSource, credManager, refreshManager);

    expect(token).toBe('google-token');
    expect(credManager.getToken).not.toHaveBeenCalled();
  });
});
