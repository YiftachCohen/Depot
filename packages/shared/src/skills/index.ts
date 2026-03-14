/**
 * Skills Module
 *
 * Workspace skills are specialized instructions that extend Claude's capabilities.
 */

export * from './types.ts';
export {
  GLOBAL_DEPOT_SKILLS_DIR,
  GLOBAL_AGENT_SKILLS_DIR,
  CLAUDE_CODE_SKILLS_DIR,
  PROJECT_AGENT_SKILLS_DIR,
  loadSkill,
  loadAllSkills,
  loadSkillBySlug,
  getSkillIconPath,
  deleteSkill,
  skillExists,
  listSkillSlugs,
  skillNeedsIconDownload,
  downloadSkillIcon,
  importSkillsFromClaudeCode,
  createSkill,
  writeDepotManifest,
} from './storage.ts';
export {
  parseDepotManifest,
  loadDepotManifest,
  extractTemplateVariables,
} from './depot-manifest.ts';
export {
  resolveTemplate,
  buildSessionOptionsFromQuickCommand,
  type SkillSessionOptions,
} from './session-helpers.ts';
