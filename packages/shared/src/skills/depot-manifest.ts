/**
 * Depot Skill Manifest Parser
 *
 * Parses and validates depot.yaml manifest files that provide richer
 * configuration for skills beyond the SKILL.md frontmatter.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { DepotSkillManifest, InlineSourceConfig, QuickCommand } from './types.ts';
import type { KnowledgeManifestConfig } from './knowledge/types.ts';
import type { AutomationMatcher } from '../automations/types.ts';
import { AutomationMatcherSchema, VALID_EVENTS, DEPRECATED_EVENT_ALIASES } from '../automations/schemas.ts';

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Extract all {{variable}} references from a prompt template string.
 */
export function extractTemplateVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(2, -2)))];
}

/**
 * Validate that all {{variable}} references in a quick command's prompt
 * have corresponding entries in the variables array.
 *
 * @returns Array of error messages (empty if valid)
 */
function validateQuickCommandVariables(cmd: QuickCommand, index: number): string[] {
  const errors: string[] = [];
  const referenced = extractTemplateVariables(cmd.prompt);

  if (referenced.length === 0) return errors;

  const declared = new Set(
    (cmd.variables ?? []).map(v => v.name),
  );

  for (const ref of referenced) {
    if (!declared.has(ref)) {
      errors.push(
        `quick_commands[${index}] ("${cmd.name}"): template references {{${ref}}} but no matching variable is declared`,
      );
    }
  }

  return errors;
}

/**
 * Validate a single quick command object has all required fields.
 */
function validateQuickCommand(raw: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `quick_commands[${index}]`;

  if (typeof raw !== 'object' || raw === null) {
    errors.push(`${prefix}: must be an object`);
    return errors;
  }

  const cmd = raw as Record<string, unknown>;

  if (typeof cmd.name !== 'string' || cmd.name.trim() === '') {
    errors.push(`${prefix}: "name" is required and must be a non-empty string`);
  }
  if (typeof cmd.prompt !== 'string' || cmd.prompt.trim() === '') {
    errors.push(`${prefix}: "prompt" is required and must be a non-empty string`);
  }

  if (cmd.variables !== undefined) {
    if (!Array.isArray(cmd.variables)) {
      errors.push(`${prefix}: "variables" must be an array`);
    } else {
      for (let vi = 0; vi < cmd.variables.length; vi++) {
        const v = cmd.variables[vi] as Record<string, unknown>;
        const vPrefix = `${prefix}.variables[${vi}]`;

        if (typeof v !== 'object' || v === null) {
          errors.push(`${vPrefix}: must be an object`);
          continue;
        }
        if (typeof v.name !== 'string' || (v.name as string).trim() === '') {
          errors.push(`${vPrefix}: "name" is required`);
        }
        if (!['text', 'select', 'number'].includes(v.type as string)) {
          errors.push(`${vPrefix}: "type" must be one of: text, select, number`);
        }
        if (typeof v.label !== 'string' || (v.label as string).trim() === '') {
          errors.push(`${vPrefix}: "label" is required`);
        }
        if (v.type === 'select' && (!Array.isArray(v.options) || v.options.length === 0)) {
          errors.push(`${vPrefix}: select-type variable must have a non-empty "options" array`);
        }
      }
    }
  }

  return errors;
}

/**
 * Validate a single inline source config entry.
 */
function validateInlineSourceConfig(raw: unknown, slug: string): string[] {
  const errors: string[] = [];
  const prefix = `source_configs["${slug}"]`;

  if (typeof raw !== 'object' || raw === null) {
    errors.push(`${prefix}: must be an object`);
    return errors;
  }

  const cfg = raw as Record<string, unknown>;
  const validTypes = ['mcp', 'api', 'local'];

  if (typeof cfg.type !== 'string' || !validTypes.includes(cfg.type)) {
    errors.push(`${prefix}: "type" must be one of: ${validTypes.join(', ')}`);
  }
  if (typeof cfg.provider !== 'string' || cfg.provider.trim() === '') {
    errors.push(`${prefix}: "provider" is required and must be a non-empty string`);
  }

  return errors;
}

// ============================================================
// Parser
// ============================================================

/**
 * Parse a depot.yaml manifest from raw YAML content.
 *
 * @param yamlContent - Raw YAML string
 * @returns Parsed and validated DepotSkillManifest
 * @throws Error if required fields are missing or validation fails
 */
export function parseDepotManifest(yamlContent: string): DepotSkillManifest {
  const raw = yaml.load(yamlContent);

  if (typeof raw !== 'object' || raw === null) {
    throw new Error('depot.yaml must contain a YAML object');
  }

  const data = raw as Record<string, unknown>;
  const errors: string[] = [];

  // Required fields
  if (typeof data.name !== 'string' || data.name.trim() === '') {
    errors.push('"name" is required and must be a non-empty string');
  }
  if (typeof data.description !== 'string' || data.description.trim() === '') {
    errors.push('"description" is required and must be a non-empty string');
  }
  if (typeof data.icon !== 'string' || data.icon.trim() === '') {
    errors.push('"icon" is required and must be a non-empty string');
  }
  if (!Array.isArray(data.quick_commands) || data.quick_commands.length === 0) {
    errors.push('"quick_commands" is required and must be a non-empty array');
  }

  // Bail early on missing top-level required fields
  if (errors.length > 0) {
    throw new Error(`Invalid depot.yaml:\n  - ${errors.join('\n  - ')}`);
  }

  // Validate each quick command
  const quickCommands = data.quick_commands as unknown[];
  for (let i = 0; i < quickCommands.length; i++) {
    errors.push(...validateQuickCommand(quickCommands[i], i));
  }

  if (errors.length > 0) {
    throw new Error(`Invalid depot.yaml:\n  - ${errors.join('\n  - ')}`);
  }

  // Validate template variable references
  const parsedCommands = quickCommands as QuickCommand[];
  for (let i = 0; i < parsedCommands.length; i++) {
    errors.push(...validateQuickCommandVariables(parsedCommands[i]!, i));
  }

  if (errors.length > 0) {
    throw new Error(`Invalid depot.yaml:\n  - ${errors.join('\n  - ')}`);
  }

  // Optional fields
  const sources = Array.isArray(data.sources)
    ? data.sources.filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    : undefined;

  const contextFiles = Array.isArray(data.context_files)
    ? data.context_files.filter((f): f is string => typeof f === 'string' && f.trim() !== '')
    : undefined;

  const projectPaths = Array.isArray(data.project_paths)
    ? data.project_paths
        .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
        .map((p) => p.trim())
    : undefined;

  const provider = typeof data.provider === 'string' && data.provider.trim() !== ''
    ? data.provider.trim()
    : undefined;

  // --- v2 optional fields ---

  // source_configs: Record<string, InlineSourceConfig>
  let sourceConfigs: Record<string, InlineSourceConfig> | undefined;
  if (data.source_configs !== undefined) {
    if (typeof data.source_configs !== 'object' || data.source_configs === null || Array.isArray(data.source_configs)) {
      errors.push('"source_configs" must be an object (slug → config)');
    } else {
      const rawConfigs = data.source_configs as Record<string, unknown>;
      for (const [slug, cfg] of Object.entries(rawConfigs)) {
        errors.push(...validateInlineSourceConfig(cfg, slug));
      }
      if (errors.length === 0) {
        sourceConfigs = rawConfigs as Record<string, InlineSourceConfig>;
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid depot.yaml:\n  - ${errors.join('\n  - ')}`);
  }

  // personality: string
  const personality = typeof data.personality === 'string' && data.personality.trim() !== ''
    ? data.personality.trim()
    : undefined;

  // permission_mode: 'safe' | 'ask' | 'allow-all'
  const validPermModes = ['safe', 'ask', 'allow-all'];
  let permissionMode: 'safe' | 'ask' | 'allow-all' | undefined;
  if (data.permission_mode !== undefined) {
    if (typeof data.permission_mode === 'string' && validPermModes.includes(data.permission_mode)) {
      permissionMode = data.permission_mode as 'safe' | 'ask' | 'allow-all';
    }
    // Silently ignore invalid values (non-breaking)
  }

  // memory: { enabled?: boolean }
  let memory: { enabled?: boolean } | undefined;
  if (data.memory !== undefined && typeof data.memory === 'object' && data.memory !== null) {
    const rawMemory = data.memory as Record<string, unknown>;
    memory = {
      enabled: typeof rawMemory.enabled === 'boolean' ? rawMemory.enabled : undefined,
    };
  }

  // knowledge: KnowledgeManifestConfig
  let knowledge: KnowledgeManifestConfig | undefined;
  if (data.knowledge !== undefined && typeof data.knowledge === 'object' && data.knowledge !== null && !Array.isArray(data.knowledge)) {
    const rawKnowledge = data.knowledge as Record<string, unknown>;
    if (typeof rawKnowledge.enabled === 'boolean') {
      const knowledgeConfig: KnowledgeManifestConfig = {
        enabled: rawKnowledge.enabled,
      };

      // observation_schedule
      if (typeof rawKnowledge.observation_schedule === 'string' && rawKnowledge.observation_schedule.trim() !== '') {
        knowledgeConfig.observationSchedule = rawKnowledge.observation_schedule.trim();
      }

      // consolidation_schedule
      if (typeof rawKnowledge.consolidation_schedule === 'string' && rawKnowledge.consolidation_schedule.trim() !== '') {
        knowledgeConfig.consolidationSchedule = rawKnowledge.consolidation_schedule.trim();
      }

      // observation_prompt
      if (typeof rawKnowledge.observation_prompt === 'string' && rawKnowledge.observation_prompt.trim() !== '') {
        knowledgeConfig.observationPrompt = rawKnowledge.observation_prompt.trim();
      }

      // observation_permission_mode
      const validObsPermModes = ['safe', 'ask', 'allow-all'];
      if (typeof rawKnowledge.observation_permission_mode === 'string' && validObsPermModes.includes(rawKnowledge.observation_permission_mode)) {
        knowledgeConfig.observationPermissionMode = rawKnowledge.observation_permission_mode as 'safe' | 'ask' | 'allow-all';
      }

      // token_budget
      if (typeof rawKnowledge.token_budget === 'object' && rawKnowledge.token_budget !== null && !Array.isArray(rawKnowledge.token_budget)) {
        const rawBudget = rawKnowledge.token_budget as Record<string, unknown>;
        if (typeof rawBudget.per_day === 'number' && rawBudget.per_day > 0) {
          knowledgeConfig.tokenBudget = { perDay: rawBudget.per_day };
        }
      }

      // max_observation_turns
      if (typeof rawKnowledge.max_observation_turns === 'number' && rawKnowledge.max_observation_turns > 0) {
        knowledgeConfig.maxObservationTurns = rawKnowledge.max_observation_turns;
      }

      // domains
      if (Array.isArray(rawKnowledge.domains)) {
        const validDomains = rawKnowledge.domains.filter(
          (d): d is string => typeof d === 'string' && d.trim() !== '',
        );
        if (validDomains.length > 0) {
          knowledgeConfig.domains = validDomains;
        }
      }

      knowledge = knowledgeConfig;
    }
    // Silently ignore if enabled is not a boolean (non-breaking)
  }

  // --- v3 optional fields ---

  // automations: Record<string, AutomationMatcher[]>
  let automations: Record<string, AutomationMatcher[]> | undefined;
  if (data.automations !== undefined && typeof data.automations === 'object' && data.automations !== null && !Array.isArray(data.automations)) {
    const validAutomations: Record<string, AutomationMatcher[]> = {};
    for (const [event, matchers] of Object.entries(data.automations as Record<string, unknown>)) {
      if (!VALID_EVENTS.includes(event)) {
        // Silently skip unknown events (non-breaking, like permission_mode)
        continue;
      }
      const canonicalEvent = DEPRECATED_EVENT_ALIASES[event] ?? event;
      const parsed = z.array(AutomationMatcherSchema).safeParse(matchers);
      if (parsed.success) {
        validAutomations[canonicalEvent] = [
          ...(validAutomations[canonicalEvent] ?? []),
          ...parsed.data as AutomationMatcher[],
        ];
      }
      // Silently skip invalid matchers (non-breaking)
    }
    if (Object.keys(validAutomations).length > 0) {
      automations = validAutomations;
    }
  }

  return {
    name: (data.name as string).trim(),
    icon: (data.icon as string).trim(),
    description: (data.description as string).trim(),
    provider,
    sources: sources && sources.length > 0 ? sources : undefined,
    quick_commands: parsedCommands,
    context_files: contextFiles && contextFiles.length > 0 ? contextFiles : undefined,
    project_paths: projectPaths && projectPaths.length > 0 ? projectPaths : undefined,
    source_configs: sourceConfigs,
    personality,
    permission_mode: permissionMode,
    memory,
    knowledge,
    automations,
  };
}

// ============================================================
// Loader
// ============================================================

/**
 * Load and parse a depot.yaml manifest from a skill directory.
 *
 * @param skillDir - Absolute path to the skill directory
 * @returns Parsed manifest or null if depot.yaml doesn't exist or is invalid
 */
export function loadDepotManifest(skillDir: string): DepotSkillManifest | null {
  const manifestPath = join(skillDir, 'depot.yaml');

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    return parseDepotManifest(content);
  } catch {
    // depot.yaml is optional — invalid manifests are silently skipped
    return null;
  }
}
