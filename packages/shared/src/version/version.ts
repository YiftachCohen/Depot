import { debug } from "../utils/debug";
import { getLatestVersion } from "./manifest";

declare const DEPOT_CLI_VERSION: string | undefined;

export function getCurrentVersion(): string {
  if (typeof DEPOT_CLI_VERSION !== 'undefined' && DEPOT_CLI_VERSION != null) {
    return DEPOT_CLI_VERSION;
  }
  return "0.0.1";
}

export type UpdateCheckResult =
  | { status: 'up-to-date' }
  | { status: 'update-available'; latestVersion: string }
  | { status: 'check-failed' };

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentVersion();
  const latestVersion = await getLatestVersion();
  if (latestVersion == null) {
    debug('[version] Update check failed — could not reach update server');
    return { status: 'check-failed' };
  }
  if (currentVersion === latestVersion) {
    return { status: 'up-to-date' };
  }
  return { status: 'update-available', latestVersion };
}

/**
 * @deprecated Use checkForUpdate() which distinguishes fetch failures from up-to-date.
 */
export async function isUpToDate(): Promise<boolean> {
  const result = await checkForUpdate();
  return result.status !== 'update-available';
}

/**
 * Returns the latest version or null if the app is up to date or check failed.
 */
export async function getUpdateToVersion(): Promise<string | null> {
  const result = await checkForUpdate();
  if (result.status === 'update-available') {
    return result.latestVersion;
  }
  return null;
}
