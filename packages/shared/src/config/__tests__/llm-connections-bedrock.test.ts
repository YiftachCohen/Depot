/**
 * Tests for Bedrock-specific LLM Connection functionality
 *
 * Covers:
 * - resolveAuthEnvVars() credential chain for bedrock provider
 * - isValidProviderAuthCombination() for bedrock auth types
 * - getDefaultModelsForConnection() for bedrock
 */
import { describe, it, expect } from 'bun:test'
import {
  resolveAuthEnvVars,
  isValidProviderAuthCombination,
  authTypeToCredentialStorageType,
  getDefaultModelsForConnection,
  getDefaultModelForConnection,
  isAnthropicProvider,
} from '../llm-connections'
import { ANTHROPIC_MODELS } from '../models'
import type { LlmConnection } from '../llm-connections'
import type { CredentialManager } from '../../credentials/manager'

// ============================================================
// Test Helpers
// ============================================================

function createBedrockConnection(overrides: Partial<LlmConnection> = {}): LlmConnection {
  return {
    slug: 'bedrock-test',
    name: 'Bedrock Test',
    providerType: 'bedrock',
    authType: 'iam_credentials',
    createdAt: Date.now(),
    ...overrides,
  }
}

function createMockCredentialManager(overrides: Record<string, unknown> = {}): CredentialManager {
  return {
    getLlmApiKey: async () => null,
    getLlmOAuth: async () => null,
    getLlmIamCredentials: async () => null,
    ...overrides,
  } as unknown as CredentialManager
}

function createNoopGetValidOAuthToken(): (slug: string) => Promise<{ accessToken?: string | null }> {
  return async () => ({ accessToken: null })
}

// ============================================================
// resolveAuthEnvVars — Bedrock + iam_credentials
// ============================================================

describe('resolveAuthEnvVars — bedrock + iam_credentials', () => {
  it('sets CLAUDE_CODE_USE_BEDROCK=1, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, AWS_REGION', async () => {
    const connection = createBedrockConnection({
      authType: 'iam_credentials',
    })

    const credentialManager = createMockCredentialManager({
      getLlmIamCredentials: async () => ({
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        sessionToken: 'FwoGZXIvYXdzEBYaDHqa0AP',
        region: 'us-west-2',
      }),
    })

    const result = await resolveAuthEnvVars(
      connection,
      'bedrock-test',
      credentialManager,
      createNoopGetValidOAuthToken(),
    )

    expect(result.success).toBe(true)
    expect(result.envVars.CLAUDE_CODE_USE_BEDROCK).toBe('1')
    expect(result.envVars.AWS_ACCESS_KEY_ID).toBe('AKIAIOSFODNN7EXAMPLE')
    expect(result.envVars.AWS_SECRET_ACCESS_KEY).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
    expect(result.envVars.AWS_SESSION_TOKEN).toBe('FwoGZXIvYXdzEBYaDHqa0AP')
    expect(result.envVars.AWS_REGION).toBe('us-west-2')
  })

  it('omits AWS_SESSION_TOKEN when sessionToken is not provided', async () => {
    const connection = createBedrockConnection({
      authType: 'iam_credentials',
    })

    const credentialManager = createMockCredentialManager({
      getLlmIamCredentials: async () => ({
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      }),
    })

    const result = await resolveAuthEnvVars(
      connection,
      'bedrock-test',
      credentialManager,
      createNoopGetValidOAuthToken(),
    )

    expect(result.success).toBe(true)
    expect(result.envVars.CLAUDE_CODE_USE_BEDROCK).toBe('1')
    expect(result.envVars.AWS_ACCESS_KEY_ID).toBe('AKIAIOSFODNN7EXAMPLE')
    expect(result.envVars.AWS_SECRET_ACCESS_KEY).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
    expect(result.envVars.AWS_SESSION_TOKEN).toBeUndefined()
  })

  it('returns failure when no IAM credentials found', async () => {
    const connection = createBedrockConnection({
      authType: 'iam_credentials',
    })

    const credentialManager = createMockCredentialManager({
      getLlmIamCredentials: async () => null,
    })

    const result = await resolveAuthEnvVars(
      connection,
      'bedrock-test',
      credentialManager,
      createNoopGetValidOAuthToken(),
    )

    expect(result.success).toBe(false)
    expect(result.warning).toContain('No IAM credentials found')
    expect(result.warning).toContain('bedrock-test')
  })
})

// ============================================================
// resolveAuthEnvVars — Bedrock + environment
// ============================================================

describe('resolveAuthEnvVars — bedrock + environment', () => {
  it('sets CLAUDE_CODE_USE_BEDROCK=1 and passes through with no injected credentials', async () => {
    const connection = createBedrockConnection({
      authType: 'environment',
    })

    const credentialManager = createMockCredentialManager()

    const result = await resolveAuthEnvVars(
      connection,
      'bedrock-test',
      credentialManager,
      createNoopGetValidOAuthToken(),
    )

    expect(result.success).toBe(true)
    expect(result.envVars.CLAUDE_CODE_USE_BEDROCK).toBe('1')
    // Environment auth should NOT inject AWS keys — they come from process.env
    expect(result.envVars.AWS_ACCESS_KEY_ID).toBeUndefined()
    expect(result.envVars.AWS_SECRET_ACCESS_KEY).toBeUndefined()
  })

  it('propagates awsRegion from connection config when using environment auth', async () => {
    const connection = createBedrockConnection({
      authType: 'environment',
      awsRegion: 'eu-west-1',
    })

    const credentialManager = createMockCredentialManager()

    const result = await resolveAuthEnvVars(
      connection,
      'bedrock-test',
      credentialManager,
      createNoopGetValidOAuthToken(),
    )

    expect(result.success).toBe(true)
    expect(result.envVars.AWS_REGION).toBe('eu-west-1')
  })
})

// ============================================================
// resolveAuthEnvVars — Bedrock + bearer_token
// ============================================================

describe('resolveAuthEnvVars — bedrock + bearer_token', () => {
  it('sets ANTHROPIC_API_KEY from stored credential and CLAUDE_CODE_USE_BEDROCK=1', async () => {
    const connection = createBedrockConnection({
      authType: 'bearer_token',
    })

    const credentialManager = createMockCredentialManager({
      getLlmApiKey: async () => 'bedrock-bearer-token-value',
    })

    const result = await resolveAuthEnvVars(
      connection,
      'bedrock-test',
      credentialManager,
      createNoopGetValidOAuthToken(),
    )

    expect(result.success).toBe(true)
    expect(result.envVars.CLAUDE_CODE_USE_BEDROCK).toBe('1')
    expect(result.envVars.ANTHROPIC_API_KEY).toBe('bedrock-bearer-token-value')
  })

  it('returns failure when no bearer token found', async () => {
    const connection = createBedrockConnection({
      authType: 'bearer_token',
    })

    const credentialManager = createMockCredentialManager({
      getLlmApiKey: async () => null,
    })

    const result = await resolveAuthEnvVars(
      connection,
      'bedrock-test',
      credentialManager,
      createNoopGetValidOAuthToken(),
    )

    expect(result.success).toBe(false)
    expect(result.warning).toContain('No API key found')
  })
})

// ============================================================
// resolveAuthEnvVars — awsRegion propagation
// ============================================================

describe('resolveAuthEnvVars — awsRegion propagation', () => {
  it('uses awsRegion from connection when IAM credentials have no region', async () => {
    const connection = createBedrockConnection({
      authType: 'iam_credentials',
      awsRegion: 'ap-southeast-1',
    })

    const credentialManager = createMockCredentialManager({
      getLlmIamCredentials: async () => ({
        accessKeyId: 'AKIAEXAMPLE',
        secretAccessKey: 'secretEXAMPLE',
        // no region in IAM credentials
      }),
    })

    const result = await resolveAuthEnvVars(
      connection,
      'bedrock-test',
      credentialManager,
      createNoopGetValidOAuthToken(),
    )

    expect(result.success).toBe(true)
    // IAM credentials did not set AWS_REGION, so connection.awsRegion should be used
    expect(result.envVars.AWS_REGION).toBe('ap-southeast-1')
  })

  it('IAM credential region takes priority over connection awsRegion', async () => {
    const connection = createBedrockConnection({
      authType: 'iam_credentials',
      awsRegion: 'ap-southeast-1',
    })

    const credentialManager = createMockCredentialManager({
      getLlmIamCredentials: async () => ({
        accessKeyId: 'AKIAEXAMPLE',
        secretAccessKey: 'secretEXAMPLE',
        region: 'us-east-1',
      }),
    })

    const result = await resolveAuthEnvVars(
      connection,
      'bedrock-test',
      credentialManager,
      createNoopGetValidOAuthToken(),
    )

    expect(result.success).toBe(true)
    // IAM credentials set AWS_REGION to us-east-1, connection.awsRegion should NOT override
    expect(result.envVars.AWS_REGION).toBe('us-east-1')
  })
})

// ============================================================
// isValidProviderAuthCombination — Bedrock
// ============================================================

describe('isValidProviderAuthCombination — bedrock', () => {
  it('accepts iam_credentials', () => {
    expect(isValidProviderAuthCombination('bedrock', 'iam_credentials')).toBe(true)
  })

  it('accepts bearer_token', () => {
    expect(isValidProviderAuthCombination('bedrock', 'bearer_token')).toBe(true)
  })

  it('accepts environment', () => {
    expect(isValidProviderAuthCombination('bedrock', 'environment')).toBe(true)
  })

  it('rejects api_key', () => {
    expect(isValidProviderAuthCombination('bedrock', 'api_key')).toBe(false)
  })

  it('rejects oauth', () => {
    expect(isValidProviderAuthCombination('bedrock', 'oauth')).toBe(false)
  })

  it('rejects api_key_with_endpoint', () => {
    expect(isValidProviderAuthCombination('bedrock', 'api_key_with_endpoint')).toBe(false)
  })

  it('rejects none', () => {
    expect(isValidProviderAuthCombination('bedrock', 'none')).toBe(false)
  })

  it('rejects service_account_file', () => {
    expect(isValidProviderAuthCombination('bedrock', 'service_account_file')).toBe(false)
  })
})

// ============================================================
// getDefaultModelsForConnection — Bedrock
// ============================================================

describe('getDefaultModelsForConnection — bedrock', () => {
  it('returns ANTHROPIC_MODELS', () => {
    const models = getDefaultModelsForConnection('bedrock')
    expect(models).toEqual(ANTHROPIC_MODELS)
  })

  it('returns non-empty model list', () => {
    const models = getDefaultModelsForConnection('bedrock')
    expect(models.length).toBeGreaterThan(0)
  })

  it('returns ModelDefinition objects (not strings)', () => {
    const models = getDefaultModelsForConnection('bedrock')
    const first = models[0]!
    expect(typeof first).toBe('object')
    expect(typeof (first as any).id).toBe('string')
    expect(typeof (first as any).name).toBe('string')
  })
})

// ============================================================
// getDefaultModelForConnection — Bedrock
// ============================================================

describe('getDefaultModelForConnection — bedrock', () => {
  it('returns first ANTHROPIC_MODELS entry ID', () => {
    const modelId = getDefaultModelForConnection('bedrock')
    expect(typeof modelId).toBe('string')
    expect(modelId.length).toBeGreaterThan(0)
    expect(modelId).toBe(ANTHROPIC_MODELS[0]!.id)
  })
})

// ============================================================
// isAnthropicProvider — bedrock
// ============================================================

describe('isAnthropicProvider — bedrock', () => {
  it('returns true for bedrock', () => {
    expect(isAnthropicProvider('bedrock')).toBe(true)
  })
})

// ============================================================
// resolveAuthEnvVars — Bedrock + aws_profile
// ============================================================

describe('resolveAuthEnvVars — bedrock + aws_profile', () => {
  it('sets AWS_PROFILE and CLAUDE_CODE_USE_BEDROCK=1', async () => {
    const connection = createBedrockConnection({
      authType: 'aws_profile',
      awsProfile: 'my-corp-profile',
    })

    const credentialManager = createMockCredentialManager()

    const result = await resolveAuthEnvVars(
      connection,
      'bedrock-test',
      credentialManager,
      createNoopGetValidOAuthToken(),
    )

    expect(result.success).toBe(true)
    expect(result.envVars.CLAUDE_CODE_USE_BEDROCK).toBe('1')
    expect(result.envVars.AWS_PROFILE).toBe('my-corp-profile')
    // Should NOT inject explicit credentials — SDK resolves from profile
    expect(result.envVars.AWS_ACCESS_KEY_ID).toBeUndefined()
    expect(result.envVars.AWS_SECRET_ACCESS_KEY).toBeUndefined()
    expect(result.envVars.AWS_SESSION_TOKEN).toBeUndefined()
  })

  it('propagates awsRegion from connection config', async () => {
    const connection = createBedrockConnection({
      authType: 'aws_profile',
      awsProfile: 'default',
      awsRegion: 'eu-central-1',
    })

    const credentialManager = createMockCredentialManager()

    const result = await resolveAuthEnvVars(
      connection,
      'bedrock-test',
      credentialManager,
      createNoopGetValidOAuthToken(),
    )

    expect(result.success).toBe(true)
    expect(result.envVars.AWS_PROFILE).toBe('default')
    expect(result.envVars.AWS_REGION).toBe('eu-central-1')
  })

  it('does not set AWS_PROFILE when awsProfile is undefined', async () => {
    const connection = createBedrockConnection({
      authType: 'aws_profile',
      // no awsProfile set
    })

    const credentialManager = createMockCredentialManager()

    const result = await resolveAuthEnvVars(
      connection,
      'bedrock-test',
      credentialManager,
      createNoopGetValidOAuthToken(),
    )

    expect(result.success).toBe(true)
    expect(result.envVars.AWS_PROFILE).toBeUndefined()
    expect(result.envVars.CLAUDE_CODE_USE_BEDROCK).toBe('1')
  })
})

// ============================================================
// isValidProviderAuthCombination — aws_profile
// ============================================================

describe('isValidProviderAuthCombination — bedrock + aws_profile', () => {
  it('accepts aws_profile for bedrock', () => {
    expect(isValidProviderAuthCombination('bedrock', 'aws_profile')).toBe(true)
  })

  it('rejects aws_profile for non-bedrock providers', () => {
    expect(isValidProviderAuthCombination('anthropic', 'aws_profile')).toBe(false)
    expect(isValidProviderAuthCombination('pi', 'aws_profile')).toBe(false)
    expect(isValidProviderAuthCombination('vertex', 'aws_profile')).toBe(false)
  })
})

// ============================================================
// authTypeToCredentialStorageType — aws_profile
// ============================================================

describe('authTypeToCredentialStorageType — aws_profile', () => {
  it('returns null (no credential storage needed)', () => {
    expect(authTypeToCredentialStorageType('aws_profile')).toBeNull()
  })
})
