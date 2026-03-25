import * as React from 'react'
import { useState, useCallback } from 'react'
import { Check, AlertCircle, Loader2, Eye, EyeOff, ExternalLink, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { validatePreAuthField } from '@depot/shared/sources'
import type { SourceTemplate } from '@depot/shared/sources'
import type { QuickSetupStep } from '@/hooks/useQuickSetup'

interface QuickSetupAuthStepProps {
  template: SourceTemplate
  step: QuickSetupStep
  loading: boolean
  error: string | null
  toolCount?: number
  onSubmitOAuth: () => void
  onSubmitCredential: (credential: string, fieldValues?: Record<string, string>) => void
  onSubmitLocalFolder: (path: string) => void
  onRetry: () => void
  onDone: () => void
  onConnectAnother: () => void
}

export function QuickSetupAuthStep({
  template,
  step,
  loading,
  error,
  toolCount,
  onSubmitOAuth,
  onSubmitCredential,
  onSubmitLocalFolder,
  onRetry,
  onDone,
  onConnectAnother,
}: QuickSetupAuthStepProps) {
  const [credential, setCredential] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [oauthTimeout, setOauthTimeout] = useState(false)
  const oauthTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [key]: value }))
    setFieldErrors(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const validateFields = useCallback((): boolean => {
    if (!template.preAuthFields) return true
    const errors: Record<string, string> = {}
    for (const field of template.preAuthFields) {
      const err = validatePreAuthField(field.key, fieldValues[field.key] ?? '')
      if (err) errors[field.key] = err
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [template.preAuthFields, fieldValues])

  const handleOAuthClick = useCallback(() => {
    setOauthTimeout(false)
    oauthTimerRef.current = setTimeout(() => setOauthTimeout(true), 60_000)
    onSubmitOAuth()
  }, [onSubmitOAuth])

  const handleCredentialSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!validateFields()) return
    onSubmitCredential(credential, template.preAuthFields ? fieldValues : undefined)
  }, [credential, fieldValues, template.preAuthFields, validateFields, onSubmitCredential])

  const handleFolderPick = useCallback(async () => {
    const path = await window.electronAPI.openFolderDialog()
    if (path) {
      onSubmitLocalFolder(path)
    }
  }, [onSubmitLocalFolder])

  // Clear OAuth timeout on unmount or step change
  React.useEffect(() => {
    return () => {
      if (oauthTimerRef.current) clearTimeout(oauthTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    if (step !== 'authenticating') {
      setOauthTimeout(false)
      if (oauthTimerRef.current) clearTimeout(oauthTimerRef.current)
    }
  }, [step])

  // ── Terminal states ──────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
          <Check className="size-8" strokeWidth={2.5} />
        </div>
        <h3 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          {template.name} Connected
        </h3>
        {toolCount !== undefined && toolCount > 0 && (
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {toolCount} tool{toolCount !== 1 ? 's' : ''} available
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onDone}
            className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
          >
            Done
          </button>
          <button
            type="button"
            onClick={onConnectAnother}
            className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            Connect another
          </button>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          <AlertCircle className="size-8" />
        </div>
        <h3 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          Connection Failed
        </h3>
        <p className="mt-2 max-w-xs text-sm text-stone-500 dark:text-stone-400">
          {error}
        </p>
        {template.id === 'exa' && error?.includes('Node.js') && (
          <a
            href="https://nodejs.org"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
            onClick={(e) => {
              e.preventDefault()
              window.electronAPI.openUrl('https://nodejs.org')
            }}
          >
            Install Node.js <ExternalLink className="size-3" />
          </a>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-9 items-center gap-2 rounded-[8px] bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  if (step === 'testing' || step === 'creating') {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Loader2 className="size-8 animate-spin text-amber-600" />
        <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
          {step === 'creating' ? 'Creating source...' : 'Testing connection...'}
        </p>
      </div>
    )
  }

  // ── Auth step (authenticating) ───────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[400px] py-4">
      {/* Header */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-amber-50 text-3xl dark:bg-amber-900/30">
          {template.icon}
        </div>
        <h3 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          {template.name}
        </h3>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Connect your {template.name} to access {template.tagline.toLowerCase()}
        </p>
      </div>

      {/* Local folder → folder picker */}
      {template.authMethod === 'none' && (
        <button
          type="button"
          onClick={handleFolderPick}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
        >
          <FolderOpen className="size-4" />
          Choose Folder
        </button>
      )}

      {/* OAuth flow */}
      {template.authMethod === 'oauth' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-4" aria-live="polite">
              <Loader2 className="size-6 animate-spin text-amber-600" />
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Waiting for {template.name} authorization...
              </p>
              {oauthTimeout && (
                <button
                  type="button"
                  onClick={handleOAuthClick}
                  className="text-sm text-amber-600 hover:text-amber-700 underline"
                >
                  Taking too long? Try again
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleOAuthClick}
              className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
              aria-label={`Connect with ${template.name} via OAuth`}
            >
              Connect with {template.name}
            </button>
          )}
        </div>
      )}

      {/* Bearer / API Key flow */}
      {(template.authMethod === 'bearer' || template.authMethod === 'api-key') && (
        <form onSubmit={handleCredentialSubmit} className="space-y-4">
          {/* Pre-auth fields */}
          {template.preAuthFields?.map((field) => (
            <div key={field.key}>
              <label
                htmlFor={`preauth-${field.key}`}
                className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300"
              >
                {field.label}
              </label>
              <input
                id={`preauth-${field.key}`}
                type="text"
                value={fieldValues[field.key] ?? ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={cn(
                  'w-full rounded-[8px] border bg-white px-3 py-2 text-sm transition-colors dark:bg-stone-900',
                  'focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400',
                  fieldErrors[field.key]
                    ? 'border-red-300 dark:border-red-700'
                    : 'border-stone-200 dark:border-stone-700',
                )}
              />
              {fieldErrors[field.key] && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[field.key]}</p>
              )}
            </div>
          ))}

          {/* Credential input */}
          <div>
            <label
              htmlFor="credential-input"
              className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300"
            >
              {template.credentialLabel || 'API Key'}
            </label>
            <div className="relative">
              <input
                id="credential-input"
                type={showPassword ? 'text' : 'password'}
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder={`Enter your ${(template.credentialLabel || 'API key').toLowerCase()}`}
                className="w-full rounded-[8px] border border-stone-200 bg-white px-3 py-2 pr-10 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 dark:border-stone-700 dark:bg-stone-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
                aria-label={showPassword ? 'Hide credential' : 'Show credential'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {template.credentialHelpUrl && (
              <a
                href={template.credentialHelpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                onClick={(e) => {
                  e.preventDefault()
                  window.electronAPI.openUrl(template.credentialHelpUrl!)
                }}
              >
                Where do I find this? <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !credential.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
        </form>
      )}
    </div>
  )
}
