/**
 * Centralized branding assets for Depot
 * Used by OAuth callback pages
 */

export const DEPOT_LOGO = [
  '  ████████ █████████    ██████   ██████████ ██████████',
  '██████████ ██████████ ██████████ █████████  ██████████',
  '██████     ██████████ ██████████ ████████   ██████████',
  '██████████ ████████   ██████████ ███████      ██████  ',
  '  ████████ ████  ████ ████  ████ █████        ██████  ',
] as const;

/** @deprecated Use DEPOT_LOGO instead */
export const CRAFT_LOGO = DEPOT_LOGO;

/** Logo as a single string for HTML templates */
export const DEPOT_LOGO_HTML = DEPOT_LOGO.map((line) => line.trimEnd()).join('\n');

/** @deprecated Use DEPOT_LOGO_HTML instead */
export const CRAFT_LOGO_HTML = DEPOT_LOGO_HTML;

/** Session viewer base URL */
export const VIEWER_URL = 'https://agents.depot.do';
