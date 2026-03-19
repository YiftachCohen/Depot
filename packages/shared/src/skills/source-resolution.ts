/**
 * Source Auto-Resolution
 *
 * Resolves sources declared in a skill manifest, auto-creating
 * workspace sources from inline configs when they don't yet exist.
 */

import { loadSource, createSource, isSourceUsable } from '../sources/storage.ts';
import type { CreateSourceInput, SourceMcpAuthType, ApiAuthType } from '../sources/types.ts';
import type { DepotSkillManifest, InlineSourceConfig } from './types.ts';

const VALID_MCP_AUTH_TYPES: ReadonlySet<string> = new Set<SourceMcpAuthType>(['oauth', 'bearer', 'none']);
const VALID_API_AUTH_TYPES: ReadonlySet<string> = new Set<ApiAuthType>(['bearer', 'header', 'query', 'basic', 'oauth', 'none']);

/**
 * Result of resolving a skill's declared sources against the workspace.
 */
export interface SourceResolutionResult {
  /** Slugs of sources that are ready to use */
  resolved: string[];
  /** Slugs of sources that were auto-created from inline configs */
  created: string[];
  /** Slugs of sources that exist but need authentication */
  needsAuth: string[];
  /** Warning messages for unresolvable slugs */
  warnings: string[];
}

/**
 * Convert an InlineSourceConfig from a manifest into a CreateSourceInput
 * suitable for the existing `createSource()` function.
 */
function toCreateSourceInput(slug: string, inline: InlineSourceConfig): CreateSourceInput {
  const input: CreateSourceInput = {
    name: slug,
    provider: inline.provider,
    type: inline.type,
    icon: inline.icon,
    enabled: true,
  };

  if (inline.type === 'mcp' && inline.mcp) {
    input.mcp = {
      transport: inline.mcp.transport,
      url: inline.mcp.url,
      command: inline.mcp.command,
      args: inline.mcp.args,
      authType: inline.mcp.authType && VALID_MCP_AUTH_TYPES.has(inline.mcp.authType)
        ? inline.mcp.authType as SourceMcpAuthType
        : undefined,
    };
  } else if (inline.type === 'api' && inline.api) {
    input.api = {
      baseUrl: inline.api.baseUrl,
      authType: inline.api.authType && VALID_API_AUTH_TYPES.has(inline.api.authType)
        ? inline.api.authType as ApiAuthType
        : 'none',
    };
  } else if (inline.type === 'local' && inline.local) {
    input.local = {
      path: inline.local.path,
    };
  }

  return input;
}

/**
 * Resolve all sources declared in a skill manifest against the workspace.
 *
 * For each slug in `manifest.sources`:
 * 1. If the workspace source exists and is usable → resolved
 * 2. If the workspace source exists but needs auth → needsAuth
 * 3. If not found and `manifest.source_configs[slug]` exists → auto-create → created
 * 4. If not found and no inline config → warning
 */
export async function resolveAgentSources(
  workspaceRootPath: string,
  manifest: DepotSkillManifest,
): Promise<SourceResolutionResult> {
  const result: SourceResolutionResult = {
    resolved: [],
    created: [],
    needsAuth: [],
    warnings: [],
  };

  const slugs = manifest.sources ?? [];
  if (slugs.length === 0) return result;

  for (const slug of slugs) {
    // 1. Try loading existing workspace source
    const existing = loadSource(workspaceRootPath, slug);

    if (existing) {
      if (isSourceUsable(existing)) {
        result.resolved.push(slug);
      } else {
        result.needsAuth.push(slug);
      }
      continue;
    }

    // 2. Not found — try auto-creating from inline config
    const inlineConfig = manifest.source_configs?.[slug];
    if (inlineConfig) {
      try {
        const input = toCreateSourceInput(slug, inlineConfig);
        await createSource(workspaceRootPath, input);
        result.created.push(slug);
      } catch (err) {
        result.warnings.push(`Failed to auto-create source "${slug}": ${err instanceof Error ? err.message : String(err)}`);
      }
      continue;
    }

    // 3. No config available
    result.warnings.push(`Source "${slug}" not found in workspace and no inline config provided`);
  }

  return result;
}
