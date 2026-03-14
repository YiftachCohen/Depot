/**
 * @depot/shared
 *
 * Shared business logic for Depot.
 * Used by the Electron app.
 *
 * Import specific modules via subpath exports:
 *   import { DepotAgent } from '@depot/shared/agent';
 *   import { loadStoredConfig } from '@depot/shared/config';
 *   import { getCredentialManager } from '@depot/shared/credentials';
 *   import { DepotMcpClient } from '@depot/shared/mcp';
 *   import { debug } from '@depot/shared/utils';
 *   import { loadSource, createSource, getSourceCredentialManager } from '@depot/shared/sources';
 *   import { createWorkspace, loadWorkspace } from '@depot/shared/workspaces';
 *
 * Available modules:
 *   - agent: DepotAgent SDK wrapper, plan tools
 *   - auth: OAuth, token management, auth state
 *   - clients: Depot API client
 *   - config: Storage, models, preferences
 *   - credentials: Encrypted credential storage
 *   - mcp: MCP client, connection validation
 *   - prompts: System prompt generation
 *   - sources: Workspace-scoped source management (MCP, API, local)
 *   - utils: Debug logging, file handling, summarization
 *   - validation: URL validation
 *   - version: Version and installation management
 *   - workspaces: Workspace management (top-level organizational unit)
 */

// Export branding (standalone, no dependencies)
export * from './branding.ts';
