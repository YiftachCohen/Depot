/**
 * Feature flags for controlling experimental or in-development features.
 */

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

/**
 * Shared runtime detector for development/debug environments.
 *
 * Use this instead of app-specific debug flags (e.g., Electron main isDebugMode)
 * so behavior stays consistent across shared code and subprocess backends.
 */
export function isDevRuntime(): boolean {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  return nodeEnv === 'development' || nodeEnv === 'dev' || process.env.DEPOT_DEBUG === '1' || process.env.CRAFT_DEBUG === '1';
}

/**
 * Runtime-evaluated check for developer feedback feature.
 * Explicit env override has precedence over dev-runtime defaults.
 */
export function isDeveloperFeedbackEnabled(): boolean {
  const override = parseBooleanEnv(process.env.DEPOT_FEATURE_DEVELOPER_FEEDBACK ?? process.env.CRAFT_FEATURE_DEVELOPER_FEEDBACK);
  if (override !== undefined) return override;
  return isDevRuntime();
}

/**
 * Runtime-evaluated check for depot CLI integration.
 *
 * Defaults to disabled. Override with DEPOT_FEATURE_DEPOT_CLI=1|0.
 */
export function isDepotCliEnabled(): boolean {
  const override = parseBooleanEnv(process.env.DEPOT_FEATURE_DEPOT_CLI ?? process.env.CRAFT_FEATURE_CRAFT_AGENTS_CLI);
  if (override !== undefined) return override;
  return false;
}

/** @deprecated Use isDepotCliEnabled */
export const isCraftAgentsCliEnabled = isDepotCliEnabled;

export const FEATURE_FLAGS = {
  /** Enable Opus 4.6 fast mode (speed:"fast" + beta header). 6x pricing. */
  fastMode: false,
  /**
   * Enable agent developer feedback tool.
   *
   * Defaults to enabled in explicit development runtimes; disabled otherwise.
   * Override with DEPOT_FEATURE_DEVELOPER_FEEDBACK=1|0.
   */
  get developerFeedback(): boolean {
    return isDeveloperFeedbackEnabled();
  },
  /**
   * Enable depot CLI guidance and guardrails.
   *
   * Defaults to disabled. Override with DEPOT_FEATURE_DEPOT_CLI=1|0.
   */
  get craftAgentsCli(): boolean {
    return isDepotCliEnabled();
  },
} as const;
