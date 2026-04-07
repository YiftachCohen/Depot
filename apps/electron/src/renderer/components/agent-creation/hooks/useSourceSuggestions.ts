/**
 * useSourceSuggestions — rule-based source recommendation engine.
 *
 * Prioritizes already-connected workspace sources, then falls back to
 * static role→source mapping. No LLM required.
 */

import { useMemo } from 'react'
import type { LoadedSource } from '../../../../shared/types'

/** Static mapping of role categories to commonly-used source slugs. */
const ROLE_SOURCE_MAP: Record<string, string[]> = {
  development: ['github', 'linear', 'slack'],
  documentation: ['notion', 'confluence', 'google-docs'],
  'customer-support': ['zendesk', 'intercom', 'slack'],
  research: ['exa', 'google', 'notion'],
  devops: ['github', 'aws-cloudwatch', 'pagerduty'],
  'project-management': ['linear', 'jira', 'notion'],
  communication: ['slack', 'gmail', 'microsoft-teams'],
  design: ['figma', 'notion', 'slack'],
  sales: ['hubspot', 'slack', 'gmail'],
  security: ['github', 'aws-cloudwatch', 'slack'],
}

/** Keywords found in agent names/descriptions → role category. */
const KEYWORD_ROLE_MAP: Record<string, string> = {
  code: 'development',
  dev: 'development',
  pr: 'development',
  review: 'development',
  ci: 'development',
  deploy: 'devops',
  infra: 'devops',
  monitor: 'devops',
  ops: 'devops',
  doc: 'documentation',
  write: 'documentation',
  wiki: 'documentation',
  support: 'customer-support',
  ticket: 'customer-support',
  customer: 'customer-support',
  research: 'research',
  search: 'research',
  analyze: 'research',
  project: 'project-management',
  task: 'project-management',
  sprint: 'project-management',
  design: 'design',
  figma: 'design',
  ui: 'design',
  sales: 'sales',
  crm: 'sales',
  security: 'security',
  audit: 'security',
}

export interface SourceSuggestion {
  /** Source slug */
  slug: string
  /** Why this was suggested */
  reason: 'workspace' | 'role-match'
  /** If from workspace, the loaded source data */
  source?: LoadedSource
}

export function useSourceSuggestions(
  templateCategory: string | undefined,
  agentName: string,
  agentDescription: string,
  workspaceSources: LoadedSource[],
): SourceSuggestion[] {
  return useMemo(() => {
    const suggestions: SourceSuggestion[] = []
    const seen = new Set<string>()

    // 1. Prioritize existing workspace sources (zero-cost intelligence)
    for (const source of workspaceSources) {
      if (!seen.has(source.config.name)) {
        seen.add(source.config.name)
        suggestions.push({
          slug: source.config.name,
          reason: 'workspace',
          source,
        })
      }
    }

    // 2. Infer role from template category or keywords in name/description
    const roles = new Set<string>()
    if (templateCategory) {
      const catLower = templateCategory.toLowerCase()
      for (const [category] of Object.entries(ROLE_SOURCE_MAP)) {
        if (catLower.includes(category) || category.includes(catLower)) {
          roles.add(category)
        }
      }
    }

    const text = `${agentName} ${agentDescription}`.toLowerCase()
    for (const [keyword, role] of Object.entries(KEYWORD_ROLE_MAP)) {
      if (text.includes(keyword)) {
        roles.add(role)
      }
    }

    // 3. Add role-based suggestions not already in workspace
    for (const role of roles) {
      const roleSlugs = ROLE_SOURCE_MAP[role]
      if (!roleSlugs) continue
      for (const slug of roleSlugs) {
        if (!seen.has(slug)) {
          seen.add(slug)
          suggestions.push({ slug, reason: 'role-match' })
        }
      }
    }

    return suggestions
  }, [templateCategory, agentName, agentDescription, workspaceSources])
}
