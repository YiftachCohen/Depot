/**
 * Quick Setup orchestration hook.
 *
 * State machine: idle → creating → authenticating → testing → success | error
 */

import { useState, useCallback, useRef } from 'react'
import { atom, useAtom } from 'jotai'
import type { SourceTemplate } from '@depot/shared/sources'
import { resolveTemplateFields, validatePreAuthField } from '@depot/shared/sources'

export type QuickSetupStep = 'idle' | 'creating' | 'authenticating' | 'testing' | 'success' | 'error'

export interface QuickSetupState {
  step: QuickSetupStep
  loading: boolean
  error: string | null
  /** Slug of the created source (used for OAuth / credential save / test calls) */
  sourceSlug: string | null
  template: SourceTemplate | null
  toolCount?: number
}

/** Global guard to prevent concurrent OAuth flows */
const oauthInProgressAtom = atom(false)

const INITIAL_STATE: QuickSetupState = {
  step: 'idle',
  loading: false,
  error: null,
  sourceSlug: null,
  template: null,
}

const CREATE_TIMEOUT_MS = 30_000

export function useQuickSetup(workspaceId: string) {
  const [state, setState] = useState<QuickSetupState>(INITIAL_STATE)
  const [oauthInProgress, setOauthInProgress] = useAtom(oauthInProgressAtom)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortedRef = useRef(false)

  const clearTimeout_ = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const startSetup = useCallback(async (
    template: SourceTemplate,
    fieldValues?: Record<string, string>,
  ) => {
    abortedRef.current = false
    clearTimeout_()

    // Validate pre-auth fields
    if (template.preAuthFields && fieldValues) {
      for (const field of template.preAuthFields) {
        const err = validatePreAuthField(field.key, fieldValues[field.key] ?? '')
        if (err) {
          setState({ ...INITIAL_STATE, step: 'error', error: err, template })
          return
        }
      }
    }

    // Resolve template fields
    let sourceInput = template.sourceInput
    if (template.preAuthFields && fieldValues) {
      try {
        sourceInput = resolveTemplateFields(template.sourceInput, fieldValues)
      } catch (e) {
        setState({ ...INITIAL_STATE, step: 'error', error: (e as Error).message, template })
        return
      }
    }

    // ── Creating ──────────────────────────────────────────────────────
    setState({ step: 'creating', loading: true, error: null, sourceSlug: null, template })

    // Timeout guard for createSource (icon download can hang)
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      timeoutRef.current = setTimeout(() => resolve('timeout'), CREATE_TIMEOUT_MS)
    })

    try {
      const createPromise = window.electronAPI.createSource(workspaceId, sourceInput)
      const result = await Promise.race([createPromise, timeoutPromise])

      if (abortedRef.current) return
      clearTimeout_()

      if (result === 'timeout') {
        setState({ step: 'error', loading: false, error: 'Source creation timed out. Try again.', sourceSlug: null, template })
        return
      }

      // createSource returns FolderSourceConfig which has slug directly
      const created = result as { slug: string }
      const slug = created.slug

      // ── No-auth sources → skip to success ─────────────────────────
      if (template.authMethod === 'none') {
        setState({ step: 'success', loading: false, error: null, sourceSlug: slug, template })
        return
      }

      // ── Auth required → transition to authenticating ──────────────
      setState({ step: 'authenticating', loading: false, error: null, sourceSlug: slug, template })

    } catch (e) {
      if (abortedRef.current) return
      clearTimeout_()
      setState({ step: 'error', loading: false, error: (e as Error).message || 'Failed to create source', sourceSlug: null, template })
    }
  }, [workspaceId, clearTimeout_])

  const performAuth = useCallback(async (credential?: string) => {
    if (!state.sourceSlug || !state.template) return

    const { sourceSlug, template } = state

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      if (template.authMethod === 'oauth') {
        // Guard against concurrent OAuth
        if (oauthInProgress) {
          setState(prev => ({ ...prev, loading: false, error: 'Another OAuth flow is in progress' }))
          return
        }
        setOauthInProgress(true)

        try {
          const result = await window.electronAPI.performOAuth({ sourceSlug })
          if (abortedRef.current) return

          if (!result.success) {
            setState(prev => ({
              ...prev,
              step: 'error',
              loading: false,
              error: result.error || 'OAuth failed',
            }))
            return
          }
        } finally {
          setOauthInProgress(false)
        }
      } else if (template.authMethod === 'bearer' || template.authMethod === 'api-key') {
        if (!credential) {
          setState(prev => ({ ...prev, loading: false, error: 'Credential is required' }))
          return
        }
        await window.electronAPI.saveSourceCredentials(workspaceId, sourceSlug, credential)
        if (abortedRef.current) return
      }

      // ── Testing ───────────────────────────────────────────────────
      // MCP sources: test the connection
      // OAuth API sources: treat successful auth as connected
      // Bearer/API-key API sources with testEndpoint: test the connection
      const shouldTest = template.sourceInput.type === 'mcp' ||
        (template.sourceInput.type === 'api' && template.sourceInput.api?.testEndpoint && template.authMethod !== 'oauth')

      if (shouldTest) {
        setState(prev => ({ ...prev, step: 'testing' }))

        try {
          const testResult = await window.electronAPI.testSourceConnection(workspaceId, sourceSlug)
          if (abortedRef.current) return

          if (testResult?.success === false) {
            // Check for npx/command-not-found error for Exa
            const errorMsg = testResult.error || 'Connection test failed'
            const isCommandNotFound = errorMsg.includes('ENOENT') || errorMsg.includes('command not found')
            const displayError = isCommandNotFound && template.id === 'exa'
              ? 'Exa requires npx. Install Node.js first.'
              : errorMsg

            setState(prev => ({ ...prev, step: 'error', loading: false, error: displayError }))
            return
          }

          setState(prev => ({
            ...prev,
            step: 'success',
            loading: false,
            toolCount: testResult?.toolCount,
          }))
        } catch (e) {
          if (abortedRef.current) return
          setState(prev => ({ ...prev, step: 'error', loading: false, error: (e as Error).message }))
        }
      } else {
        // OAuth API sources or sources without testEndpoint — treat as connected
        setState(prev => ({ ...prev, step: 'success', loading: false }))
      }

    } catch (e) {
      if (abortedRef.current) return
      setState(prev => ({ ...prev, step: 'error', loading: false, error: (e as Error).message || 'Authentication failed' }))
    }
  }, [state.sourceSlug, state.template, workspaceId, oauthInProgress, setOauthInProgress])

  const retry = useCallback(() => {
    if (!state.template) return
    setState({ ...INITIAL_STATE, template: state.template })
  }, [state.template])

  const reset = useCallback(() => {
    abortedRef.current = true
    clearTimeout_()
    setState(INITIAL_STATE)
  }, [clearTimeout_])

  return {
    ...state,
    oauthInProgress,
    startSetup,
    performAuth,
    retry,
    reset,
  }
}
