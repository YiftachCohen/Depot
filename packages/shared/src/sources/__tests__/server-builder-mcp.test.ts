/**
 * Tests for SourceServerBuilder.buildMcpServer() URL handling.
 *
 * Verifies that MCP URLs are passed through as-is (no /mcp suffix appended),
 * matching the behavior of GET_MCP_TOOLS and TEST_CONNECTION handlers.
 * This prevents the bug where agent execution connects to a different URL
 * than what was validated during source setup.
 */

import { describe, test, expect } from 'bun:test';
import { SourceServerBuilder } from '../server-builder.ts';
import type { LoadedSource, FolderSourceConfig } from '../types.ts';

function createMcpSource(overrides: Partial<FolderSourceConfig> = {}): LoadedSource {
  return {
    config: {
      id: 'test-id',
      slug: 'test-mcp',
      name: 'Test MCP',
      type: 'mcp',
      enabled: true,
      isAuthenticated: true,
      mcp: {
        url: 'https://mcp.example.com',
        authType: 'oauth',
      },
      ...overrides,
    } as FolderSourceConfig,
    guide: null,
    folderPath: '/tmp/test/sources/test-mcp',
    workspaceRootPath: '/tmp/test',
    workspaceId: 'test-workspace',
  };
}

describe('SourceServerBuilder.buildMcpServer — URL handling', () => {
  const builder = new SourceServerBuilder();

  test('passes URL through without appending /mcp', () => {
    const source = createMcpSource({
      mcp: { url: 'https://todoist-mcp.example.com/v1', authType: 'none' },
    });

    const config = builder.buildMcpServer(source, null);

    expect(config).not.toBeNull();
    expect(config!.url).toBe('https://todoist-mcp.example.com/v1');
  });

  test('strips trailing slashes from URL', () => {
    const source = createMcpSource({
      mcp: { url: 'https://mcp.example.com/', authType: 'none' },
    });

    const config = builder.buildMcpServer(source, null);

    expect(config).not.toBeNull();
    expect(config!.url).toBe('https://mcp.example.com');
  });

  test('preserves URL that already ends with /mcp', () => {
    const source = createMcpSource({
      mcp: { url: 'https://mcp.example.com/mcp', authType: 'none' },
    });

    const config = builder.buildMcpServer(source, null);

    expect(config).not.toBeNull();
    expect(config!.url).toBe('https://mcp.example.com/mcp');
  });

  test('detects SSE type from URL containing /sse', () => {
    const source = createMcpSource({
      mcp: { url: 'https://mcp.example.com/sse', authType: 'none' },
    });

    const config = builder.buildMcpServer(source, null);

    expect(config).not.toBeNull();
    expect(config!.type).toBe('sse');
    expect(config!.url).toBe('https://mcp.example.com/sse');
  });

  test('defaults to http type for non-SSE URLs', () => {
    const source = createMcpSource({
      mcp: { url: 'https://mcp.example.com/v1', authType: 'none' },
    });

    const config = builder.buildMcpServer(source, null);

    expect(config).not.toBeNull();
    expect(config!.type).toBe('http');
  });

  test('adds Authorization header when token is provided', () => {
    const source = createMcpSource({
      mcp: { url: 'https://mcp.example.com', authType: 'oauth' },
    });

    const config = builder.buildMcpServer(source, 'my-token') as { headers?: Record<string, string> };

    expect(config).not.toBeNull();
    expect(config.headers).toEqual({ Authorization: 'Bearer my-token' });
  });

  test('returns null when auth required but token missing and source claims authenticated', () => {
    const source = createMcpSource({
      isAuthenticated: true,
      mcp: { url: 'https://mcp.example.com', authType: 'oauth' },
    });

    const config = builder.buildMcpServer(source, null);

    expect(config).toBeNull();
  });

  test('returns config without auth header when authType is none', () => {
    const source = createMcpSource({
      mcp: { url: 'https://mcp.example.com', authType: 'none' },
    });

    const config = builder.buildMcpServer(source, null) as { headers?: Record<string, string> };

    expect(config).not.toBeNull();
    expect(config.headers).toBeUndefined();
  });

  test('returns null for stdio source without command', () => {
    const source = createMcpSource({
      mcp: { transport: 'stdio' as const, command: '' },
    });

    const config = builder.buildMcpServer(source, null);

    expect(config).toBeNull();
  });

  test('builds stdio config when command is provided', () => {
    const source = createMcpSource({
      mcp: { transport: 'stdio' as const, command: 'npx', args: ['todoist-mcp'] },
    });

    const config = builder.buildMcpServer(source, null);

    expect(config).not.toBeNull();
    expect(config!.type).toBe('stdio');
  });
});
