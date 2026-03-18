/**
 * Skills Types
 *
 * Type definitions for workspace skills.
 * Skills are specialized instructions that extend Claude's capabilities.
 */

/**
 * Skill metadata from SKILL.md YAML frontmatter
 */
export interface SkillMetadata {
  /** Display name for the skill */
  name: string;
  /** Brief description shown in skill list */
  description: string;
  /** Optional file patterns that trigger this skill */
  globs?: string[];
  /** Optional tools to always allow when skill is active */
  alwaysAllow?: string[];
  /**
   * Optional icon - emoji or URL only.
   * - Emoji: rendered directly in UI (e.g., "🔧")
   * - URL: auto-downloaded to icon.{ext} file
   * Note: Relative paths and inline SVG are NOT supported.
   */
  icon?: string;
  /** Optional source slugs to auto-enable when this skill is invoked */
  requiredSources?: string[];
}

/** Source of a loaded skill */
export type SkillSource = 'global' | 'workspace' | 'project';

/**
 * Plugin name for project-level and global skills.
 *
 * The SDK derives plugin names from `path.basename()` of the registered plugin
 * directory. Both `{project}/.agents/` and `~/.agents/` share the basename
 * `.agents`, so skills from either tier resolve to `.agents:skillSlug`.
 */
export const AGENTS_PLUGIN_NAME = '.agents';

// ============================================================
// Depot Skill Manifest (depot.yaml)
// ============================================================

/** Variable definition for quick command templates */
export interface QuickCommandVariable {
  /** Variable name referenced in the prompt template as {{name}} */
  name: string;
  /** Input type for the variable */
  type: 'text' | 'select' | 'number';
  /** Human-readable label shown in UI */
  label: string;
  /** Placeholder text for the input field */
  placeholder?: string;
  /** Options for select-type variables */
  options?: string[];
  /** Default value */
  default?: string;
}

/** A quick command defined in a depot.yaml manifest */
export interface QuickCommand {
  /** Display name for the command */
  name: string;
  /** Prompt template string with {{variable}} placeholders */
  prompt: string;
  /** Variable definitions for template placeholders */
  variables?: QuickCommandVariable[];
  /** Optional Lucide icon name (e.g. "rocket", "shield", "git-pull-request") */
  icon?: string;
  /** Optional CSS color for the button (e.g. "#10b981") */
  color?: string;
}

/**
 * Depot skill manifest parsed from depot.yaml.
 * Provides richer configuration beyond SKILL.md frontmatter.
 */
export interface DepotSkillManifest {
  /** Display name for the skill */
  name: string;
  /** Lucide icon name */
  icon: string;
  /** LLM provider slug (e.g. 'anthropic', 'bedrock') */
  provider?: string;
  /** Brief description of the skill */
  description: string;
  /** MCP server/source slugs to auto-connect */
  sources?: string[];
  /** Quick commands available for this skill */
  quick_commands: QuickCommand[];
  /** Relative file paths to include as context */
  context_files?: string[];
  /** Absolute or ~-prefixed paths to project directories this agent operates in */
  project_paths?: string[];
}

/**
 * Returns true if a loaded skill qualifies as an "agent" — i.e. it has a
 * depot.yaml manifest with at least one quick command.
 */
export function isAgent(skill: LoadedSkill): boolean {
  return (skill.manifest?.quick_commands?.length ?? 0) > 0
}

// ============================================================
// Agent Templates
// ============================================================

/** A curated agent template that can be materialized into a real skill */
export interface AgentTemplate {
  /** Unique identifier / default slug (e.g. "code-review") */
  id: string;
  /** Category for browsing (e.g. "Development", "Documentation") */
  category: string;
  /** Pre-filled depot.yaml manifest */
  manifest: DepotSkillManifest;
  /** SKILL.md body content (markdown instructions, without frontmatter) */
  skillContent: string;
  /** Tags for search/filtering */
  tags?: string[];
}

/**
 * A loaded skill with parsed content
 */
export interface LoadedSkill {
  /** Directory name (slug) */
  slug: string;
  /** Parsed metadata from YAML frontmatter */
  metadata: SkillMetadata;
  /** Full SKILL.md content (without frontmatter) */
  content: string;
  /** Absolute path to icon file if exists */
  iconPath?: string;
  /** Absolute path to skill directory */
  path: string;
  /** Where this skill was loaded from */
  source: SkillSource;
  /** Parsed depot.yaml manifest (if present in skill directory) */
  manifest?: DepotSkillManifest;
  /** Timestamp of last use (epoch ms) */
  lastUsedAt?: number;
  /** Number of sessions this skill has been used in */
  sessionCount?: number;
}
