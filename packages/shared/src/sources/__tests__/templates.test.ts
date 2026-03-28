import { describe, it, expect } from 'bun:test'
import {
  SOURCE_TEMPLATES,
  getSourceTemplate,
  resolveTemplateFields,
  validatePreAuthField,
} from '../templates.ts'
import type { CreateSourceInput } from '../types.ts'

describe('SOURCE_TEMPLATES', () => {
  it('each template produces a valid CreateSourceInput', () => {
    for (const template of SOURCE_TEMPLATES) {
      const input = template.sourceInput
      expect(input.name).toBeTruthy()
      expect(input.provider).toBeTruthy()
      expect(['mcp', 'api', 'local']).toContain(input.type)

      // Type-specific config should be present
      if (input.type === 'mcp') {
        expect(input.mcp).toBeDefined()
      } else if (input.type === 'api') {
        expect(input.api).toBeDefined()
      } else if (input.type === 'local') {
        expect(input.local).toBeDefined()
      }
    }
  })

  it('all template IDs are unique', () => {
    const ids = SOURCE_TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('getSourceTemplate', () => {
  it('returns correct template for known IDs', () => {
    const linear = getSourceTemplate('linear')
    expect(linear).toBeDefined()
    expect(linear!.name).toBe('Linear')
    expect(linear!.sourceInput.provider).toBe('linear')

    const exa = getSourceTemplate('exa')
    expect(exa).toBeDefined()
    expect(exa!.name).toBe('Exa')
  })

  it('returns undefined for nonexistent ID', () => {
    expect(getSourceTemplate('nonexistent')).toBeUndefined()
  })
})

describe('resolveTemplateFields', () => {
  const baseInput: CreateSourceInput = {
    name: 'Test',
    provider: 'test',
    type: 'api',
    api: {
      baseUrl: 'https://{{domain}}.example.com/api',
      authType: 'bearer',
    },
  }

  it('replaces {{key}} with value in nested strings', () => {
    const result = resolveTemplateFields(baseInput, { domain: 'acme' })
    expect(result.api!.baseUrl).toBe('https://acme.example.com/api')
  })

  it('throws on missing field', () => {
    expect(() => resolveTemplateFields(baseInput, {})).toThrow('Missing required field: domain')
  })

  it('returns unchanged sourceInput when no placeholders', () => {
    const noPlaceholders: CreateSourceInput = {
      name: 'Test',
      provider: 'test',
      type: 'api',
      api: { baseUrl: 'https://api.example.com', authType: 'bearer' },
    }
    const result = resolveTemplateFields(noPlaceholders, {})
    expect(result.api!.baseUrl).toBe('https://api.example.com')
  })

  it('handles deep nested replacement in mcp config', () => {
    const mcpInput: CreateSourceInput = {
      name: 'Test',
      provider: 'test',
      type: 'mcp',
      mcp: {
        transport: 'http',
        url: 'https://{{subdomain}}.service.com/mcp',
      },
    }
    const result = resolveTemplateFields(mcpInput, { subdomain: 'my-org' })
    expect(result.mcp!.url).toBe('https://my-org.service.com/mcp')
  })

  it('handles arrays in config', () => {
    const inputWithArgs: CreateSourceInput = {
      name: 'Test',
      provider: 'test',
      type: 'mcp',
      mcp: {
        transport: 'stdio',
        command: 'npx',
        args: ['--domain', '{{domain}}'],
      },
    }
    const result = resolveTemplateFields(inputWithArgs, { domain: 'acme' })
    expect(result.mcp!.args).toEqual(['--domain', 'acme'])
  })
})

describe('validatePreAuthField', () => {
  const domainField = { key: 'domain', label: 'Domain', domainValidation: true }
  const freeField = { key: 'clientId', label: 'Client ID' }

  it('accepts valid domain names', () => {
    expect(validatePreAuthField(domainField, 'my-company')).toBeNull()
    expect(validatePreAuthField(domainField, 'acme123')).toBeNull()
    expect(validatePreAuthField(domainField, 'ABC')).toBeNull()
  })

  it('rejects empty values', () => {
    expect(validatePreAuthField(domainField, '')).toBeTruthy()
    expect(validatePreAuthField(domainField, '  ')).toBeTruthy()
  })

  it('rejects URL-unsafe characters for domain fields', () => {
    expect(validatePreAuthField(domainField, 'evil.com')).toBeTruthy()
    expect(validatePreAuthField(domainField, 'evil.com#')).toBeTruthy()
    expect(validatePreAuthField(domainField, 'evil/path')).toBeTruthy()
    expect(validatePreAuthField(domainField, 'evil?query')).toBeTruthy()
    expect(validatePreAuthField(domainField, 'evil@host')).toBeTruthy()
    expect(validatePreAuthField(domainField, 'has spaces')).toBeTruthy()
  })

  it('accepts free-form values for non-domain fields', () => {
    expect(validatePreAuthField(freeField, '123.apps.googleusercontent.com')).toBeNull()
    expect(validatePreAuthField(freeField, 'GOCSPX-abc123_def')).toBeNull()
  })

  it('still rejects empty for non-domain fields', () => {
    expect(validatePreAuthField(freeField, '')).toBeTruthy()
    expect(validatePreAuthField(freeField, '  ')).toBeTruthy()
  })
})

describe('resolveTemplateFields — real templates', () => {
  it('resolves Jira domain placeholder in actual template', () => {
    const jira = getSourceTemplate('jira')!
    const resolved = resolveTemplateFields(jira.sourceInput, { domain: 'my-company' })
    expect(resolved.api!.baseUrl).toBe('https://my-company.atlassian.net/rest/api/3')
  })

  it('resolves Google Calendar OAuth placeholders', () => {
    const gcal = getSourceTemplate('google-calendar')!
    const resolved = resolveTemplateFields(gcal.sourceInput, {
      googleOAuthClientId: '123.apps.googleusercontent.com',
      googleOAuthClientSecret: 'GOCSPX-abc',
    })
    expect(resolved.api!.googleOAuthClientId).toBe('123.apps.googleusercontent.com')
    expect(resolved.api!.googleOAuthClientSecret).toBe('GOCSPX-abc')
  })

  it('resolves Google Drive OAuth placeholders', () => {
    const gdrive = getSourceTemplate('google-drive')!
    const resolved = resolveTemplateFields(gdrive.sourceInput, {
      googleOAuthClientId: 'drive-id.apps.googleusercontent.com',
      googleOAuthClientSecret: 'GOCSPX-drive',
    })
    expect(resolved.api!.googleOAuthClientId).toBe('drive-id.apps.googleusercontent.com')
    expect(resolved.api!.googleOAuthClientSecret).toBe('GOCSPX-drive')
  })

  it('resolves Gmail OAuth placeholders', () => {
    const gmail = getSourceTemplate('gmail')!
    const resolved = resolveTemplateFields(gmail.sourceInput, {
      googleOAuthClientId: 'gmail-id.apps.googleusercontent.com',
      googleOAuthClientSecret: 'GOCSPX-gmail',
    })
    expect(resolved.api!.googleOAuthClientId).toBe('gmail-id.apps.googleusercontent.com')
    expect(resolved.api!.googleOAuthClientSecret).toBe('GOCSPX-gmail')
  })

  it('templates without placeholders resolve unchanged', () => {
    const linear = getSourceTemplate('linear')!
    const resolved = resolveTemplateFields(linear.sourceInput, {})
    expect(resolved.mcp!.url).toBe('https://mcp.linear.app/sse')
  })

  it('throws when Jira domain is not provided', () => {
    const jira = getSourceTemplate('jira')!
    expect(() => resolveTemplateFields(jira.sourceInput, {})).toThrow('Missing required field: domain')
  })
})

describe('resolveTemplateFields — edge cases', () => {
  it('handles multiple placeholders in one string', () => {
    const input: CreateSourceInput = {
      name: 'Test',
      provider: 'test',
      type: 'api',
      api: {
        baseUrl: 'https://{{org}}.example.com/{{version}}/api',
        authType: 'bearer',
      },
    }
    const result = resolveTemplateFields(input, { org: 'acme', version: 'v2' })
    expect(result.api!.baseUrl).toBe('https://acme.example.com/v2/api')
  })

  it('preserves non-string values (numbers, booleans, null)', () => {
    const input: CreateSourceInput = {
      name: 'Test',
      provider: 'test',
      type: 'api',
      api: {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
      },
    }
    const result = resolveTemplateFields(input, {})
    expect(result.type).toBe('api')
  })
})
