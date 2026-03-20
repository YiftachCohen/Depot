/**
 * Tests for Depot Skill Manifest Parser
 *
 * Verifies parsing/validation of depot.yaml manifest files and
 * integration with the skill loading pipeline.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  parseDepotManifest,
  loadDepotManifest,
  extractTemplateVariables,
} from '../depot-manifest.ts';
import { loadSkill } from '../storage.ts';

// ============================================================
// Fixtures
// ============================================================

const VALID_MANIFEST = `
name: Code Review
icon: git-pull-request
description: Automated code review assistant
provider: anthropic
sources:
  - github
  - linear
quick_commands:
  - name: Review PR
    prompt: "Review the pull request {{pr_number}} in {{repo}}"
    variables:
      - name: pr_number
        type: number
        label: PR Number
        placeholder: "123"
      - name: repo
        type: text
        label: Repository
        placeholder: "owner/repo"
  - name: Quick Check
    prompt: "Do a quick lint check on the current file"
context_files:
  - .eslintrc.json
  - tsconfig.json
`;

const MINIMAL_MANIFEST = `
name: Simple Skill
icon: zap
description: A minimal skill
quick_commands:
  - name: Run
    prompt: "Execute the default action"
`;

// ============================================================
// Temp Directory Setup
// ============================================================

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'depot-manifest-test-'));
});

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// ============================================================
// Tests: extractTemplateVariables
// ============================================================

describe('extractTemplateVariables', () => {
  it('should extract variable names from template strings', () => {
    const vars = extractTemplateVariables('Review {{pr_number}} in {{repo}}');
    expect(vars).toEqual(['pr_number', 'repo']);
  });

  it('should return empty array for templates without variables', () => {
    const vars = extractTemplateVariables('Just a plain prompt');
    expect(vars).toEqual([]);
  });

  it('should deduplicate repeated variable references', () => {
    const vars = extractTemplateVariables('{{name}} and {{name}} again');
    expect(vars).toEqual(['name']);
  });

  it('should handle adjacent variables', () => {
    const vars = extractTemplateVariables('{{a}}{{b}}');
    expect(vars).toEqual(['a', 'b']);
  });
});

// ============================================================
// Tests: parseDepotManifest — valid inputs
// ============================================================

describe('parseDepotManifest — valid', () => {
  it('should parse a full depot.yaml manifest', () => {
    const manifest = parseDepotManifest(VALID_MANIFEST);

    expect(manifest.name).toBe('Code Review');
    expect(manifest.icon).toBe('git-pull-request');
    expect(manifest.description).toBe('Automated code review assistant');
    expect(manifest.provider).toBe('anthropic');
    expect(manifest.sources).toEqual(['github', 'linear']);
    expect(manifest.quick_commands).toHaveLength(2);
    expect(manifest.context_files).toEqual(['.eslintrc.json', 'tsconfig.json']);
  });

  it('should parse a minimal manifest with only required fields', () => {
    const manifest = parseDepotManifest(MINIMAL_MANIFEST);

    expect(manifest.name).toBe('Simple Skill');
    expect(manifest.icon).toBe('zap');
    expect(manifest.description).toBe('A minimal skill');
    expect(manifest.quick_commands).toHaveLength(1);
    expect(manifest.provider).toBeUndefined();
    expect(manifest.sources).toBeUndefined();
    expect(manifest.context_files).toBeUndefined();
    expect(manifest.project_paths).toBeUndefined();
  });

  it('should parse project_paths without expanding portable home paths', () => {
    const yaml = `
name: Scout Agent
icon: search
description: Manages the Scout project
project_paths:
  - "~/projects/scout"
  - "/absolute/path/to/shared"
quick_commands:
  - name: Run
    prompt: "Do something"
`;
    const manifest = parseDepotManifest(yaml);

    expect(manifest.project_paths).toHaveLength(2);
    expect(manifest.project_paths![0]).toBe('~/projects/scout');
    expect(manifest.project_paths![1]).toBe('/absolute/path/to/shared');
  });

  it('should ignore empty project_paths entries', () => {
    const yaml = `
name: Agent
icon: zap
description: Test
project_paths:
  - ""
  - "  "
  - "/valid/path"
quick_commands:
  - name: Run
    prompt: "Go"
`;
    const manifest = parseDepotManifest(yaml);

    expect(manifest.project_paths).toEqual(['/valid/path']);
  });

  it('should parse quick command variables correctly', () => {
    const manifest = parseDepotManifest(VALID_MANIFEST);
    const reviewCmd = manifest.quick_commands[0]!;

    expect(reviewCmd.name).toBe('Review PR');
    expect(reviewCmd.variables).toHaveLength(2);

    const prVar = reviewCmd.variables![0]!;
    expect(prVar.name).toBe('pr_number');
    expect(prVar.type).toBe('number');
    expect(prVar.label).toBe('PR Number');
    expect(prVar.placeholder).toBe('123');
  });

  it('should parse a quick command with select-type variable', () => {
    const yaml = `
name: Deploy
icon: rocket
description: Deploy to environments
quick_commands:
  - name: Deploy
    prompt: "Deploy to {{environment}}"
    variables:
      - name: environment
        type: select
        label: Environment
        options:
          - staging
          - production
        default: staging
`;
    const manifest = parseDepotManifest(yaml);
    const variable = manifest.quick_commands[0]!.variables![0]!;

    expect(variable.type).toBe('select');
    expect(variable.options).toEqual(['staging', 'production']);
    expect(variable.default).toBe('staging');
  });
});

// ============================================================
// Tests: parseDepotManifest — validation errors
// ============================================================

describe('parseDepotManifest — validation', () => {
  it('should reject manifest missing name', () => {
    const yaml = `
icon: zap
description: Missing name
quick_commands:
  - name: Run
    prompt: "Go"
`;
    expect(() => parseDepotManifest(yaml)).toThrow('"name" is required');
  });

  it('should reject manifest missing description', () => {
    const yaml = `
name: No Desc
icon: zap
quick_commands:
  - name: Run
    prompt: "Go"
`;
    expect(() => parseDepotManifest(yaml)).toThrow('"description" is required');
  });

  it('should reject manifest missing icon', () => {
    const yaml = `
name: No Icon
description: Missing icon field
quick_commands:
  - name: Run
    prompt: "Go"
`;
    expect(() => parseDepotManifest(yaml)).toThrow('"icon" is required');
  });

  it('should reject manifest missing quick_commands', () => {
    const yaml = `
name: No Commands
icon: zap
description: Missing quick_commands
`;
    expect(() => parseDepotManifest(yaml)).toThrow('"quick_commands" is required');
  });

  it('should reject manifest with empty quick_commands array', () => {
    const yaml = `
name: Empty Commands
icon: zap
description: Empty commands array
quick_commands: []
`;
    expect(() => parseDepotManifest(yaml)).toThrow('"quick_commands" is required');
  });

  it('should reject quick command missing name', () => {
    const yaml = `
name: Bad Command
icon: zap
description: Quick command without name
quick_commands:
  - prompt: "Do something"
`;
    expect(() => parseDepotManifest(yaml)).toThrow('"name" is required');
  });

  it('should reject quick command missing prompt', () => {
    const yaml = `
name: Bad Command
icon: zap
description: Quick command without prompt
quick_commands:
  - name: No Prompt
`;
    expect(() => parseDepotManifest(yaml)).toThrow('"prompt" is required');
  });

  it('should reject template variable reference without declaration', () => {
    const yaml = `
name: Bad Vars
icon: zap
description: Undeclared template variable
quick_commands:
  - name: Run
    prompt: "Deploy to {{environment}}"
`;
    expect(() => parseDepotManifest(yaml)).toThrow(
      'references {{environment}} but no matching variable is declared',
    );
  });

  it('should reject select variable without options', () => {
    const yaml = `
name: Bad Select
icon: zap
description: Select without options
quick_commands:
  - name: Run
    prompt: "Deploy to {{env}}"
    variables:
      - name: env
        type: select
        label: Environment
`;
    expect(() => parseDepotManifest(yaml)).toThrow('non-empty "options" array');
  });

  it('should reject variable with invalid type', () => {
    const yaml = `
name: Bad Type
icon: zap
description: Variable with wrong type
quick_commands:
  - name: Run
    prompt: "Do {{thing}}"
    variables:
      - name: thing
        type: boolean
        label: Thing
`;
    expect(() => parseDepotManifest(yaml)).toThrow('"type" must be one of');
  });

  it('should reject non-object YAML content', () => {
    expect(() => parseDepotManifest('just a string')).toThrow('must contain a YAML object');
  });

  it('should reject empty YAML', () => {
    expect(() => parseDepotManifest('')).toThrow('must contain a YAML object');
  });

  it('should allow quick commands without variables when template has no placeholders', () => {
    const yaml = `
name: Simple
icon: zap
description: No variables needed
quick_commands:
  - name: Run
    prompt: "Just do it"
`;
    const manifest = parseDepotManifest(yaml);
    expect(manifest.quick_commands[0]!.variables).toBeUndefined();
  });
});

// ============================================================
// Tests: loadDepotManifest
// ============================================================

describe('loadDepotManifest', () => {
  it('should load and parse a valid depot.yaml from a directory', () => {
    const skillDir = join(tempDir, 'my-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'depot.yaml'), VALID_MANIFEST);

    const manifest = loadDepotManifest(skillDir);

    expect(manifest).not.toBeNull();
    expect(manifest!.name).toBe('Code Review');
    expect(manifest!.quick_commands).toHaveLength(2);
  });

  it('should return null when depot.yaml does not exist', () => {
    const skillDir = join(tempDir, 'no-manifest');
    mkdirSync(skillDir, { recursive: true });

    const manifest = loadDepotManifest(skillDir);

    expect(manifest).toBeNull();
  });

  it('should return null for invalid depot.yaml (graceful failure)', () => {
    const skillDir = join(tempDir, 'bad-manifest');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'depot.yaml'), 'name: Incomplete\n');

    const manifest = loadDepotManifest(skillDir);

    expect(manifest).toBeNull();
  });

  it('should return null for malformed YAML', () => {
    const skillDir = join(tempDir, 'malformed');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'depot.yaml'), '{{{{invalid yaml');

    const manifest = loadDepotManifest(skillDir);

    expect(manifest).toBeNull();
  });
});

// ============================================================
// Tests: Integration with loadSkill (storage.ts)
// ============================================================

describe('loadSkill with depot.yaml integration', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = join(tempDir, 'workspace');
    mkdirSync(join(workspaceRoot, 'skills'), { recursive: true });
  });

  it('should attach manifest to LoadedSkill when depot.yaml is present', () => {
    const skillDir = join(workspaceRoot, 'skills', 'code-review');
    mkdirSync(skillDir, { recursive: true });

    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: "Code Review"
description: "Review code changes"
---

Review the code carefully.
`);

    writeFileSync(join(skillDir, 'depot.yaml'), VALID_MANIFEST);

    const skill = loadSkill(workspaceRoot, 'code-review');

    expect(skill).not.toBeNull();
    expect(skill!.metadata.name).toBe('Code Review');
    expect(skill!.manifest).toBeDefined();
    expect(skill!.manifest!.icon).toBe('git-pull-request');
    expect(skill!.manifest!.quick_commands).toHaveLength(2);
    expect(skill!.manifest!.sources).toEqual(['github', 'linear']);
  });

  it('should load skill without manifest when depot.yaml is absent', () => {
    const skillDir = join(workspaceRoot, 'skills', 'plain-skill');
    mkdirSync(skillDir, { recursive: true });

    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: "Plain Skill"
description: "A skill without depot.yaml"
---

Just instructions.
`);

    const skill = loadSkill(workspaceRoot, 'plain-skill');

    expect(skill).not.toBeNull();
    expect(skill!.metadata.name).toBe('Plain Skill');
    expect(skill!.manifest).toBeUndefined();
  });

  it('should load skill even when depot.yaml is invalid', () => {
    const skillDir = join(workspaceRoot, 'skills', 'bad-yaml');
    mkdirSync(skillDir, { recursive: true });

    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: "Still Works"
description: "SKILL.md is valid even if depot.yaml is not"
---

Instructions here.
`);

    writeFileSync(join(skillDir, 'depot.yaml'), 'name: Incomplete\n');

    const skill = loadSkill(workspaceRoot, 'bad-yaml');

    expect(skill).not.toBeNull();
    expect(skill!.metadata.name).toBe('Still Works');
    expect(skill!.manifest).toBeUndefined();
  });
});

// ============================================================
// Tests: parseDepotManifest — v2 fields
// ============================================================

const V2_MANIFEST = `
name: Smart Agent
icon: brain
description: Full v2 agent
personality: "Meticulous security auditor"
permission_mode: ask
memory:
  enabled: true
sources:
  - jira
source_configs:
  jira:
    type: mcp
    provider: jira
    mcp:
      transport: http
      url: "https://jira.example.com/mcp"
      authType: oauth2
quick_commands:
  - name: Audit
    prompt: "Audit the codebase"
`;

describe('parseDepotManifest — v2 fields', () => {
  it('should parse personality string and trim it', () => {
    const yaml = `
name: Agent
icon: zap
description: Test
personality: "  Friendly assistant  "
quick_commands:
  - name: Run
    prompt: "Go"
`;
    const manifest = parseDepotManifest(yaml);
    expect(manifest.personality).toBe('Friendly assistant');
  });

  it('should leave personality undefined when not present', () => {
    const manifest = parseDepotManifest(MINIMAL_MANIFEST);
    expect(manifest.personality).toBeUndefined();
  });

  it('should leave personality undefined for empty string', () => {
    const yaml = `
name: Agent
icon: zap
description: Test
personality: ""
quick_commands:
  - name: Run
    prompt: "Go"
`;
    const manifest = parseDepotManifest(yaml);
    expect(manifest.personality).toBeUndefined();
  });

  it('should parse permission_mode "safe"', () => {
    const yaml = `
name: Agent
icon: zap
description: Test
permission_mode: safe
quick_commands:
  - name: Run
    prompt: "Go"
`;
    const manifest = parseDepotManifest(yaml);
    expect(manifest.permission_mode).toBe('safe');
  });

  it('should parse permission_mode "ask"', () => {
    const yaml = `
name: Agent
icon: zap
description: Test
permission_mode: ask
quick_commands:
  - name: Run
    prompt: "Go"
`;
    const manifest = parseDepotManifest(yaml);
    expect(manifest.permission_mode).toBe('ask');
  });

  it('should parse permission_mode "allow-all"', () => {
    const yaml = `
name: Agent
icon: zap
description: Test
permission_mode: allow-all
quick_commands:
  - name: Run
    prompt: "Go"
`;
    const manifest = parseDepotManifest(yaml);
    expect(manifest.permission_mode).toBe('allow-all');
  });

  it('should silently ignore invalid permission_mode', () => {
    const yaml = `
name: Agent
icon: zap
description: Test
permission_mode: yolo
quick_commands:
  - name: Run
    prompt: "Go"
`;
    const manifest = parseDepotManifest(yaml);
    expect(manifest.permission_mode).toBeUndefined();
  });

  it('should leave permission_mode undefined when not present', () => {
    const manifest = parseDepotManifest(MINIMAL_MANIFEST);
    expect(manifest.permission_mode).toBeUndefined();
  });

  it('should parse memory with enabled: true', () => {
    const yaml = `
name: Agent
icon: zap
description: Test
memory:
  enabled: true
quick_commands:
  - name: Run
    prompt: "Go"
`;
    const manifest = parseDepotManifest(yaml);
    expect(manifest.memory).toBeDefined();
    expect(manifest.memory!.enabled).toBe(true);
  });

  it('should parse memory with enabled: false', () => {
    const yaml = `
name: Agent
icon: zap
description: Test
memory:
  enabled: false
quick_commands:
  - name: Run
    prompt: "Go"
`;
    const manifest = parseDepotManifest(yaml);
    expect(manifest.memory).toBeDefined();
    expect(manifest.memory!.enabled).toBe(false);
  });

  it('should parse memory object with missing enabled as undefined', () => {
    const yaml = `
name: Agent
icon: zap
description: Test
memory: {}
quick_commands:
  - name: Run
    prompt: "Go"
`;
    const manifest = parseDepotManifest(yaml);
    expect(manifest.memory).toBeDefined();
    expect(manifest.memory!.enabled).toBeUndefined();
  });

  it('should leave memory undefined when not present', () => {
    const manifest = parseDepotManifest(MINIMAL_MANIFEST);
    expect(manifest.memory).toBeUndefined();
  });

  it('should parse source_configs with MCP config', () => {
    const manifest = parseDepotManifest(V2_MANIFEST);
    expect(manifest.source_configs).toBeDefined();
    expect(manifest.source_configs!['jira']).toBeDefined();

    const jira = manifest.source_configs!['jira']!;
    expect(jira.type).toBe('mcp');
    expect(jira.provider).toBe('jira');
    expect(jira.mcp).toBeDefined();
    expect(jira.mcp!.transport).toBe('http');
    expect(jira.mcp!.url).toBe('https://jira.example.com/mcp');
    expect(jira.mcp!.authType).toBe('oauth2');
  });

  it('should parse source_configs with API config', () => {
    const yaml = `
name: Agent
icon: zap
description: Test
source_configs:
  stripe:
    type: api
    provider: stripe
    api:
      baseUrl: "https://api.stripe.com"
      authType: api_key
quick_commands:
  - name: Run
    prompt: "Go"
`;
    const manifest = parseDepotManifest(yaml);
    const stripe = manifest.source_configs!['stripe']!;
    expect(stripe.type).toBe('api');
    expect(stripe.provider).toBe('stripe');
    expect(stripe.api!.baseUrl).toBe('https://api.stripe.com');
  });

  it('should parse source_configs with local config', () => {
    const yaml = `
name: Agent
icon: zap
description: Test
source_configs:
  docs:
    type: local
    provider: filesystem
    local:
      path: "/home/user/docs"
quick_commands:
  - name: Run
    prompt: "Go"
`;
    const manifest = parseDepotManifest(yaml);
    const docs = manifest.source_configs!['docs']!;
    expect(docs.type).toBe('local');
    expect(docs.local!.path).toBe('/home/user/docs');
  });

  it('should leave source_configs undefined when not present', () => {
    const manifest = parseDepotManifest(MINIMAL_MANIFEST);
    expect(manifest.source_configs).toBeUndefined();
  });

  it('should parse a full v2 manifest with all fields', () => {
    const manifest = parseDepotManifest(V2_MANIFEST);

    expect(manifest.name).toBe('Smart Agent');
    expect(manifest.icon).toBe('brain');
    expect(manifest.description).toBe('Full v2 agent');
    expect(manifest.personality).toBe('Meticulous security auditor');
    expect(manifest.permission_mode).toBe('ask');
    expect(manifest.memory).toEqual({ enabled: true });
    expect(manifest.sources).toEqual(['jira']);
    expect(manifest.source_configs).toBeDefined();
    expect(manifest.quick_commands).toHaveLength(1);
  });

  it('should keep all v2 fields undefined for a minimal v1 manifest', () => {
    const manifest = parseDepotManifest(MINIMAL_MANIFEST);

    expect(manifest.personality).toBeUndefined();
    expect(manifest.permission_mode).toBeUndefined();
    expect(manifest.memory).toBeUndefined();
    expect(manifest.source_configs).toBeUndefined();
  });
});
