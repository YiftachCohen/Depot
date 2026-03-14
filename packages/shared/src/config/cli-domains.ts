export type CliDomainNamespace = 'label' | 'source' | 'skill' | 'automation' | 'permission' | 'theme'

export interface CliDomainPolicy {
  namespace: CliDomainNamespace
  helpCommand: string
  workspacePathScopes: string[]
  readActions: string[]
  quickExamples: string[]
  /** Optional workspace-relative paths guarded for direct Bash operations */
  bashGuardPaths?: string[]
}

const POLICIES: Record<CliDomainNamespace, CliDomainPolicy> = {
  label: {
    namespace: 'label',
    helpCommand: 'depot label --help',
    workspacePathScopes: ['labels/**'],
    readActions: ['list', 'get', 'auto-rule-list', 'auto-rule-validate'],
    quickExamples: [
      'depot label list',
      'depot label create --name "Bug" --color "accent"',
      'depot label update bug --json \'{"name":"Bug Report"}\'',
    ],
    bashGuardPaths: ['labels/**'],
  },
  source: {
    namespace: 'source',
    helpCommand: 'depot source --help',
    workspacePathScopes: ['sources/**'],
    readActions: ['list', 'get', 'validate', 'test', 'auth-help'],
    quickExamples: [
      'depot source list',
      'depot source get <slug>',
      'depot source update <slug> --json "{...}"',
      'depot source validate <slug>',
    ],
  },
  skill: {
    namespace: 'skill',
    helpCommand: 'depot skill --help',
    workspacePathScopes: ['skills/**'],
    readActions: ['list', 'get', 'validate', 'where'],
    quickExamples: [
      'depot skill list',
      'depot skill get <slug>',
      'depot skill update <slug> --json "{...}"',
      'depot skill validate <slug>',
    ],
  },
  automation: {
    namespace: 'automation',
    helpCommand: 'depot automation --help',
    workspacePathScopes: ['automations.json', 'automations-history.jsonl'],
    readActions: ['list', 'get', 'validate', 'history', 'last-executed', 'test', 'lint'],
    quickExamples: [
      'depot automation list',
      'depot automation create --event UserPromptSubmit --prompt "Summarize this prompt"',
      'depot automation update <id> --json "{\"enabled\":false}"',
      'depot automation history <id> --limit 20',
      'depot automation validate',
    ],
    bashGuardPaths: ['automations.json', 'automations-history.jsonl'],
  },
  permission: {
    namespace: 'permission',
    helpCommand: 'depot permission --help',
    workspacePathScopes: ['permissions.json', 'sources/*/permissions.json'],
    readActions: ['list', 'get', 'validate'],
    quickExamples: [
      'depot permission list',
      'depot permission get --source linear',
      'depot permission add-mcp-pattern "list" --comment "All list ops" --source linear',
      'depot permission validate',
    ],
    bashGuardPaths: ['permissions.json', 'sources/*/permissions.json'],
  },
  theme: {
    namespace: 'theme',
    helpCommand: 'depot theme --help',
    workspacePathScopes: ['config.json', 'theme.json', 'themes/*.json'],
    readActions: ['get', 'validate', 'list-presets', 'get-preset'],
    quickExamples: [
      'depot theme get',
      'depot theme list-presets',
      'depot theme set-color-theme nord',
      'depot theme set-workspace-color-theme default',
      'depot theme set-override --json "{\"accent\":\"#3b82f6\"}"',
    ],
    bashGuardPaths: ['config.json', 'theme.json', 'themes/*.json'],
  },
}

export const CLI_DOMAIN_POLICIES = POLICIES

export interface CliDomainScopeEntry {
  namespace: CliDomainNamespace
  scope: string
}

function dedupeScopes(scopes: string[]): string[] {
  return [...new Set(scopes)]
}

/**
 * Canonical workspace-relative path scopes owned by depot CLI domains.
 * Use these for file-path ownership checks to avoid drift across call sites.
 */
export const DEPOT_CLI_OWNED_WORKSPACE_PATH_SCOPES = dedupeScopes(
  Object.values(POLICIES).flatMap(policy => policy.workspacePathScopes)
)
/** @deprecated Use DEPOT_CLI_OWNED_WORKSPACE_PATH_SCOPES */
export const CRAFT_AGENTS_CLI_OWNED_WORKSPACE_PATH_SCOPES = DEPOT_CLI_OWNED_WORKSPACE_PATH_SCOPES

/**
 * Canonical workspace-relative path scopes guarded for direct Bash operations.
 */
export const DEPOT_CLI_OWNED_BASH_GUARD_PATH_SCOPES = dedupeScopes(
  Object.values(POLICIES).flatMap(policy => policy.bashGuardPaths ?? [])
)
/** @deprecated Use DEPOT_CLI_OWNED_BASH_GUARD_PATH_SCOPES */
export const CRAFT_AGENTS_CLI_OWNED_BASH_GUARD_PATH_SCOPES = DEPOT_CLI_OWNED_BASH_GUARD_PATH_SCOPES

/**
 * Namespace-aware workspace scope entries for depot CLI owned paths.
 */
export const DEPOT_CLI_WORKSPACE_SCOPE_ENTRIES: CliDomainScopeEntry[] = Object.values(POLICIES)
  .flatMap(policy => policy.workspacePathScopes.map(scope => ({ namespace: policy.namespace, scope })))
/** @deprecated Use DEPOT_CLI_WORKSPACE_SCOPE_ENTRIES */
export const CRAFT_AGENTS_CLI_WORKSPACE_SCOPE_ENTRIES = DEPOT_CLI_WORKSPACE_SCOPE_ENTRIES

/**
 * Namespace-aware Bash guard scope entries.
 */
export const DEPOT_CLI_BASH_GUARD_SCOPE_ENTRIES: CliDomainScopeEntry[] = Object.values(POLICIES)
  .flatMap(policy => (policy.bashGuardPaths ?? []).map(scope => ({ namespace: policy.namespace, scope })))
/** @deprecated Use DEPOT_CLI_BASH_GUARD_SCOPE_ENTRIES */
export const CRAFT_AGENTS_CLI_BASH_GUARD_SCOPE_ENTRIES = DEPOT_CLI_BASH_GUARD_SCOPE_ENTRIES

export interface BashPatternRule {
  pattern: string
  comment: string
}

/**
 * Derive the canonical Explore-mode read-only depot bash patterns from
 * CLI domain policies. Keeps permissions regexes aligned with command metadata.
 */
export function getDepotReadOnlyBashPatterns(): BashPatternRule[] {
  const namespaces = Object.keys(POLICIES) as CliDomainNamespace[]
  const namespaceAlternation = namespaces.join('|')

  const rules: BashPatternRule[] = namespaces.map((namespace) => {
    const policy = POLICIES[namespace]
    const actions = policy.readActions.join('|')
    return {
      pattern: `^depot\\s+${namespace}\\s+(${actions})\\b`,
      comment: `depot ${namespace} read-only operations`,
    }
  })

  rules.push(
    { pattern: '^depot\\s*$', comment: 'depot bare invocation (prints help)' },
    { pattern: `^depot\\s+(${namespaceAlternation})\\s*$`, comment: 'depot entity help' },
    { pattern: `^depot\\s+(${namespaceAlternation})\\s+--help\\b`, comment: 'depot entity help flags' },
    { pattern: '^depot\\s+--(help|version|discover)\\b', comment: 'depot global flags' },
  )

  return rules
}

/** @deprecated Use getDepotReadOnlyBashPatterns */
export const getCraftAgentReadOnlyBashPatterns = getDepotReadOnlyBashPatterns;

export function getCliDomainPolicy(namespace: CliDomainNamespace): CliDomainPolicy {
  return POLICIES[namespace]
}
