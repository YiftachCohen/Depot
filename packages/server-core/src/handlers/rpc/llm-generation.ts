import { query } from '@anthropic-ai/claude-agent-sdk'
import { getDefaultOptions } from '@depot/shared/agent'
import { RPC_CHANNELS } from '@depot/shared/protocol'
import { getDefaultLlmConnection, getLlmConnection } from '@depot/shared/config'
import { getCredentialManager } from '@depot/shared/credentials'
import type { RpcServer } from '@depot/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.llm.CHECK_AVAILABLE,
  RPC_CHANNELS.llm.GENERATE_AGENT_MANIFEST,
] as const

// ============================================================
// Known Lucide icon names — validated against this set
// ============================================================

const KNOWN_ICONS = new Set([
  'activity', 'alert-triangle', 'arrow-right-left', 'award',
  'bar-chart', 'bar-chart-2', 'bar-chart-3', 'book-marked', 'book-open',
  'briefcase', 'building-2',
  'calendar', 'calendar-check', 'calendar-range', 'check-circle',
  'clipboard-check', 'clipboard-list', 'clock', 'code', 'cog',
  'database', 'dollar-sign',
  'file', 'file-bar-chart', 'file-clock', 'file-code', 'file-plus',
  'file-text', 'flask',
  'gantt-chart', 'git-compare', 'git-fork', 'git-pull-request', 'globe',
  'graduation-cap',
  'hash', 'heart-handshake',
  'layers', 'layout', 'layout-dashboard', 'lightbulb', 'list-checks',
  'list-ordered', 'list-tree',
  'mail', 'map', 'megaphone', 'message-square', 'message-square-heart',
  'notebook-pen',
  'pen-tool', 'phone', 'pie-chart', 'plus', 'presentation',
  'receipt', 'rocket', 'route',
  'scale', 'scroll-text', 'search', 'server', 'share-2', 'shield',
  'shield-alert', 'siren', 'sparkles', 'swords',
  'target', 'telescope', 'trending-up',
  'user-check', 'users',
  'wrench', 'zap',
])

const DEFAULT_ICON = 'sparkles'

// Max input prompt length
const MAX_PROMPT_LENGTH = 500
const LLM_GENERATION_TIMEOUT_MS = 30_000

// ============================================================
// Types
// ============================================================

interface GenerateAgentManifestInput {
  prompt: string
  workspaceSources: string[]
  answers?: Record<string, string>
}

interface GeneratedQuickCommand {
  name: string
  prompt: string
  icon?: string
}

interface GenerateAgentManifestResult {
  name: string
  icon: string
  description: string
  personality: string
  sources: string[]
  quick_commands: GeneratedQuickCommand[]
  clarifying_questions?: string[]
}

interface GenerateAgentManifestError {
  error: string
}

// ============================================================
// System prompt
// ============================================================

function buildSystemPrompt(workspaceSources: string[]): string {
  const sourceList = workspaceSources.length > 0
    ? workspaceSources.map(s => `  - ${s}`).join('\n')
    : '  (none configured)'

  return `You are an agent manifest generator for Depot, a skill-first desktop agent interface.
Given a user's description of what they want their agent to do, generate a complete agent configuration.

Available workspace sources (MCP servers / integrations) the agent can use:
${sourceList}

Available icon names (Lucide icons):
activity, alert-triangle, arrow-right-left, award, bar-chart, bar-chart-2, bar-chart-3, book-marked, book-open, briefcase, building-2, calendar, calendar-check, calendar-range, check-circle, clipboard-check, clipboard-list, clock, code, cog, database, dollar-sign, file, file-bar-chart, file-clock, file-code, file-plus, file-text, flask, gantt-chart, git-compare, git-fork, git-pull-request, globe, graduation-cap, hash, heart-handshake, layers, layout, layout-dashboard, lightbulb, list-checks, list-ordered, list-tree, mail, map, megaphone, message-square, message-square-heart, notebook-pen, pen-tool, phone, pie-chart, plus, presentation, receipt, rocket, route, scale, scroll-text, search, server, share-2, shield, shield-alert, siren, sparkles, swords, target, telescope, trending-up, user-check, users, wrench, zap

Rules:
1. "sources" must ONLY contain slugs from the available workspace sources list above. If no source matches, use an empty array.
2. "icon" must be one of the icon names listed above.
3. Generate 2-4 quick_commands that represent the most useful actions for this agent.
4. Each quick_command.icon must also be from the icon list above.
5. "personality" should be 1-3 sentences describing the agent's communication style and approach.
6. If the user's request is ambiguous or you need more information, include "clarifying_questions" with 1-3 questions. Still generate your best guess for the other fields.

Respond with ONLY valid JSON matching this schema:
{
  "name": "string (2-5 words, title case)",
  "icon": "string (from icon list)",
  "description": "string (1-2 sentences describing what the agent does)",
  "personality": "string (1-3 sentences describing communication style)",
  "sources": ["string (workspace source slugs only)"],
  "quick_commands": [
    {
      "name": "string (2-4 words)",
      "prompt": "string (detailed instruction for the agent)",
      "icon": "string (from icon list)"
    }
  ],
  "clarifying_questions": ["string (optional, 1-3 questions)"]
}

Example output:
{
  "name": "Code Reviewer",
  "icon": "git-pull-request",
  "description": "Reviews code changes for bugs, security issues, and design problems.",
  "personality": "Direct and thorough. Focuses on concrete failure scenarios rather than style nits. Adapts review depth to code risk level.",
  "sources": ["github"],
  "quick_commands": [
    {
      "name": "Review PR",
      "prompt": "Review the latest PR changes. For each file: trace error propagation, check type assertions, verify shared state synchronization. Group findings as blocking/should-fix/nit.",
      "icon": "git-pull-request"
    },
    {
      "name": "Security Audit",
      "prompt": "Perform a security-focused review of the codebase. Check for injection vulnerabilities, auth bypasses, sensitive data exposure, and insecure defaults.",
      "icon": "shield"
    }
  ]
}`
}

// ============================================================
// Helpers
// ============================================================

function validateIcon(icon: unknown): string {
  if (typeof icon === 'string' && KNOWN_ICONS.has(icon)) return icon
  return DEFAULT_ICON
}

function validateSources(sources: unknown, workspaceSources: string[]): string[] {
  if (!Array.isArray(sources)) return []
  const wsSet = new Set(workspaceSources)
  return sources.filter((s): s is string => typeof s === 'string' && wsSet.has(s))
}

function validateQuickCommands(commands: unknown): GeneratedQuickCommand[] {
  if (!Array.isArray(commands)) return []
  return commands
    .filter((cmd): cmd is Record<string, unknown> =>
      typeof cmd === 'object' && cmd !== null &&
      typeof (cmd as Record<string, unknown>).name === 'string' &&
      typeof (cmd as Record<string, unknown>).prompt === 'string'
    )
    .slice(0, 6)
    .map(cmd => ({
      name: String(cmd.name).slice(0, 100),
      prompt: String(cmd.prompt).slice(0, 2000),
      ...(cmd.icon ? { icon: validateIcon(cmd.icon) } : {}),
    }))
}

function validateClarifyingQuestions(questions: unknown): string[] | undefined {
  if (!Array.isArray(questions)) return undefined
  const valid = questions
    .filter((q): q is string => typeof q === 'string' && q.length > 0)
    .slice(0, 3)
  return valid.length > 0 ? valid : undefined
}

async function resolveApiCredentials(): Promise<{
  apiKey?: string
  oauthToken?: string
  baseUrl?: string
} | null> {
  const defaultSlug = getDefaultLlmConnection()
  if (!defaultSlug) return null

  const connection = getLlmConnection(defaultSlug)
  if (!connection) return null

  // Support Anthropic-type and Pi connections (Pi routes to Anthropic under the hood)
  const isAnthropic = connection.providerType === 'anthropic' || connection.providerType === 'anthropic_compat'
  const isPi = connection.providerType === 'pi'
  if (!isAnthropic && !isPi) return null

  const credentialManager = getCredentialManager()

  if (connection.authType === 'oauth') {
    const oauth = await credentialManager.getLlmOAuth(defaultSlug)
    if (!oauth?.accessToken) return null
    return {
      oauthToken: oauth.accessToken,
      baseUrl: connection.baseUrl || undefined,
    }
  }

  if (connection.authType === 'api_key' || connection.authType === 'api_key_with_endpoint') {
    const apiKey = await credentialManager.getLlmApiKey(defaultSlug)
    if (!apiKey) return null
    return {
      apiKey,
      baseUrl: connection.baseUrl || undefined,
    }
  }

  if (connection.authType === 'environment') {
    const envKey = process.env.ANTHROPIC_API_KEY
    if (!envKey) return null
    return {
      apiKey: envKey,
      baseUrl: connection.baseUrl || undefined,
    }
  }

  return null
}

function buildCredentialEnvOverrides(creds: {
  apiKey?: string
  oauthToken?: string
  baseUrl?: string
}): Record<string, string> {
  return {
    ANTHROPIC_API_KEY: creds.apiKey ?? '',
    CLAUDE_CODE_OAUTH_TOKEN: creds.oauthToken ?? '',
    ANTHROPIC_BASE_URL: creds.baseUrl ?? '',
  }
}

function isTimeoutError(err: unknown, abortController: AbortController): boolean {
  if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
    const reason = abortController.signal.reason
    return reason instanceof DOMException && reason.name === 'TimeoutError'
  }

  return err instanceof Error && err.name === 'TimeoutError'
}

// ============================================================
// Handler registration
// ============================================================

export function registerLlmGenerationHandlers(server: RpcServer, deps: HandlerDeps): void {

  // Check if LLM credentials are available for generation
  server.handle(RPC_CHANNELS.llm.CHECK_AVAILABLE, async (): Promise<{ available: boolean }> => {
    try {
      const creds = await resolveApiCredentials()
      return { available: creds !== null }
    } catch {
      return { available: false }
    }
  })

  // Generate an agent manifest from a natural language prompt
  server.handle(RPC_CHANNELS.llm.GENERATE_AGENT_MANIFEST, async (
    _ctx,
    input: GenerateAgentManifestInput,
  ): Promise<GenerateAgentManifestResult | GenerateAgentManifestError> => {
    const { prompt, workspaceSources, answers } = input

    // Validate input
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return { error: 'Prompt is required' }
    }

    const trimmedPrompt = prompt.trim().slice(0, MAX_PROMPT_LENGTH)

    // Resolve credentials
    const creds = await resolveApiCredentials()
    if (!creds) {
      return { error: 'No LLM credentials available. Please configure an Anthropic connection first.' }
    }

    // Build user message
    let userMessage = trimmedPrompt
    if (answers && Object.keys(answers).length > 0) {
      const answersText = Object.entries(answers)
        .map(([q, a]) => `Q: ${q}\nA: ${a}`)
        .join('\n\n')
      userMessage = `${trimmedPrompt}\n\nAdditional context from follow-up questions:\n${answersText}`
    }

    deps.platform.logger?.info(`[LLM_GENERATION] Generating agent manifest via SDK. hasApiKey=${!!creds.apiKey}, hasOAuth=${!!creds.oauthToken}, prompt="${trimmedPrompt.slice(0, 80)}"`)
    const abortController = new AbortController()

    try {
      const timeoutId = setTimeout(() => {
        abortController.abort(new DOMException('Request timed out after 30 seconds', 'TimeoutError'))
      }, LLM_GENERATION_TIMEOUT_MS)

      // Use the Claude Agent SDK query() which handles OAuth, API key, Bedrock, etc.
      const options = {
        ...getDefaultOptions(buildCredentialEnvOverrides(creds)),
        model: 'claude-sonnet-4-20250514',
        maxTurns: 1,
        abortController,
        systemPrompt: buildSystemPrompt(workspaceSources),
        maxTokens: 2048,
      }

      let resultText = ''
      try {
        for await (const msg of query({ prompt: userMessage, options })) {
          if (msg.type === 'assistant') {
            for (const block of msg.message.content) {
              if (block.type === 'text') {
                resultText += block.text
              }
            }
          }
        }
      } finally {
        clearTimeout(timeoutId)
      }

      if (!resultText.trim()) {
        return { error: 'Empty response from LLM' }
      }

      // Parse JSON from response (handle markdown code fences)
      let jsonText = resultText.trim()
      const fenceMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
      if (fenceMatch?.[1]) {
        jsonText = fenceMatch[1]
      }

      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(jsonText) as Record<string, unknown>
      } catch {
        deps.platform.logger?.error(`[LLM_GENERATION] Failed to parse JSON: ${jsonText.slice(0, 500)}`)
        return { error: 'Failed to parse LLM response as JSON' }
      }

      // Post-validate and sanitize
      const name = typeof parsed.name === 'string' ? parsed.name.slice(0, 100) : 'Untitled Agent'
      const icon = validateIcon(parsed.icon)
      const description = typeof parsed.description === 'string' ? parsed.description.slice(0, 500) : ''
      const personality = typeof parsed.personality === 'string' ? parsed.personality.slice(0, 1000) : ''
      const sources = validateSources(parsed.sources, workspaceSources)
      const quick_commands = validateQuickCommands(parsed.quick_commands)
      const clarifying_questions = validateClarifyingQuestions(parsed.clarifying_questions)

      if (quick_commands.length === 0) {
        return { error: 'LLM did not generate any valid quick commands' }
      }

      deps.platform.logger?.info(`[LLM_GENERATION] Generated manifest for "${name}" with ${quick_commands.length} commands`)

      return {
        name,
        icon,
        description,
        personality,
        sources,
        quick_commands,
        ...(clarifying_questions ? { clarifying_questions } : {}),
      }
    } catch (err) {
      if (isTimeoutError(err, abortController)) {
        return { error: 'Request timed out after 30 seconds' }
      }
      const msg = err instanceof Error ? err.message : String(err)
      deps.platform.logger?.error(`[LLM_GENERATION] Error: ${msg.slice(0, 500)}`)
      return { error: `Generation failed: ${msg}` }
    }
  })
}
