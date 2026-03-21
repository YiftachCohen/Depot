/**
 * Icon Constants
 *
 * Pure constants and functions for icon handling.
 * NO Node.js dependencies - safe for browser/renderer import.
 *
 * These are extracted from icon.ts so renderer code can import them
 * without pulling in fs/path dependencies.
 */

// ============================================================
// Constants
// ============================================================

/**
 * Comprehensive emoji detection regex.
 * Matches single emoji, emoji sequences, and multi-codepoint emoji (e.g., 👨‍💻).
 */
export const EMOJI_REGEX = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u;

/**
 * Supported icon file extensions in priority order.
 */
export const ICON_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.ico', '.webp', '.gif'];

// ============================================================
// Pure Functions (no Node.js dependencies)
// ============================================================

/**
 * Check if a string is an emoji (single or multi-codepoint).
 * Examples: "🔧", "👨‍💻", "🎉"
 */
export function isEmoji(str: string | undefined): boolean {
  if (!str || str.length === 0) return false;
  // Emoji should be short - most are under 20 chars even with modifiers
  if (str.length > 20) return false;
  return EMOJI_REGEX.test(str);
}

/**
 * Check if a string is a valid icon URL (http or https).
 */
export function isIconUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://');
}

/**
 * Known Lucide icon names accepted in skill/source icon fields.
 * Kept in sync with ICON_NAME_MAP in command-icon.tsx.
 */
const LUCIDE_ICON_NAMES = new Set([
  'zap', 'git-pull-request', 'hammer', 'refresh-cw', 'flask-conical',
  'shield', 'rocket', 'bug', 'bar-chart-3', 'circle-check', 'package-plus',
  'alert-triangle', 'server', 'search', 'message-square', 'eye', 'file-code',
  'settings', 'layers', 'database', 'code-2', 'code', 'bot', 'wrench',
  'book-open', 'globe', 'terminal', 'sparkles', 'folder-kanban',
  'git-compare', 'file-text', 'file', 'list-ordered', 'file-plus', 'plus',
  'clipboard-check', 'pie-chart', 'route', 'scan-search', 'scroll-text',
  'clock', 'activity', 'siren', 'megaphone', 'file-clock', 'gantt-chart',
  'calendar-range', 'list-tree', 'file-bar-chart', 'shield-alert',
  'layout-dashboard', 'map', 'notebook-pen', 'list-checks', 'mail',
  'calendar-check', 'message-square-heart', 'trending-up', 'lightbulb',
  'briefcase', 'telescope', 'swords', 'scale',
  'target', 'pen-tool', 'user-check', 'graduation-cap', 'heart-handshake',
  'presentation', 'receipt', 'building-2', 'phone', 'bar-chart-2',
  'bar-chart', 'share-2', 'layout', 'users', 'award', 'calendar',
  'book-marked', 'hash', 'check-circle',
]);

/**
 * Check if a string is a known Lucide icon name (kebab-case).
 */
export function isLucideIconName(str: string): boolean {
  return LUCIDE_ICON_NAMES.has(str);
}

/**
 * Check if an icon value is invalid (inline SVG or relative path).
 * These are explicitly not supported to keep configs clean.
 */
export function isInvalidIconValue(str: string): boolean {
  // Inline SVG starts with < (e.g., "<svg...")
  if (str.startsWith('<')) return true;
  // Relative paths start with . or /
  if (str.startsWith('.') || str.startsWith('/')) return true;
  return false;
}
