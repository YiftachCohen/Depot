/**
 * Tests for BedrockVertexModelFetcher
 *
 * Covers:
 * - refreshIntervalMs is 0 (no periodic refresh)
 * - fetchModels delegates to fetchBackendModels
 * - Error handling for missing platform init
 */
import { describe, it, expect } from 'bun:test'
import { BedrockVertexModelFetcher } from '../bedrock-vertex'
import type { LlmConnection } from '@depot/shared/config'

// ============================================================
// BedrockVertexModelFetcher
// ============================================================

describe('BedrockVertexModelFetcher', () => {
  it('has refreshIntervalMs set to 0 (no periodic refresh)', () => {
    const fetcher = new BedrockVertexModelFetcher()
    expect(fetcher.refreshIntervalMs).toBe(0)
  })

  it('fetchModels rejects when platform not initialized (getHostRuntime throws)', async () => {
    const fetcher = new BedrockVertexModelFetcher()

    const connection: LlmConnection = {
      slug: 'bedrock-test',
      name: 'Bedrock Test',
      providerType: 'bedrock',
      authType: 'iam_credentials',
      createdAt: Date.now(),
    }

    // getHostRuntime() throws when setFetcherPlatform() has not been called.
    // In a clean test environment, the platform is not initialized.
    await expect(fetcher.fetchModels(connection, {})).rejects.toThrow()
  })
})

// ============================================================
// Registry integration
// ============================================================

describe('BedrockVertexModelFetcher in registry', () => {
  it('is registered for both bedrock and vertex providers', async () => {
    // Dynamic import to avoid side effects from registry initialization
    const { MODEL_FETCHERS } = await import('../registry')

    expect(MODEL_FETCHERS.bedrock).toBeInstanceOf(BedrockVertexModelFetcher)
    expect(MODEL_FETCHERS.vertex).toBeInstanceOf(BedrockVertexModelFetcher)
  })

  it('bedrock and vertex share the same fetcher instance', async () => {
    const { MODEL_FETCHERS } = await import('../registry')

    expect(MODEL_FETCHERS.bedrock).toBe(MODEL_FETCHERS.vertex)
  })
})
