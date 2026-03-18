/**
 * Skills Storage
 *
 * CRUD operations for workspace skills.
 * Skills are stored in {workspace}/skills/{slug}/ directories.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
} from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import matter from 'gray-matter';
import type { LoadedSkill, SkillMetadata, SkillSource } from './types.ts';
import { getWorkspaceSkillsPath } from '../workspaces/storage.ts';
import {
  validateIconValue,
  findIconFile,
  downloadIcon,
  needsIconDownload,
  isIconUrl,
} from '../utils/icon.ts';
import yaml from 'js-yaml';
import { loadDepotManifest } from './depot-manifest.ts';

// ============================================================
// Skills Paths
// ============================================================

/** Primary global skills directory: ~/.depot/skills/ */
export const GLOBAL_DEPOT_SKILLS_DIR = join(homedir(), '.depot', 'skills');

/** Fallback global agent skills directory: ~/.agents/skills/ */
export const GLOBAL_AGENT_SKILLS_DIR = join(homedir(), '.agents', 'skills');

/** Claude Code skills directory for importing: ~/.claude/skills/ */
export const CLAUDE_CODE_SKILLS_DIR = join(homedir(), '.claude', 'skills');

/** Project-level agent skills relative directory name */
export const PROJECT_AGENT_SKILLS_DIR = '.agents/skills';

/**
 * Normalize requiredSources frontmatter to a clean string array.
 * Accepts a single string or array of strings, trims whitespace, and deduplicates.
 */
function normalizeRequiredSources(value: unknown): string[] | undefined {
  const asArray = typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value
      : undefined;

  if (!asArray) return undefined;

  const normalized = Array.from(new Set(
    asArray
      .filter((entry): entry is string => typeof entry === 'string')
      .map(entry => entry.trim())
      .filter(Boolean)
  ));

  return normalized.length > 0 ? normalized : undefined;
}

// ============================================================
// Parsing
// ============================================================

/**
 * Parse SKILL.md content and extract frontmatter + body
 */
function parseSkillFile(content: string): { metadata: SkillMetadata; body: string } | null {
  try {
    const parsed = matter(content);

    // Validate required fields
    if (!parsed.data.name || !parsed.data.description) {
      return null;
    }

    // Validate and extract optional icon field
    // Only accepts emoji or URL - rejects inline SVG and relative paths
    const icon = validateIconValue(parsed.data.icon, 'Skills');

    return {
      metadata: {
        name: parsed.data.name as string,
        description: parsed.data.description as string,
        globs: parsed.data.globs as string[] | undefined,
        alwaysAllow: parsed.data.alwaysAllow as string[] | undefined,
        icon,
        requiredSources: normalizeRequiredSources(parsed.data.requiredSources),
      },
      body: parsed.content,
    };
  } catch {
    return null;
  }
}

// ============================================================
// Load Operations
// ============================================================

/**
 * Load a single skill from a directory
 * @param skillsDir - Absolute path to skills directory
 * @param slug - Skill directory name
 * @param source - Where this skill is loaded from
 */
function loadSkillFromDir(skillsDir: string, slug: string, source: SkillSource): LoadedSkill | null {
  const skillDir = join(skillsDir, slug);
  const skillFile = join(skillDir, 'SKILL.md');

  // Check directory exists
  if (!existsSync(skillDir) || !statSync(skillDir).isDirectory()) {
    return null;
  }

  // Check SKILL.md exists
  if (!existsSync(skillFile)) {
    return null;
  }

  // Read and parse SKILL.md
  let content: string;
  try {
    content = readFileSync(skillFile, 'utf-8');
  } catch {
    return null;
  }

  const parsed = parseSkillFile(content);
  if (!parsed) {
    return null;
  }

  // Optionally load depot.yaml manifest from the same directory
  const manifest = loadDepotManifest(skillDir);

  return {
    slug,
    metadata: parsed.metadata,
    content: parsed.body,
    iconPath: findIconFile(skillDir),
    path: skillDir,
    source,
    ...(manifest ? { manifest } : {}),
  };
}

/**
 * Load all skills from a directory
 * @param skillsDir - Absolute path to skills directory
 * @param source - Where these skills are loaded from
 */
function loadSkillsFromDir(skillsDir: string, source: SkillSource): LoadedSkill[] {
  if (!existsSync(skillsDir)) {
    return [];
  }

  const skills: LoadedSkill[] = [];

  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skill = loadSkillFromDir(skillsDir, entry.name, source);
      if (skill) {
        skills.push(skill);
      }
    }
  } catch {
    // Ignore errors reading skills directory
  }

  return skills;
}

/**
 * Load a single skill from a workspace
 * @param workspaceRoot - Absolute path to workspace root
 * @param slug - Skill directory name
 */
export function loadSkill(workspaceRoot: string, slug: string): LoadedSkill | null {
  const skillsDir = getWorkspaceSkillsPath(workspaceRoot);
  return loadSkillFromDir(skillsDir, slug, 'workspace');
}

/**
 * Load all skills from a workspace
 * @param workspaceRoot - Absolute path to workspace root
 */
export function loadWorkspaceSkills(workspaceRoot: string): LoadedSkill[] {
  const skillsDir = getWorkspaceSkillsPath(workspaceRoot);
  return loadSkillsFromDir(skillsDir, 'workspace');
}

/**
 * Load all skills from all sources with multi-level priority.
 * Skills with the same slug are overridden by higher-priority sources.
 * Priority (lowest to highest): agents-global < depot-global < workspace < project
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param projectRoot - Optional project root (working directory) for project-level skills
 */
export function loadAllSkills(workspaceRoot: string, projectRoot?: string): LoadedSkill[] {
  const skillsBySlug = new Map<string, LoadedSkill>();

  // 1. Fallback global skills (lowest priority): ~/.agents/skills/
  for (const skill of loadSkillsFromDir(GLOBAL_AGENT_SKILLS_DIR, 'global')) {
    skillsBySlug.set(skill.slug, skill);
  }

  // 2. Primary global skills: ~/.depot/skills/ (overrides ~/.agents/skills/)
  for (const skill of loadSkillsFromDir(GLOBAL_DEPOT_SKILLS_DIR, 'global')) {
    skillsBySlug.set(skill.slug, skill);
  }

  // 3. Workspace skills (medium priority)
  for (const skill of loadWorkspaceSkills(workspaceRoot)) {
    skillsBySlug.set(skill.slug, skill);
  }

  // 4. Project skills (highest priority): {projectRoot}/.agents/skills/
  if (projectRoot) {
    const projectSkillsDir = join(projectRoot, PROJECT_AGENT_SKILLS_DIR);
    for (const skill of loadSkillsFromDir(projectSkillsDir, 'project')) {
      skillsBySlug.set(skill.slug, skill);
    }
  }

  return Array.from(skillsBySlug.values());
}

/**
 * Load a single skill by slug from all sources (project > workspace > depot-global > agents-global).
 * Unlike loadAllSkills(), this only reads the specific slug directory — O(1) not O(N).
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param slug - Skill slug to load
 * @param projectRoot - Optional project root for project-level skills
 */
export function loadSkillBySlug(workspaceRoot: string, slug: string, projectRoot?: string): LoadedSkill | null {
  // Highest priority: project-level
  if (projectRoot) {
    const projectSkillsDir = join(projectRoot, PROJECT_AGENT_SKILLS_DIR);
    const skill = loadSkillFromDir(projectSkillsDir, slug, 'project');
    if (skill) return skill;
  }

  // Medium priority: workspace
  const workspaceSkill = loadSkillFromDir(getWorkspaceSkillsPath(workspaceRoot), slug, 'workspace');
  if (workspaceSkill) return workspaceSkill;

  // Primary global: ~/.depot/skills/
  const depotSkill = loadSkillFromDir(GLOBAL_DEPOT_SKILLS_DIR, slug, 'global');
  if (depotSkill) return depotSkill;

  // Fallback global: ~/.agents/skills/
  return loadSkillFromDir(GLOBAL_AGENT_SKILLS_DIR, slug, 'global');
}

/**
 * Get icon path for a skill
 * @param workspaceRoot - Absolute path to workspace root
 * @param slug - Skill directory name
 */
export function getSkillIconPath(workspaceRoot: string, slug: string): string | null {
  const skillsDir = getWorkspaceSkillsPath(workspaceRoot);
  const skillDir = join(skillsDir, slug);

  if (!existsSync(skillDir)) {
    return null;
  }

  return findIconFile(skillDir) || null;
}

// ============================================================
// Delete Operations
// ============================================================

/**
 * Delete a skill from a workspace
 * @param workspaceRoot - Absolute path to workspace root
 * @param slug - Skill directory name
 */
export function deleteSkill(workspaceRoot: string, slug: string): boolean {
  const skillsDir = getWorkspaceSkillsPath(workspaceRoot);
  const skillDir = join(skillsDir, slug);

  if (!existsSync(skillDir)) {
    return false;
  }

  try {
    rmSync(skillDir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Check if a skill exists in a workspace
 * @param workspaceRoot - Absolute path to workspace root
 * @param slug - Skill directory name
 */
export function skillExists(workspaceRoot: string, slug: string): boolean {
  const skillsDir = getWorkspaceSkillsPath(workspaceRoot);
  const skillDir = join(skillsDir, slug);
  const skillFile = join(skillDir, 'SKILL.md');

  return existsSync(skillDir) && existsSync(skillFile);
}

/**
 * List skill slugs in a workspace
 * @param workspaceRoot - Absolute path to workspace root
 */
export function listSkillSlugs(workspaceRoot: string): string[] {
  const skillsDir = getWorkspaceSkillsPath(workspaceRoot);

  if (!existsSync(skillsDir)) {
    return [];
  }

  try {
    return readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => {
        if (!entry.isDirectory()) return false;
        const skillFile = join(skillsDir, entry.name, 'SKILL.md');
        return existsSync(skillFile);
      })
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

// ============================================================
// Icon Download (uses shared utilities)
// ============================================================

/**
 * Download an icon from a URL and save it to the skill directory.
 * Returns the path to the downloaded icon, or null on failure.
 */
export async function downloadSkillIcon(
  skillDir: string,
  iconUrl: string
): Promise<string | null> {
  return downloadIcon(skillDir, iconUrl, 'Skills');
}

/**
 * Check if a skill needs its icon downloaded.
 * Returns true if metadata has a URL icon and no local icon file exists.
 */
export function skillNeedsIconDownload(skill: LoadedSkill): boolean {
  return needsIconDownload(skill.metadata.icon, skill.iconPath);
}

// ============================================================
// Import from Claude Code
// ============================================================

/**
 * Import skills from Claude Code's ~/.claude/skills/ directory.
 * Scans for SKILL.md files and copies them to ~/.depot/skills/ preserving directory structure.
 *
 * @param targetDir - Target directory for imported skills (defaults to ~/.depot/skills/)
 * @returns List of imported skill slugs
 */
export async function importSkillsFromClaudeCode(targetDir?: string): Promise<string[]> {
  const sourceDir = CLAUDE_CODE_SKILLS_DIR;
  const destDir = targetDir ?? GLOBAL_DEPOT_SKILLS_DIR;
  const imported: string[] = [];

  if (!existsSync(sourceDir)) {
    return imported;
  }

  // Ensure destination directory exists
  mkdirSync(destDir, { recursive: true });

  try {
    const entries = readdirSync(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const slug = entry.name;
      const srcSkillDir = join(sourceDir, slug);
      const srcSkillFile = join(srcSkillDir, 'SKILL.md');

      // Only import directories that contain a SKILL.md
      if (!existsSync(srcSkillFile)) continue;

      const destSkillDir = join(destDir, slug);

      // Create destination skill directory
      mkdirSync(destSkillDir, { recursive: true });

      // Copy all files in the skill directory
      const skillFiles = readdirSync(srcSkillDir, { withFileTypes: true });
      for (const file of skillFiles) {
        if (!file.isFile()) continue;
        copyFileSync(
          join(srcSkillDir, file.name),
          join(destSkillDir, file.name),
        );
      }

      imported.push(slug);
    }
  } catch {
    // Silently handle errors reading Claude Code skills directory
  }

  return imported;
}

// ============================================================
// Create Skill
// ============================================================

/**
 * Default SKILL.md template for new skills.
 */
const SKILL_TEMPLATE = `---
name: "{{name}}"
description: "{{description}}"
---

# {{name}}

Add your skill instructions here.
`;

/**
 * Create a new skill with a SKILL.md template.
 *
 * @param targetDir - Skills directory to create the skill in (defaults to ~/.depot/skills/)
 * @param slug - Skill directory name (slug)
 * @param name - Display name for the skill
 * @param description - Brief description of the skill
 * @returns Absolute path to the created skill directory
 */
export function createSkill(
  slug: string,
  name: string,
  description: string,
  targetDir?: string,
): string {
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug) || slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
    throw new Error(`Invalid skill slug: "${slug}". Must be lowercase alphanumeric with hyphens only.`);
  }
  const skillsDir = targetDir ?? GLOBAL_DEPOT_SKILLS_DIR;
  const skillDir = join(skillsDir, slug);

  mkdirSync(skillDir, { recursive: true });

  const content = SKILL_TEMPLATE
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{description\}\}/g, description);

  writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8');

  return skillDir;
}

// ============================================================
// Write Depot Manifest
// ============================================================

/**
 * Write a depot.yaml manifest to a skill directory, promoting it to an agent.
 *
 * @param skillDir - Absolute path to the skill directory
 * @param manifest - The manifest object to serialize
 */
export function writeDepotManifest(skillDir: string, manifest: import('./types.ts').DepotSkillManifest): void {
  const content = yaml.dump(manifest, { lineWidth: 120, noRefs: true });
  writeFileSync(join(skillDir, 'depot.yaml'), content, 'utf-8');
}

// Re-export icon utilities for convenience
export { isIconUrl } from '../utils/icon.ts';
