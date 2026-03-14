/**
 * Skill Session Helpers
 *
 * Utilities for building session options from skill quick commands.
 * Used when a user clicks a Quick Command button on a skill card
 * to create a new session with the skill's context pre-loaded.
 */

import type { CreateSessionOptions } from '../protocol/dto.ts';
import type { LoadedSkill, QuickCommand } from './types.ts';

/**
 * Result of building session options from a quick command.
 * Extends CreateSessionOptions with the resolved initialMessage.
 */
export interface SkillSessionOptions extends CreateSessionOptions {
  /** Resolved prompt to send as the first message after session creation */
  initialMessage: string;
}

/**
 * Replace {{variable_name}} placeholders in a template string with provided values.
 *
 * - Replaces all occurrences of {{key}} where key exists in variables
 * - Leaves unreferenced {{placeholders}} intact (caller decides how to handle)
 *
 * @param template - Prompt template with {{variable}} placeholders
 * @param variables - Key-value map of variable names to their resolved values
 * @returns Template string with resolved variables
 */
export function resolveTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    if (name in variables) {
      return variables[name]!;
    }
    return match;
  });
}

/**
 * Build CreateSessionOptions (plus initialMessage) from a skill and quick command.
 *
 * Resolves the following from the skill/manifest:
 * - Session name: command name (agent context shown separately in UI)
 * - enabledSourceSlugs: from manifest.sources or metadata.requiredSources
 * - skillSlug: from the skill's slug
 * - initialMessage: from the resolved command prompt template
 *
 * @param skill - The loaded skill that owns the quick command
 * @param command - The quick command being invoked
 * @param variableValues - Optional map of template variable values
 * @returns Session creation options with the resolved initial message
 */
export function buildSessionOptionsFromQuickCommand(
  skill: LoadedSkill,
  command: QuickCommand,
  variableValues?: Record<string, string>,
): SkillSessionOptions {
  // Resolve template variables in the command prompt
  const resolvedPrompt = variableValues
    ? resolveTemplate(command.prompt, variableValues)
    : command.prompt;

  // Determine source slugs: manifest sources take priority, fall back to metadata requiredSources
  const sourceSlugs = skill.manifest?.sources ?? skill.metadata.requiredSources;

  return {
    name: command.name,
    skillSlug: skill.slug,
    enabledSourceSlugs: sourceSlugs,
    initialMessage: resolvedPrompt,
  };
}
