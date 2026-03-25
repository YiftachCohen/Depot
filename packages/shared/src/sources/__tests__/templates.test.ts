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
  it('accepts valid domain names', () => {
    expect(validatePreAuthField('domain', 'my-company')).toBeNull()
    expect(validatePreAuthField('domain', 'acme123')).toBeNull()
    expect(validatePreAuthField('domain', 'ABC')).toBeNull()
  })

  it('rejects empty values', () => {
    expect(validatePreAuthField('domain', '')).toBeTruthy()
    expect(validatePreAuthField('domain', '  ')).toBeTruthy()
  })

  it('rejects URL-unsafe characters', () => {
    expect(validatePreAuthField('domain', 'evil.com')).toBeTruthy()
    expect(validatePreAuthField('domain', 'evil.com#')).toBeTruthy()
    expect(validatePreAuthField('domain', 'evil/path')).toBeTruthy()
    expect(validatePreAuthField('domain', 'evil?query')).toBeTruthy()
    expect(validatePreAuthField('domain', 'evil@host')).toBeTruthy()
    expect(validatePreAuthField('domain', 'has spaces')).toBeTruthy()
  })
})
