/**
 * Source Templates
 *
 * Pre-configured templates for quick source setup.
 * Each template contains a complete CreateSourceInput with pre-filled config.
 */

import type { CreateSourceInput } from './types.ts'

/**
 * Source template category
 */
export type SourceTemplateCategory = 'productivity' | 'development' | 'communication' | 'storage' | 'search'

/**
 * Pre-auth field definition (rendered before auth input)
 */
export interface PreAuthField {
  key: string
  label: string
  placeholder?: string
  /** If true, validates as URL-safe domain (alphanumeric + hyphens only). Default: false (required only). */
  domainValidation?: boolean
  /** If true, masks the input like a password field. */
  secret?: boolean
}

/**
 * Source template for quick setup wizard
 */
export interface SourceTemplate {
  id: string
  name: string
  tagline: string
  icon: string
  authMethod: 'oauth' | 'api-key' | 'bearer' | 'none'
  credentialLabel?: string
  credentialHelpUrl?: string
  preAuthFields?: PreAuthField[]
  sourceInput: CreateSourceInput
  category?: SourceTemplateCategory
}

/**
 * Domain field validation pattern.
 * Only allows alphanumeric characters and hyphens (safe for URL construction).
 */
const SAFE_DOMAIN_PATTERN = /^[a-zA-Z0-9-]+$/

/**
 * Validate a pre-auth field value.
 * If the field has domainValidation, rejects characters unsafe for URL construction.
 * Otherwise, just checks for non-empty.
 */
export function validatePreAuthField(field: PreAuthField, value: string): string | null {
  if (!value.trim()) {
    return `${field.label} is required`
  }
  if (field.domainValidation && !SAFE_DOMAIN_PATTERN.test(value)) {
    return `${field.label} may only contain letters, numbers, and hyphens`
  }
  return null
}

/**
 * Deep-walk replacement of {{key}} placeholders in a CreateSourceInput.
 * Walks individual string values — does NOT use JSON.stringify + replace.
 */
export function resolveTemplateFields(
  sourceInput: CreateSourceInput,
  fieldValues: Record<string, string>
): CreateSourceInput {
  function replaceInString(str: string): string {
    return str.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      const value = fieldValues[key]
      if (value === undefined) {
        throw new Error(`Missing required field: ${key}`)
      }
      return value
    })
  }

  function walkValue(val: unknown): unknown {
    if (typeof val === 'string') {
      return replaceInString(val)
    }
    if (Array.isArray(val)) {
      return val.map(walkValue)
    }
    if (val !== null && typeof val === 'object') {
      const result: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(val)) {
        result[k] = walkValue(v)
      }
      return result
    }
    return val
  }

  return walkValue(sourceInput) as CreateSourceInput
}

/**
 * All available source templates.
 *
 * Only templates with verified, working auth flows are included.
 * Start with simple auth (none, api-key, bearer), then add OAuth as verified.
 */
export const SOURCE_TEMPLATES: SourceTemplate[] = [
  // ── No Auth ──────────────────────────────────────────────────────────
  {
    id: 'local-folder',
    name: 'Local Folder',
    tagline: 'Mount a local directory as a source',
    icon: '📁',
    authMethod: 'none',
    category: 'storage',
    sourceInput: {
      name: 'Local Folder',
      provider: 'local',
      type: 'local',
      icon: '📁',
      local: { path: '' }, // Filled by folder picker
    },
  },

  // ── API Key (env) ────────────────────────────────────────────────────
  {
    id: 'exa',
    name: 'Exa',
    tagline: 'AI-powered web search',
    icon: '🔍',
    authMethod: 'api-key',
    credentialLabel: 'Exa API Key',
    credentialHelpUrl: 'https://dashboard.exa.ai/api-keys',
    category: 'search',
    sourceInput: {
      name: 'Exa',
      provider: 'exa',
      type: 'mcp',
      icon: '🔍',
      mcp: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'exa-mcp-server'],
        tokenEnvVar: 'EXA_API_KEY',
      },
    },
  },

  // ── Bearer Token ─────────────────────────────────────────────────────
  {
    id: 'todoist',
    name: 'Todoist',
    tagline: 'Task management & to-do lists',
    icon: '✅',
    authMethod: 'bearer',
    credentialLabel: 'API Token',
    credentialHelpUrl: 'https://app.todoist.com/app/settings/integrations/developer',
    category: 'productivity',
    sourceInput: {
      name: 'Todoist',
      provider: 'todoist',
      type: 'api',
      icon: '✅',
      api: {
        baseUrl: 'https://api.todoist.com/api/v1',
        authType: 'bearer',
        testEndpoint: { method: 'GET', path: '/projects' },
      },
    },
  },
  {
    id: 'jira',
    name: 'Jira',
    tagline: 'Issue tracking & project management',
    icon: '🎯',
    authMethod: 'bearer',
    credentialLabel: 'API Token',
    credentialHelpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    preAuthFields: [
      { key: 'domain', label: 'Atlassian Domain', placeholder: 'your-company', domainValidation: true },
    ],
    category: 'development',
    sourceInput: {
      name: 'Jira',
      provider: 'jira',
      type: 'api',
      icon: '🎯',
      api: {
        baseUrl: 'https://{{domain}}.atlassian.net/rest/api/3',
        authType: 'basic',
        testEndpoint: { method: 'GET', path: '/myself' },
      },
    },
  },

  // ── OAuth (MCP) ──────────────────────────────────────────────────────
  {
    id: 'linear',
    name: 'Linear',
    tagline: 'Issue tracking & project management',
    icon: '📐',
    authMethod: 'oauth',
    category: 'development',
    sourceInput: {
      name: 'Linear',
      provider: 'linear',
      type: 'mcp',
      icon: '📐',
      mcp: {
        transport: 'http',
        url: 'https://mcp.linear.app/sse',
        authType: 'oauth',
      },
    },
  },
  {
    id: 'github',
    name: 'GitHub',
    tagline: 'Code hosting & collaboration',
    icon: '🐙',
    authMethod: 'oauth',
    category: 'development',
    sourceInput: {
      name: 'GitHub',
      provider: 'github',
      type: 'mcp',
      icon: '🐙',
      mcp: {
        transport: 'http',
        url: 'https://api.githubcopilot.com/mcp/',
        authType: 'oauth',
      },
    },
  },
  {
    id: 'notion',
    name: 'Notion',
    tagline: 'Notes, docs & knowledge base',
    icon: '📝',
    authMethod: 'oauth',
    category: 'productivity',
    sourceInput: {
      name: 'Notion',
      provider: 'notion',
      type: 'mcp',
      icon: '📝',
      mcp: {
        transport: 'http',
        url: 'https://mcp.notion.so/sse',
        authType: 'oauth',
      },
    },
  },

  // ── OAuth (API) ──────────────────────────────────────────────────────
  {
    id: 'slack',
    name: 'Slack',
    tagline: 'Team messaging & communication',
    icon: '💬',
    authMethod: 'oauth',
    category: 'communication',
    sourceInput: {
      name: 'Slack',
      provider: 'slack',
      type: 'api',
      icon: '💬',
      api: {
        baseUrl: 'https://slack.com/api',
        authType: 'oauth',
        slackService: 'full',
      },
    },
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    tagline: 'Calendar & scheduling',
    icon: '📅',
    authMethod: 'oauth',
    credentialHelpUrl: 'https://console.cloud.google.com/apis/credentials',
    preAuthFields: [
      { key: 'googleOAuthClientId', label: 'Google OAuth Client ID', placeholder: 'xxxx.apps.googleusercontent.com' },
      { key: 'googleOAuthClientSecret', label: 'Google OAuth Client Secret', placeholder: 'GOCSPX-...', secret: true },
    ],
    category: 'productivity',
    sourceInput: {
      name: 'Google Calendar',
      provider: 'google',
      type: 'api',
      icon: '📅',
      api: {
        baseUrl: 'https://www.googleapis.com/calendar/v3',
        authType: 'oauth',
        googleService: 'calendar',
        googleOAuthClientId: '{{googleOAuthClientId}}',
        googleOAuthClientSecret: '{{googleOAuthClientSecret}}',
      },
    },
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    tagline: 'Cloud file storage & sharing',
    icon: '📂',
    authMethod: 'oauth',
    credentialHelpUrl: 'https://console.cloud.google.com/apis/credentials',
    preAuthFields: [
      { key: 'googleOAuthClientId', label: 'Google OAuth Client ID', placeholder: 'xxxx.apps.googleusercontent.com' },
      { key: 'googleOAuthClientSecret', label: 'Google OAuth Client Secret', placeholder: 'GOCSPX-...', secret: true },
    ],
    category: 'storage',
    sourceInput: {
      name: 'Google Drive',
      provider: 'google',
      type: 'api',
      icon: '📂',
      api: {
        baseUrl: 'https://www.googleapis.com/drive/v3',
        authType: 'oauth',
        googleService: 'drive',
        googleOAuthClientId: '{{googleOAuthClientId}}',
        googleOAuthClientSecret: '{{googleOAuthClientSecret}}',
      },
    },
  },
  {
    id: 'gmail',
    name: 'Gmail',
    tagline: 'Email access & management',
    icon: '✉️',
    authMethod: 'oauth',
    credentialHelpUrl: 'https://console.cloud.google.com/apis/credentials',
    preAuthFields: [
      { key: 'googleOAuthClientId', label: 'Google OAuth Client ID', placeholder: 'xxxx.apps.googleusercontent.com' },
      { key: 'googleOAuthClientSecret', label: 'Google OAuth Client Secret', placeholder: 'GOCSPX-...', secret: true },
    ],
    category: 'communication',
    sourceInput: {
      name: 'Gmail',
      provider: 'google',
      type: 'api',
      icon: '✉️',
      api: {
        baseUrl: 'https://gmail.googleapis.com/gmail/v1',
        authType: 'oauth',
        googleService: 'gmail',
        googleOAuthClientId: '{{googleOAuthClientId}}',
        googleOAuthClientSecret: '{{googleOAuthClientSecret}}',
      },
    },
  },
  {
    id: 'microsoft-outlook',
    name: 'Microsoft Outlook',
    tagline: 'Email, calendar & contacts',
    icon: '📧',
    authMethod: 'oauth',
    category: 'productivity',
    sourceInput: {
      name: 'Microsoft Outlook',
      provider: 'microsoft',
      type: 'api',
      icon: '📧',
      api: {
        baseUrl: 'https://graph.microsoft.com/v1.0/me/messages',
        authType: 'oauth',
        microsoftService: 'outlook',
      },
    },
  },
]

/**
 * Get a source template by ID
 */
export function getSourceTemplate(id: string): SourceTemplate | undefined {
  return SOURCE_TEMPLATES.find(t => t.id === id)
}
