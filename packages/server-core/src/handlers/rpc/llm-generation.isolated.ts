import { beforeEach, afterEach, describe, expect, it, jest, mock } from 'bun:test'
import { RPC_CHANNELS } from '@depot/shared/protocol'
import type { RpcServer, HandlerFn, RequestContext } from '@depot/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

// Uses top-level mock.module(), which Bun applies process-wide. Keep this test isolated so
// its mocks cannot leak into the shared `bun test` run and contaminate unrelated suites.

interface MockConnection {
  providerType: string
  authType: string
  baseUrl?: string
}

interface QueryCall {
  prompt: string
  options: Record<string, unknown>
}

type QueryImpl = (call: QueryCall) => AsyncIterable<unknown>

const queryMock = mock((call: QueryCall) => currentQueryImpl(call))
const getDefaultOptionsMock = mock((envOverrides?: Record<string, string>) => ({
  env: envOverrides ?? {},
}))
const getDefaultLlmConnectionMock = mock(() => currentConnectionSlug)
const getLlmConnectionMock = mock(() => currentConnection)
const getLlmApiKeyMock = mock(async () => currentApiKey)
const getLlmOAuthMock = mock(async () => currentOAuth)

let currentQueryImpl: QueryImpl
let currentConnectionSlug: string | null
let currentConnection: MockConnection | null
let currentApiKey: string | null
let currentOAuth: { accessToken: string } | null

mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock,
}))

mock.module('@depot/shared/agent', () => ({
  getDefaultOptions: getDefaultOptionsMock,
}))

mock.module('@depot/shared/config', () => ({
  getDefaultLlmConnection: getDefaultLlmConnectionMock,
  getLlmConnection: getLlmConnectionMock,
}))

mock.module('@depot/shared/credentials', () => ({
  getCredentialManager: () => ({
    getLlmApiKey: getLlmApiKeyMock,
    getLlmOAuth: getLlmOAuthMock,
  }),
}))

function createDeps(): HandlerDeps {
  return {
    sessionManager: {} as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    platform: {
      appRootPath: '/',
      resourcesPath: '/',
      isPackaged: false,
      appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
      imageProcessor: {
        getMetadata: async () => null,
        process: async () => Buffer.from(''),
      },
    },
  }
}

async function createTestHarness() {
  const handlers = new Map<string, HandlerFn>()
  const server: RpcServer = {
    handle(channel, handler) {
      handlers.set(channel, handler)
    },
    push() {},
    async invokeClient() {
      return undefined
    },
  }

  const { registerLlmGenerationHandlers } = await import('./llm-generation')
  registerLlmGenerationHandlers(server, createDeps())

  const handler = handlers.get(RPC_CHANNELS.llm.GENERATE_AGENT_MANIFEST)
  if (!handler) {
    throw new Error('GENERATE_AGENT_MANIFEST handler not registered')
  }

  const ctx: RequestContext = {
    clientId: 'client-1',
    workspaceId: 'ws-1',
    webContentsId: 1,
  }

  return { handler, ctx }
}

function assistantResponse(text: string) {
  return (async function* () {
    yield {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text }],
      },
    }
  })()
}

describe('registerLlmGenerationHandlers', () => {
  beforeEach(() => {
    currentConnectionSlug = 'anthropic-default'
    currentConnection = {
      providerType: 'anthropic',
      authType: 'api_key',
    }
    currentApiKey = 'sk-test'
    currentOAuth = null
    currentQueryImpl = () => assistantResponse(JSON.stringify({
      name: 'Ops Agent',
      icon: 'sparkles',
      description: 'Handles requests.',
      personality: 'Direct.',
      sources: ['github'],
      quick_commands: [{ name: 'Review', prompt: 'Review code', icon: 'search' }],
    }))

    queryMock.mockClear()
    getDefaultOptionsMock.mockClear()
    getDefaultLlmConnectionMock.mockClear()
    getLlmConnectionMock.mockClear()
    getLlmApiKeyMock.mockClear()
    getLlmOAuthMock.mockClear()
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('forwards resolved OAuth credentials and base URL into SDK env overrides', async () => {
    currentConnection = {
      providerType: 'anthropic',
      authType: 'oauth',
      baseUrl: 'https://anthropic.example.test',
    }
    currentApiKey = null
    currentOAuth = { accessToken: 'oauth-token' }

    const { handler, ctx } = await createTestHarness()

    const result = await handler(ctx, {
      prompt: 'Build an ops reviewer',
      workspaceSources: ['github'],
    })

    expect(result).toEqual({
      name: 'Ops Agent',
      icon: 'sparkles',
      description: 'Handles requests.',
      personality: 'Direct.',
      sources: ['github'],
      quick_commands: [{ name: 'Review', prompt: 'Review code', icon: 'search' }],
    })

    expect(getDefaultOptionsMock).toHaveBeenCalledWith({
      ANTHROPIC_API_KEY: '',
      CLAUDE_CODE_OAUTH_TOKEN: 'oauth-token',
      ANTHROPIC_BASE_URL: 'https://anthropic.example.test',
    })
    expect(queryMock).toHaveBeenCalledTimes(1)
  })

  it('aborts hung queries after 30 seconds and returns a timeout error', async () => {
    jest.useFakeTimers()
    let markQueryStarted: (() => void) | null = null
    const queryStarted = new Promise<void>((resolve) => {
      markQueryStarted = resolve
    })
    currentQueryImpl = ({ options }) => (async function* () {
      markQueryStarted?.()
      const abortController = options.abortController as AbortController
      await new Promise<never>((_resolve, reject) => {
        abortController.signal.addEventListener('abort', () => {
          reject(abortController.signal.reason ?? new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      })
    })()

    const { handler, ctx } = await createTestHarness()
    const resultPromise = handler(ctx, {
      prompt: 'Build an ops reviewer',
      workspaceSources: ['github'],
    })

    await queryStarted
    jest.advanceTimersByTime(30_000)

    await expect(resultPromise).resolves.toEqual({
      error: 'Request timed out after 30 seconds',
    })
    expect(queryMock).toHaveBeenCalledTimes(1)
  })
})
