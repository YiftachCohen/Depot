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
}

export function QuickSetupDialog({
  workspaceId,
  open,
  onOpenChange,
  onNavigateToSource,
}: QuickSetupDialogProps) {
  const [dialogStep, setDialogStep] = useState<DialogStep>('grid')
  const sources = useAtomValue(sourcesAtom)
  const quickSetup = useQuickSetup(workspaceId)

  // Derive connected providers from existing sources
  const connectedProviders = useMemo(() =>
    sources.map(s => s.config.provider),
    [sources],
  )

  const handleSelect = useCallback((template: SourceTemplate) => {
    quickSetup.reset()
    setDialogStep('auth')

    if (template.authMethod === 'none' && template.id !== 'local-folder') {
      // No auth, no folder — just create
      quickSetup.startSetup(template)
    } else if (template.authMethod === 'none') {
      // Local folder — show auth step (which renders folder picker)
      // startSetup will be called after folder is picked
      quickSetup.startSetup(template) // Will transition to success since authMethod is 'none'
    } else if (!template.preAuthFields && template.authMethod === 'oauth') {
      // OAuth without pre-auth fields — create source immediately, show auth step
      quickSetup.startSetup(template)
    } else {
      // Bearer/API-key or has pre-auth fields — show auth step to collect input
      // Don't call startSetup yet — wait for credential submission
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
    // Find the source with this provider
    const source = sources.find(s => s.config.provider === template.sourceInput.provider)
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

  const handleOAuthSubmit = useCallback(() => {
    quickSetup.performAuth()
  }, [quickSetup])

  const handleCredentialSubmit = useCallback((credential: string, _fieldValues?: Record<string, string>) => {
    if (!quickSetup.template) return
    quickSetup.performAuth(credential)
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
        className="sm:max-w-[640px] rounded-[14px] overflow-hidden"
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
                connectedSlugs={connectedProviders}
                onSelect={handleSelect}
                onConnectedClick={handleConnectedClick}
              />
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Need a different integration?{' '}
                <button
                  type="button"
                  onClick={handleDone}
                  className="text-accent hover:text-accent/80 underline"
                >
                  Manual setup
                </button>
              </p>
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
