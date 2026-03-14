/**
 * Tests for Skill Session Helpers
 *
 * Verifies:
 * - Template variable resolution ({{var}} replacement)
 * - Session options building from quick commands
 * - Source slug propagation (manifest > metadata fallback)
 * - Missing/unreferenced variable handling
 */
import { describe, it, expect } from 'bun:test';
import {
  resolveTemplate,
  buildSessionOptionsFromQuickCommand,
} from '../session-helpers.ts';
import type { LoadedSkill, QuickCommand, DepotSkillManifest } from '../types.ts';

// ============================================================
// Helpers
// ============================================================

function makeSkill(overrides?: Partial<LoadedSkill>): LoadedSkill {
  return {
    slug: 'test-skill',
    metadata: {
      name: 'Test Skill',
      description: 'A test skill',
    },
    content: '# Test skill content',
    path: '/tmp/skills/test-skill',
    source: 'workspace',
    ...overrides,
  };
}

function makeCommand(overrides?: Partial<QuickCommand>): QuickCommand {
  return {
    name: 'Run Tests',
    prompt: 'Run all tests in the project',
    ...overrides,
  };
}

function makeManifest(overrides?: Partial<DepotSkillManifest>): DepotSkillManifest {
  return {
    name: 'Test Skill',
    icon: 'test-tube',
    description: 'A test skill',
    quick_commands: [makeCommand()],
    ...overrides,
  };
}

// ============================================================
// resolveTemplate
// ============================================================

describe('resolveTemplate', () => {
  it('replaces a single variable', () => {
    const result = resolveTemplate('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('replaces multiple distinct variables', () => {
    const result = resolveTemplate(
      'Deploy {{service}} to {{environment}}',
      { service: 'api', environment: 'production' },
    );
    expect(result).toBe('Deploy api to production');
  });

  it('replaces multiple occurrences of the same variable', () => {
    const result = resolveTemplate(
      '{{name}} is {{name}}',
      { name: 'Alice' },
    );
    expect(result).toBe('Alice is Alice');
  });

  it('leaves unreferenced placeholders intact', () => {
    const result = resolveTemplate(
      'Hello {{name}}, your id is {{id}}',
      { name: 'Bob' },
    );
    expect(result).toBe('Hello Bob, your id is {{id}}');
  });

  it('returns template unchanged when no variables provided', () => {
    const result = resolveTemplate('No variables here', {});
    expect(result).toBe('No variables here');
  });

  it('returns template unchanged when there are no placeholders', () => {
    const result = resolveTemplate('Plain text', { unused: 'value' });
    expect(result).toBe('Plain text');
  });

  it('handles empty string values', () => {
    const result = resolveTemplate('Value: {{val}}', { val: '' });
    expect(result).toBe('Value: ');
  });

  it('handles template with only a placeholder', () => {
    const result = resolveTemplate('{{msg}}', { msg: 'hello' });
    expect(result).toBe('hello');
  });
});

// ============================================================
// buildSessionOptionsFromQuickCommand
// ============================================================

describe('buildSessionOptionsFromQuickCommand', () => {
  it('builds basic session options from skill and command', () => {
    const skill = makeSkill();
    const command = makeCommand();

    const result = buildSessionOptionsFromQuickCommand(skill, command);

    expect(result.name).toBe('Run Tests');
    expect(result.skillSlug).toBe('test-skill');
    expect(result.initialMessage).toBe('Run all tests in the project');
  });

  it('resolves template variables in the prompt', () => {
    const skill = makeSkill();
    const command = makeCommand({
      prompt: 'Deploy {{service}} to {{env}}',
      variables: [
        { name: 'service', type: 'text', label: 'Service' },
        { name: 'env', type: 'select', label: 'Environment', options: ['staging', 'prod'] },
      ],
    });

    const result = buildSessionOptionsFromQuickCommand(skill, command, {
      service: 'backend',
      env: 'staging',
    });

    expect(result.initialMessage).toBe('Deploy backend to staging');
  });

  it('leaves unresolved variables when values are not provided', () => {
    const skill = makeSkill();
    const command = makeCommand({
      prompt: 'Deploy {{service}} to {{env}}',
    });

    const result = buildSessionOptionsFromQuickCommand(skill, command, {
      service: 'api',
    });

    expect(result.initialMessage).toBe('Deploy api to {{env}}');
  });

  it('uses raw prompt when no variableValues are passed', () => {
    const skill = makeSkill();
    const command = makeCommand({
      prompt: 'Run {{framework}} tests',
    });

    const result = buildSessionOptionsFromQuickCommand(skill, command);

    expect(result.initialMessage).toBe('Run {{framework}} tests');
  });

  // ----------------------------------------------------------
  // Source slug propagation
  // ----------------------------------------------------------

  it('propagates source slugs from manifest.sources', () => {
    const skill = makeSkill({
      manifest: makeManifest({ sources: ['github', 'jira'] }),
    });
    const command = makeCommand();

    const result = buildSessionOptionsFromQuickCommand(skill, command);

    expect(result.enabledSourceSlugs).toEqual(['github', 'jira']);
  });

  it('falls back to metadata.requiredSources when no manifest sources', () => {
    const skill = makeSkill({
      metadata: {
        name: 'Test Skill',
        description: 'A test skill',
        requiredSources: ['slack', 'linear'],
      },
    });
    const command = makeCommand();

    const result = buildSessionOptionsFromQuickCommand(skill, command);

    expect(result.enabledSourceSlugs).toEqual(['slack', 'linear']);
  });

  it('prefers manifest.sources over metadata.requiredSources', () => {
    const skill = makeSkill({
      metadata: {
        name: 'Test Skill',
        description: 'A test skill',
        requiredSources: ['from-metadata'],
      },
      manifest: makeManifest({ sources: ['from-manifest'] }),
    });
    const command = makeCommand();

    const result = buildSessionOptionsFromQuickCommand(skill, command);

    expect(result.enabledSourceSlugs).toEqual(['from-manifest']);
  });

  it('sets enabledSourceSlugs to undefined when no sources defined', () => {
    const skill = makeSkill();
    const command = makeCommand();

    const result = buildSessionOptionsFromQuickCommand(skill, command);

    expect(result.enabledSourceSlugs).toBeUndefined();
  });

  // ----------------------------------------------------------
  // Session naming
  // ----------------------------------------------------------

  it('uses command name for session naming (agent context shown separately)', () => {
    const skill = makeSkill({
      metadata: { name: 'Metadata Name', description: 'desc' },
      manifest: makeManifest({ name: 'Manifest Name' }),
    });
    const command = makeCommand({ name: 'Quick Action' });

    const result = buildSessionOptionsFromQuickCommand(skill, command);

    expect(result.name).toBe('Quick Action');
  });

  it('uses command name regardless of manifest/metadata', () => {
    const skill = makeSkill({
      metadata: { name: 'My Skill', description: 'desc' },
    });
    const command = makeCommand({ name: 'Do Something' });

    const result = buildSessionOptionsFromQuickCommand(skill, command);

    expect(result.name).toBe('Do Something');
  });
});
