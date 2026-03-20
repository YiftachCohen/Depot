/**
 * Global MCP Server Discovery
 *
 * Scans system config files (Claude Code, Claude Desktop) for MCP server
 * configurations and returns them as discoverable sources that can be
 * imported into a Depot workspace.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { readJsonFileSync } from '../utils/files.ts';
import { loadWorkspaceSources } from './storage.ts';
import type { McpTransport } from './types.ts';
import { debug } from '../utils/debug.ts';

// ============================================================
// Types
// ============================================================

export interface DiscoveredMcpServer {
  /** Name from the mcpServers key */
  name: string;
  /** Which config file this was found in */
  origin: 'claude-code' | 'claude-code-local' | 'claude-desktop';
  /** Transport type inferred from config shape */
  transport: McpTransport;
  /** For stdio: the command to run */
  command?: string;
  /** For stdio: command arguments */
  args?: string[];
  /** For stdio: environment variables */
  env?: Record<string, string>;
  /** For http/sse: the server URL */
  url?: string;
  /** Whether a matching source already exists in the workspace */
  alreadyImported: boolean;
}

/**
 * Shape of an MCP server entry in Claude config files.
 * Both Claude Code and Claude Desktop use similar formats.
 */
interface RawMcpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  type?: string; // 'sse' | undefined
}

// ============================================================
// Config file paths
// ============================================================

function getConfigPaths(): Array<{ path: string; origin: DiscoveredMcpServer['origin'] }> {
  const home = homedir();
  const paths: Array<{ path: string; origin: DiscoveredMcpServer['origin'] }> = [
    { path: join(home, '.claude', 'settings.json'), origin: 'claude-code' },
    { path: join(home, '.claude', 'settings.local.json'), origin: 'claude-code-local' },
  ];

  // Claude Desktop config path is platform-specific
  if (process.platform === 'darwin') {
    paths.push({
      path: join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      origin: 'claude-desktop',
    });
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming');
    paths.push({
      path: join(appData, 'Claude', 'claude_desktop_config.json'),
      origin: 'claude-desktop',
    });
  } else {
    // Linux
    paths.push({
      path: join(home, '.config', 'Claude', 'claude_desktop_config.json'),
      origin: 'claude-desktop',
    });
  }

  return paths;
}

// ============================================================
// Parsing
// ============================================================

function inferTransport(config: RawMcpServerConfig): McpTransport {
  if (config.command) return 'stdio';
  if (config.type === 'sse') return 'sse';
  return 'http';
}

function parseConfigFile(
  filePath: string,
  origin: DiscoveredMcpServer['origin']
): DiscoveredMcpServer[] {
  if (!existsSync(filePath)) return [];

  try {
    const data = readJsonFileSync<Record<string, unknown>>(filePath);
    const mcpServers = data?.mcpServers as Record<string, RawMcpServerConfig> | undefined;
    if (!mcpServers || typeof mcpServers !== 'object') return [];

    const results: DiscoveredMcpServer[] = [];

    for (const [name, config] of Object.entries(mcpServers)) {
      if (!config || typeof config !== 'object') continue;

      const transport = inferTransport(config);

      // Skip malformed entries: stdio needs a command, http/sse needs a url
      if (transport === 'stdio') {
        if (typeof config.command !== 'string' || config.command.trim() === '') continue;
      } else {
        if (typeof config.url !== 'string' || config.url.trim() === '') continue;
      }

      const server: DiscoveredMcpServer = {
        name,
        origin,
        transport,
        alreadyImported: false,
      };

      if (transport === 'stdio') {
        server.command = config.command;
        server.args = config.args;
        if (config.env && Object.keys(config.env).length > 0) {
          server.env = config.env;
        }
      } else {
        server.url = config.url;
      }

      results.push(server);
    }

    return results;
  } catch (err) {
    debug(`[discovery] Failed to parse ${filePath}:`, err);
    return [];
  }
}

// ============================================================
// Deduplication
// ============================================================

function serializeArgs(args?: string[]): string {
  return JSON.stringify(args ?? []);
}

/**
 * Deduplicate servers across config files.
 * If the same server name appears in multiple files, prefer the more specific source:
 * claude-code-local > claude-code, and claude-desktop is always kept separately.
 */
function deduplicateServers(servers: DiscoveredMcpServer[]): DiscoveredMcpServer[] {
  const byKey = new Map<string, DiscoveredMcpServer>();

  for (const server of servers) {
    const transportKey = server.transport === 'stdio'
      ? `stdio:${server.command}:${serializeArgs(server.args)}`
      : `url:${server.url}`;
    // Include origin bucket so claude-desktop entries are never merged with claude-code
    const originBucket = server.origin === 'claude-desktop' ? 'claude-desktop' : 'claude-code';
    const key = `${originBucket}::${server.name}::${transportKey}`;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, server);
      continue;
    }

    // Prefer more specific: local > non-local
    if (server.origin === 'claude-code-local' && existing.origin === 'claude-code') {
      byKey.set(key, server);
    }
  }

  return Array.from(byKey.values());
}

// ============================================================
// Already-imported detection
// ============================================================

function checkAlreadyImported(
  servers: DiscoveredMcpServer[],
  workspaceRootPath: string
): void {
  const existingSources = loadWorkspaceSources(workspaceRootPath);
  const mcpSources = existingSources.filter(s => s.config.type === 'mcp' && s.config.mcp);

  for (const server of servers) {
    for (const source of mcpSources) {
      const mcp = source.config.mcp!;

      // Match by command + args (stdio)
      if (server.transport === 'stdio' && mcp.transport === 'stdio') {
        if (
          mcp.command === server.command &&
          serializeArgs(mcp.args) === serializeArgs(server.args)
        ) {
          server.alreadyImported = true;
          break;
        }
      }

      // Match by URL (http/sse)
      if (server.url && mcp.url) {
        if (mcp.url === server.url) {
          server.alreadyImported = true;
          break;
        }
      }

      // Match by slug/name
      const nameSlug = server.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (source.config.slug === nameSlug || source.config.name.toLowerCase() === server.name.toLowerCase()) {
        server.alreadyImported = true;
        break;
      }
    }
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Discover MCP servers configured globally on the user's system.
 * Scans Claude Code and Claude Desktop config files.
 *
 * @param workspaceRootPath - Used to check which servers are already imported
 * @returns Array of discovered MCP servers with import status
 */
export function discoverGlobalMcpServers(workspaceRootPath: string): DiscoveredMcpServer[] {
  const configPaths = getConfigPaths();
  const allServers: DiscoveredMcpServer[] = [];

  for (const { path, origin } of configPaths) {
    const servers = parseConfigFile(path, origin);
    allServers.push(...servers);
  }

  const deduplicated = deduplicateServers(allServers);
  checkAlreadyImported(deduplicated, workspaceRootPath);

  return deduplicated;
}
