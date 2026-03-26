import * as React from 'react'
import { useState, useCallback, useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useAtomValue } from 'jotai'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SOURCE_TEMPLATES } from '@depot/shared/sources/templates'
import type { SourceTemplate } from '@depot/shared/sources/templates'
import { sourcesAtom } from '@/atoms/sources'
import { SourceTemplateGrid } from './SourceTemplateGrid'
import { QuickSetupAuthStep } from './QuickSetupAuthStep'
import { useQuickSetup } from '@/hooks/useQuickSetup'

type DialogStep = 'grid' | 'auth'

interface QuickSetupDialogProps {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigateToSource?: (sourceSlug: string) => void
  onManualSetup?: () => void
}

export function QuickSetupDialog({
  workspaceId,
  open,
  onOpenChange,
  onNavigateToSource,
  onManualSetup,
}: QuickSetupDialogProps) {
  const [dialogStep, setDialogStep] = useState<DialogStep>('grid')
  const sources = useAtomValue(sourcesAtom)
  const quickSetup = useQuickSetup(workspaceId)

  // Derive connected template IDs by matching source provider + service type
  // (Google services share provider 'google' — disambiguate by googleService field)
  const connectedTemplateIds = useMemo(() => {
    const connected: string[] = []
    for (const template of SOURCE_TEMPLATES) {
      const tp = template.sourceInput.provider
      const match = sources.find(s => {
        if (s.config.provider !== tp) return false
        // Disambiguate Google services by googleService field
        const tGoogle = template.sourceInput.api?.googleService
        if (tGoogle) return s.config.api?.googleService === tGoogle
        // Disambiguate Slack by slackService
        const tSlack = template.sourceInput.api?.slackService
        if (tSlack) return s.config.api?.slackService === tSlack
        // Disambiguate Microsoft by microsoftService
        const tMs = template.sourceInput.api?.microsoftService
        if (tMs) return s.config.api?.microsoftService === tMs
        return true
      })
      if (match) connected.push(template.id)
    }
    return connected
  }, [sources])

  const handleSelect = useCallback((template: SourceTemplate) => {
    quickSetup.reset()
    setDialogStep('auth')

    if (template.preAuthFields) {
      // Has pre-auth fields — show form first, create source on submit
      quickSetup.selectTemplate(template)
    } else if (template.authMethod === 'none') {
      // No auth — show folder picker first, create source on submit
      quickSetup.selectTemplate(template)
    } else if (template.authMethod === 'oauth') {
      // OAuth without pre-auth fields — create source immediately, show auth step
      quickSetup.startSetup(template)
    } else {
      // Bearer/API-key without pre-auth fields — create source immediately
      quickSetup.startSetup(template)
    }
  }, [quickSetup])

  const handleLocalFolder = useCallback(async (path: string) => {
    const template = quickSetup.template
    if (!template) return

    // Create source with the selected path
    const sourceInput = {
      ...template.sourceInput,
      name: path.split(/[\\/]/).pop() || 'Local Folder',
      local: { path },
    }

    // Override the template and start setup directly
    const modifiedTemplate = { ...template, sourceInput }
    quickSetup.reset()
    setDialogStep('auth')
    quickSetup.startSetup(modifiedTemplate)
  }, [quickSetup])

  const handleConnectedClick = useCallback((template: SourceTemplate) => {
    // Find the source matching this template (disambiguate services sharing a provider)
    const source = sources.find(s => {
      if (s.config.provider !== template.sourceInput.provider) return false
      const tGoogle = template.sourceInput.api?.googleService
      if (tGoogle) return s.config.api?.googleService === tGoogle
      const tSlack = template.sourceInput.api?.slackService
      if (tSlack) return s.config.api?.slackService === tSlack
      const tMs = template.sourceInput.api?.microsoftService
      if (tMs) return s.config.api?.microsoftService === tMs
      return true
    })
    if (source && onNavigateToSource) {
      onOpenChange(false)
      onNavigateToSource(source.config.slug)
    }
  }, [sources, onNavigateToSource, onOpenChange])

  const handleBack = useCallback(() => {
    quickSetup.reset()
    setDialogStep('grid')
  }, [quickSetup])

  const handleDone = useCallback(() => {
    onOpenChange(false)
    // Reset after close animation
    setTimeout(() => {
      quickSetup.reset()
      setDialogStep('grid')
    }, 200)
  }, [onOpenChange, quickSetup])

  const handleConnectAnother = useCallback(() => {
    quickSetup.reset()
    setDialogStep('grid')
  }, [quickSetup])

  const handleOAuthSubmit = useCallback(async (fieldValues?: Record<string, string>) => {
    const template = quickSetup.template
    if (!template) return

    if (template.preAuthFields && fieldValues) {
      // Create source with resolved field values, then start OAuth
      const slug = await quickSetup.startSetup(template, fieldValues)
      if (slug) quickSetup.performAuth(undefined, slug)
    } else {
      quickSetup.performAuth()
    }
  }, [quickSetup])

  const handleCredentialSubmit = useCallback(async (credential: string, fieldValues?: Record<string, string>) => {
    const template = quickSetup.template
    if (!template) return

    if (template.preAuthFields && fieldValues && !quickSetup.sourceSlug) {
      // Source not created yet — create with field values, then auth
      const slug = await quickSetup.startSetup(template, fieldValues)
      if (slug) quickSetup.performAuth(credential, slug)
    } else {
      quickSetup.performAuth(credential)
    }
  }, [quickSetup])

  // Reset on close
  const handleOpenChange = useCallback((newOpen: boolean) => {
    onOpenChange(newOpen)
    if (!newOpen) {
      setTimeout(() => {
        quickSetup.reset()
        setDialogStep('grid')
      }, 200)
    }
  }, [onOpenChange, quickSetup])

  const showBackButton = dialogStep === 'auth' && quickSetup.step !== 'creating' && quickSetup.step !== 'testing'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[820px] rounded-[14px] overflow-hidden p-8"
        showCloseButton
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            {showBackButton && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex size-7 items-center justify-center rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
                aria-label="Back to integrations"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <DialogTitle className="text-xl font-semibold">
              {dialogStep === 'grid' ? 'Quick Setup' : quickSetup.template?.name ?? 'Setup'}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Content with crossfade transition */}
        <div className="transition-all duration-250 ease-in-out">
          {dialogStep === 'grid' ? (
            <div className="animate-in fade-in duration-250">
              <SourceTemplateGrid
                templates={SOURCE_TEMPLATES}
                connectedSlugs={connectedTemplateIds}
                onSelect={handleSelect}
                onConnectedClick={handleConnectedClick}
              />
              {onManualSetup && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Need a different integration?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      handleDone()
                      // Small delay so dialog close animation completes before opening popover
                      setTimeout(onManualSetup, 250)
                    }}
                    className="text-accent hover:text-accent/80 underline"
                  >
                    Manual setup
                  </button>
                </p>
              )}
            </div>
          ) : quickSetup.template ? (
            <div className="animate-in fade-in duration-250" aria-live="polite">
              <QuickSetupAuthStep
                template={quickSetup.template}
                step={quickSetup.step}
                loading={quickSetup.loading}
                error={quickSetup.error}
                toolCount={quickSetup.toolCount}
                onSubmitOAuth={handleOAuthSubmit}
                onSubmitCredential={handleCredentialSubmit}
                onSubmitLocalFolder={handleLocalFolder}
                onRetry={quickSetup.retry}
                onDone={handleDone}
                onConnectAnother={handleConnectAnother}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
