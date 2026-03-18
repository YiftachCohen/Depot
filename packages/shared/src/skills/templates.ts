/**
 * Agent Templates — curated, baked-in agent templates that users can browse,
 * customize, and add to their workspace in one click.
 */

import { join } from 'path'
import { writeFileSync } from 'fs'
import type { AgentTemplate, DepotSkillManifest } from './types.ts'
import { createSkill, writeDepotManifest } from './storage.ts'

// ---------------------------------------------------------------------------
// Template Categories
// ---------------------------------------------------------------------------

export const TEMPLATE_CATEGORIES = [
  'Development',
  'Documentation',
  'DevOps',
  'Data & Analysis',
  'Project Management',
] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

// ---------------------------------------------------------------------------
// Template Definitions
// ---------------------------------------------------------------------------

export const AGENT_TEMPLATES: AgentTemplate[] = [
  // ── Development ──────────────────────────────────────────────
  {
    id: 'code-review',
    category: 'Development',
    tags: ['review', 'quality', 'pr'],
    manifest: {
      name: 'Code Reviewer',
      icon: 'git-pull-request',
      description: 'Thorough code reviews with focus on correctness, style, security, and performance',
      quick_commands: [
        { name: 'Review PR', prompt: 'Review the latest PR changes. Focus on correctness, edge cases, security issues, and code style. Provide actionable feedback.', icon: 'git-pull-request' },
        { name: 'Review File', prompt: 'Review {{file_path}} for quality, bugs, and improvements.', icon: 'file-code', variables: [{ name: 'file_path', type: 'text', label: 'File path', placeholder: 'src/components/App.tsx' }] },
        { name: 'Security Audit', prompt: 'Perform a security audit on the codebase. Check for OWASP top 10 vulnerabilities, injection risks, auth issues, and sensitive data exposure.', icon: 'shield' },
      ],
    },
    skillContent: `You are a meticulous code reviewer. When reviewing code:

1. **Correctness** — Look for bugs, off-by-one errors, null/undefined risks, race conditions
2. **Security** — Check for injection, XSS, auth bypasses, sensitive data leaks
3. **Performance** — Flag N+1 queries, unnecessary re-renders, missing memoization
4. **Style** — Ensure consistency with project conventions
5. **Maintainability** — Suggest clearer naming, smaller functions, better abstractions

Always explain *why* something is an issue, not just *what* to change. Prioritize findings by severity.`,
  },

  {
    id: 'test-writer',
    category: 'Development',
    tags: ['testing', 'unit', 'integration', 'tdd'],
    manifest: {
      name: 'Test Writer',
      icon: 'flask-conical',
      description: 'Write comprehensive tests following project conventions and patterns',
      quick_commands: [
        { name: 'Write Unit Tests', prompt: 'Write unit tests for {{file_path}}. Cover happy paths, edge cases, and error scenarios. Follow existing test patterns in the project.', icon: 'flask-conical', variables: [{ name: 'file_path', type: 'text', label: 'File to test', placeholder: 'src/utils/parser.ts' }] },
        { name: 'Write Integration Tests', prompt: 'Write integration tests for {{feature}}. Test the full flow including dependencies.', icon: 'workflow', variables: [{ name: 'feature', type: 'text', label: 'Feature to test', placeholder: 'user authentication flow' }] },
      ],
    },
    skillContent: `You are a testing specialist. When writing tests:

1. Follow existing test patterns and frameworks already in the project
2. Cover happy paths, edge cases, boundary conditions, and error scenarios
3. Use descriptive test names that explain the expected behavior
4. Keep tests independent — no shared mutable state between tests
5. Prefer testing behavior over implementation details
6. Mock external dependencies but prefer real implementations for internal code`,
  },

  {
    id: 'refactoring',
    category: 'Development',
    tags: ['refactor', 'cleanup', 'patterns'],
    manifest: {
      name: 'Refactoring Assistant',
      icon: 'refresh-cw',
      description: 'Safe, incremental refactoring with test preservation',
      quick_commands: [
        { name: 'Refactor Module', prompt: 'Refactor {{module}} to improve readability and maintainability. Make incremental changes and ensure tests still pass.', icon: 'refresh-cw', variables: [{ name: 'module', type: 'text', label: 'Module/file', placeholder: 'src/services/auth.ts' }] },
        { name: 'Extract Pattern', prompt: 'Find repeated patterns in the codebase and extract them into reusable utilities or abstractions.', icon: 'copy' },
      ],
    },
    skillContent: `You are a refactoring specialist. Your approach:

1. **Understand first** — Read the code and its tests before changing anything
2. **Small steps** — Make one refactoring at a time, verify tests pass between steps
3. **Preserve behavior** — Never change behavior during refactoring
4. **Name clearly** — Extracted functions/variables should have self-documenting names
5. **Don't over-abstract** — Only extract when there's genuine duplication (3+ instances)`,
  },

  // ── Documentation ────────────────────────────────────────────
  {
    id: 'docs-writer',
    category: 'Documentation',
    tags: ['docs', 'readme', 'api'],
    manifest: {
      name: 'Docs Writer',
      icon: 'book-open',
      description: 'Write clear, accurate documentation following project style',
      quick_commands: [
        { name: 'Document Module', prompt: 'Write documentation for {{module}}. Include purpose, usage examples, and API reference.', icon: 'book-open', variables: [{ name: 'module', type: 'text', label: 'Module/file', placeholder: 'src/lib/cache.ts' }] },
        { name: 'Generate API Docs', prompt: 'Generate API documentation for all public exports. Include type signatures, parameters, return values, and examples.', icon: 'file-text' },
        { name: 'Write README', prompt: 'Write or update the README with setup instructions, usage guide, and architecture overview.', icon: 'file' },
      ],
    },
    skillContent: `You are a documentation writer. Your documentation should be:

1. **Accurate** — Always read the actual code before documenting it
2. **Concise** — Say what's needed, no more. Developers skim docs
3. **Example-driven** — Show usage before explaining theory
4. **Up-to-date** — Document current behavior, not aspirational behavior
5. **Structured** — Use headings, code blocks, and lists for scannability`,
  },

  {
    id: 'architecture-docs',
    category: 'Documentation',
    tags: ['architecture', 'adr', 'design'],
    manifest: {
      name: 'Architecture Documenter',
      icon: 'layers',
      description: 'Document system architecture, decisions, and dependencies',
      quick_commands: [
        { name: 'Document Architecture', prompt: 'Analyze the codebase and document its architecture: module structure, data flow, key abstractions, and integration points.', icon: 'layers' },
        { name: 'Create ADR', prompt: 'Create an Architecture Decision Record for: {{decision}}', icon: 'file-plus', variables: [{ name: 'decision', type: 'text', label: 'Decision topic', placeholder: 'Switch from REST to GraphQL' }] },
      ],
    },
    skillContent: `You are an architecture documentation specialist. When documenting:

1. Start with the big picture — what does the system do and why
2. Show module boundaries and their responsibilities
3. Document data flow and key integration points
4. Use ADR format (Context, Decision, Consequences) for decisions
5. Keep diagrams simple — prefer text descriptions over complex visuals`,
  },

  // ── DevOps ───────────────────────────────────────────────────
  {
    id: 'ci-cd',
    category: 'DevOps',
    tags: ['pipeline', 'github-actions', 'deployment'],
    manifest: {
      name: 'CI/CD Helper',
      icon: 'rocket',
      description: 'Build, fix, and optimize CI/CD pipelines',
      quick_commands: [
        { name: 'Fix Pipeline', prompt: 'The CI pipeline is failing. Diagnose the issue and fix it. Check the workflow files and recent changes.', icon: 'wrench' },
        { name: 'Add Workflow', prompt: 'Create a GitHub Actions workflow for {{purpose}}.', icon: 'plus', variables: [{ name: 'purpose', type: 'text', label: 'Workflow purpose', placeholder: 'run tests on PR, deploy to staging' }] },
      ],
    },
    skillContent: `You are a CI/CD specialist. When working with pipelines:

1. Understand the existing pipeline structure before making changes
2. Keep workflows DRY — use reusable workflows and composite actions
3. Optimize for speed — cache dependencies, parallelize jobs
4. Fail fast — run quick checks (lint, typecheck) before slow ones (tests, build)
5. Keep secrets secure — never echo or log sensitive values`,
  },

  {
    id: 'infra-review',
    category: 'DevOps',
    tags: ['infrastructure', 'docker', 'terraform', 'security'],
    manifest: {
      name: 'Infrastructure Reviewer',
      icon: 'server',
      description: 'Review infrastructure configs for security, cost, and best practices',
      quick_commands: [
        { name: 'Review Config', prompt: 'Review the infrastructure configuration files (Docker, Terraform, K8s, etc.) for correctness, security, and best practices.', icon: 'search' },
        { name: 'Security Scan', prompt: 'Scan infrastructure configs for security issues: exposed ports, missing encryption, overly permissive IAM, hardcoded secrets.', icon: 'shield' },
      ],
    },
    skillContent: `You are an infrastructure review specialist. When reviewing:

1. Check for security misconfigurations (open ports, missing encryption, broad IAM)
2. Verify resource sizing and cost efficiency
3. Ensure high availability and fault tolerance patterns
4. Validate secrets management (no hardcoded values)
5. Check for infrastructure drift and consistency`,
  },

  // ── Data & Analysis ──────────────────────────────────────────
  {
    id: 'data-analyst',
    category: 'Data & Analysis',
    tags: ['data', 'sql', 'analysis'],
    manifest: {
      name: 'Data Analyst',
      icon: 'bar-chart-3',
      description: 'Analyze data, write queries, and assess data quality',
      quick_commands: [
        { name: 'Analyze Dataset', prompt: 'Analyze the data in {{source}} and provide insights: distributions, anomalies, trends, and recommendations.', icon: 'bar-chart-3', variables: [{ name: 'source', type: 'text', label: 'Data source', placeholder: 'users table, CSV file path' }] },
        { name: 'Write SQL Query', prompt: 'Write a SQL query to: {{description}}', icon: 'database', variables: [{ name: 'description', type: 'text', label: 'What to query', placeholder: 'find users who signed up last week but never logged in' }] },
      ],
    },
    skillContent: `You are a data analyst. When working with data:

1. Understand the schema and data model before writing queries
2. Always include appropriate WHERE clauses and LIMIT for safety
3. Explain your analysis approach before diving into results
4. Flag data quality issues (nulls, duplicates, inconsistencies)
5. Present findings with clear summaries and actionable recommendations`,
  },

  {
    id: 'log-investigator',
    category: 'Data & Analysis',
    tags: ['logs', 'debugging', 'errors', 'observability'],
    manifest: {
      name: 'Log Investigator',
      icon: 'search',
      description: 'Investigate errors, trace requests, and analyze log patterns',
      quick_commands: [
        { name: 'Investigate Error', prompt: 'Investigate this error and find the root cause: {{error}}', icon: 'alert-triangle', variables: [{ name: 'error', type: 'text', label: 'Error message or trace', placeholder: 'TypeError: Cannot read property...' }] },
        { name: 'Trace Request', prompt: 'Trace the request flow through the codebase to identify where {{issue}} occurs.', icon: 'route', variables: [{ name: 'issue', type: 'text', label: 'Issue to trace', placeholder: 'the 500 error on /api/users' }] },
      ],
    },
    skillContent: `You are a log investigation specialist. When investigating:

1. Start with the error message and stack trace
2. Work backwards from the symptom to the root cause
3. Check for recent code changes that might have introduced the issue
4. Look for patterns — does it happen for all users or specific ones?
5. Provide a fix with explanation of why the error occurred`,
  },

  // ── Project Management ───────────────────────────────────────
  {
    id: 'issue-triager',
    category: 'Project Management',
    tags: ['issues', 'specs', 'planning', 'tasks'],
    manifest: {
      name: 'Issue Triager',
      icon: 'clipboard-list',
      description: 'Triage issues, write specs, and break down tasks',
      quick_commands: [
        { name: 'Triage Issue', prompt: 'Triage this issue: {{issue}}. Assess severity, identify affected areas, and suggest next steps.', icon: 'clipboard-list', variables: [{ name: 'issue', type: 'text', label: 'Issue description', placeholder: 'Users report slow load times on dashboard' }] },
        { name: 'Write Spec', prompt: 'Write a technical spec for: {{feature}}. Include requirements, approach, edge cases, and test plan.', icon: 'file-text', variables: [{ name: 'feature', type: 'text', label: 'Feature to spec', placeholder: 'user notification preferences' }] },
        { name: 'Break Down Task', prompt: 'Break down this task into smaller, implementable subtasks: {{task}}', icon: 'list-tree', variables: [{ name: 'task', type: 'text', label: 'Task to decompose', placeholder: 'Implement user authentication' }] },
      ],
    },
    skillContent: `You are a project management assistant. When triaging and planning:

1. Assess impact and urgency to prioritize effectively
2. Identify which parts of the codebase are affected
3. Break large tasks into small, independently deliverable pieces
4. Include acceptance criteria for each subtask
5. Flag dependencies and potential blockers early`,
  },
]

// ---------------------------------------------------------------------------
// Template Helpers
// ---------------------------------------------------------------------------

/** Find a template by its ID */
export function getTemplateById(id: string): AgentTemplate | undefined {
  return AGENT_TEMPLATES.find(t => t.id === id)
}

/** Get templates filtered by category */
export function getTemplatesByCategory(category: string): AgentTemplate[] {
  return AGENT_TEMPLATES.filter(t => t.category === category)
}

// ---------------------------------------------------------------------------
// Create Agent from Template
// ---------------------------------------------------------------------------

/**
 * Materialize an agent template into a real skill directory with SKILL.md + depot.yaml.
 *
 * @param template - The template to create from
 * @param overrides - Optional manifest field overrides and custom slug
 * @param targetDir - Skills directory (defaults to ~/.depot/skills/)
 * @returns Absolute path to the created skill directory
 */
export function createAgentFromTemplate(
  template: AgentTemplate,
  overrides?: Partial<DepotSkillManifest> & { slug?: string },
  targetDir?: string,
): string {
  const slug = overrides?.slug ?? template.id
  const { slug: _slug, ...manifestOverrides } = overrides ?? {}
  const manifest: DepotSkillManifest = { ...template.manifest, ...manifestOverrides }

  // Create skill directory + basic SKILL.md via existing function
  const skillDir = createSkill(slug, manifest.name, manifest.description, targetDir)

  // Overwrite SKILL.md with the richer template content (including frontmatter)
  const skillMd = [
    '---',
    `name: "${manifest.name}"`,
    `description: "${manifest.description}"`,
    '---',
    '',
    template.skillContent,
    '',
  ].join('\n')
  writeFileSync(join(skillDir, 'SKILL.md'), skillMd, 'utf-8')

  // Write depot.yaml manifest
  writeDepotManifest(skillDir, manifest)

  return skillDir
}
