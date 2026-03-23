/**
 * Token loading for server config building.
 *
 * Extracted from SessionManager so it can be tested directly against
 * the real implementation (not a duplicated copy).
 */

import { isOAuthSource, type LoadedSource } from './types.ts';
import type { SourceCredentialManager } from './credential-manager.ts';
import type { TokenRefreshManager } from './token-refresh-manager.ts';

/**
 * Get a token for building server configs.
 *
 * For OAuth sources with a TokenRefreshManager, uses ensureFreshToken() which:
 * - Returns non-refreshable tokens as-is (no expiry check — avoids rejecting
 *   tokens that the server still accepts but our client-side expiresAt considers expired)
 * - Refreshes expired tokens that have a refresh token
 * - Applies rate limiting to prevent hammering
 *
 * For non-OAuth sources, falls back to getToken() which checks expiry.
 */
export async function getTokenForBuild(
  source: LoadedSource,
  credManager: SourceCredentialManager,
  tokenRefreshManager?: TokenRefreshManager
): Promise<string | null> {
  if (tokenRefreshManager && isOAuthSource(source)) {
    const result = await tokenRefreshManager.ensureFreshToken(source)
    return result.success ? (result.token ?? null) : null
  }
  return credManager.getToken(source)
}
