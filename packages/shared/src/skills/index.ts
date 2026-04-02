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
  updateSkillFrontmatter,
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
export {
  resolveAgentSources,
  type SourceResolutionResult,
} from './source-resolution.ts';
export {
  loadAgentState,
  saveAgentState,
  initAgentState,
  touchAgentState,
  updateKnowledgeTokenUsage,
  type AgentState,
  type AgentMemory,
  type AgentMemoryFact,
  type ObservationRun,
} from './agent-state.ts';
export {
  AGENT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  DEFAULT_OBSERVATION_PROMPT,
  type TemplateCategory,
  getTemplateById,
  getTemplatesByCategory,
  createAgentFromTemplate,
} from './templates.ts';
// Knowledge Fabric is re-exported from its own subpath: @depot/shared/skills/knowledge
