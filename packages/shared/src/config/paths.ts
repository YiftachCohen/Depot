/**
 * Centralized path configuration for Depot.
 *
 * Supports multi-instance development via DEPOT_CONFIG_DIR environment variable.
 * When running from a numbered folder (e.g., depot-tui-agent-1), the detect-instance.sh
 * script sets DEPOT_CONFIG_DIR to ~/.depot-1, allowing multiple instances to run
 * simultaneously with separate configurations.
 *
 * Default (non-numbered folders): ~/.depot/
 * Instance 1 (-1 suffix): ~/.depot-1/
 * Instance 2 (-2 suffix): ~/.depot-2/
 */

import { homedir } from 'os';
import { join } from 'path';

// Allow override via environment variable for multi-instance dev
// Falls back to default ~/.depot/ for production and non-numbered dev folders
export const CONFIG_DIR = process.env.DEPOT_CONFIG_DIR || process.env.CRAFT_CONFIG_DIR || join(homedir(), '.depot');
