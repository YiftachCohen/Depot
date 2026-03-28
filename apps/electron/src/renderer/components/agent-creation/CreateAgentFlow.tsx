/**
 * CreateAgentFlow — fullscreen 3-step agent creation wizard.
 *
 * Apple setup assistant aesthetics: big centered title, warm background,
 * generous spacing, clear visual hierarchy.
 */

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowLeft, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { StepIndicator, type WizardStep } from './components/StepIndicator'
import { IdentityStep, isIdentityValid, type IdentityData } from './steps/IdentityStep'
import { SourcesStep } from './steps/SourcesStep'
import { ReviewStep } from './steps/ReviewStep'
import { useCommandTemplates } from './hooks/useCommandTemplates'

import type {
  AgentTemplate,
  LoadedSkill,
  LoadedSource,
  DepotSkillManifest,
  QuickCommand,
} from '../../../shared/types'

// DESIGN.md motion values
const TRANSITION_ENTER = { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }
const TRANSITION_EXIT = { duration: 0.2, ease: 'easeIn' as const }

const STEP_COPY: Record<WizardStep, { title: string; subtitle: string }> = {
  identity: { title: "Who's joining the team?", subtitle: 'Give your new agent a name and role' },
  sources: { title: 'What data should they access?', subtitle: 'Connect the tools and services your agent needs' },
  review: { title: 'Meet your new agent', subtitle: 'Review and customize before adding to the team' },
}

const STEPS: WizardStep[] = ['identity', 'sources', 'review']

interface CreateAgentFlowProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  skills: LoadedSkill[]
  sources: LoadedSource[]
  templates: AgentTemplate[]
  onCreateFromTemplate: (templateId: string, overrides?: Partial<DepotSkillManifest> & { slug?: string }) => Promise<void>
  onCreateFromScratch: (slug: string, name: string, description: string) => Promise<string>
  onPromoteToAgent: (workspaceId: string, slug: string, manifest: DepotSkillManifest) => Promise<void>
  onCreated?: () => void
}

export function CreateAgentFlow({
  open,
  onOpenChange,
  workspaceId,
  skills,
  sources,
  templates,
  onCreateFromTemplate,
  onCreateFromScratch,
  onPromoteToAgent,
  onCreated,
}: CreateAgentFlowProps) {
  const [step, setStep] = useState<WizardStep>('identity')
  const [direction, setDirection] = useState<1 | -1>(1)
  const [creating, setCreating] = useState(false)

  const [identity, setIdentity] = useState<IdentityData>({
    name: '',
    slug: '',
    icon: 'bot',
    description: '',
    personality: '',
    selectedTemplateId: null,
    templateCategory: null,
  })

  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [commands, setCommands] = useState<QuickCommand[]>([])
  const [permissionMode, setPermissionMode] = useState<'safe' | 'ask' | 'allow-all'>('ask')
  const [memoryEnabled, setMemoryEnabled] = useState(true)

  const existingSlugs = useMemo(() => new Set(skills.map(s => s.slug)), [skills])
  const selectedSourceSlugs = useMemo(() => Array.from(selectedSources), [selectedSources])
  const selectedTemplate = identity.selectedTemplateId
    ? templates.find(t => t.id === identity.selectedTemplateId) ?? null
    : null

  const autoCommands = useCommandTemplates(
    selectedSourceSlugs,
    selectedTemplate?.manifest.quick_commands,
  )

  const isModified = identity.name.length > 0 || selectedSources.size > 0

  const canAdvance = (s: WizardStep): boolean => {
    if (s === 'identity') return isIdentityValid(identity, existingSlugs)
    if (s === 'sources') return true
    return false
  }

  const goForward = useCallback(() => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) {
      setDirection(1)
      const nextStep = STEPS[idx + 1]!
      if (nextStep === 'review' && commands.length === 0) {
        setCommands(autoCommands.length > 0 ? autoCommands : [])
      }
      setStep(nextStep)
    }
  }, [step, commands.length, autoCommands])

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) {
      setDirection(-1)
      setStep(STEPS[idx - 1]!)
    }
  }, [step])

  const handleClose = useCallback(() => {
    if (isModified && !creating) {
      if (!window.confirm('Discard this agent?')) return
    }
    onOpenChange(false)
  }, [isModified, creating, onOpenChange])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setStep('identity')
      setDirection(1)
      setIdentity({ name: '', slug: '', icon: 'bot', description: '', personality: '', selectedTemplateId: null, templateCategory: null })
      setSelectedSources(new Set())
      setCommands([])
      setPermissionMode('ask')
      setMemoryEnabled(true)
      setCreating(false)
    }
    onOpenChange(nextOpen)
  }, [onOpenChange])

  const handleToggleSource = useCallback((slug: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }, [])

  const handleCreateAgent = useCallback(async () => {
    if (creating) return
    setCreating(true)

    try {
      const manifest: DepotSkillManifest = {
        name: identity.name,
        icon: identity.icon,
        description: identity.description,
        sources: selectedSourceSlugs,
        quick_commands: commands.length > 0 ? commands : [{ name: 'Chat', prompt: 'Hello!', icon: 'message-square' }],
        ...(identity.personality ? { personality: identity.personality } : {}),
        ...(permissionMode !== 'ask' ? { permission_mode: permissionMode } : {}),
        ...(memoryEnabled ? { memory: { enabled: true } } : {}),
      }

      if (selectedTemplate) {
        const overrides: Partial<DepotSkillManifest> & { slug?: string } = {}
        if (identity.slug !== selectedTemplate.id) overrides.slug = identity.slug
        if (identity.name !== selectedTemplate.manifest.name) overrides.name = identity.name
        if (identity.description !== selectedTemplate.manifest.description) overrides.description = identity.description
        if (identity.icon !== selectedTemplate.manifest.icon) overrides.icon = identity.icon
        if (identity.personality) overrides.personality = identity.personality
        if (selectedSourceSlugs.length > 0) overrides.sources = selectedSourceSlugs
        if (commands.length > 0) overrides.quick_commands = commands

        await onCreateFromTemplate(
          selectedTemplate.id,
          Object.keys(overrides).length > 0 ? overrides : undefined,
        )
      } else {
        try {
          await onCreateFromScratch(identity.slug, identity.name, identity.description)
          await onPromoteToAgent(workspaceId, identity.slug, manifest)
        } catch (promoteErr) {
          console.error('Failed to promote skill to agent:', promoteErr)
          throw promoteErr
        }
      }

      toast.success(`Agent "${identity.name}" created`, {
        action: {
          label: 'Start a session',
          onClick: () => {},
        },
      })
      onCreated?.()
      handleOpenChange(false)
    } catch (err) {
      console.error('Failed to create agent:', err)
      toast.error(`Failed to create agent: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setCreating(false)
    }
  }, [
    creating, identity, selectedSourceSlugs, commands, selectedTemplate,
    permissionMode, memoryEnabled, workspaceId,
    onCreateFromTemplate, onCreateFromScratch, onPromoteToAgent,
    onCreated, handleOpenChange,
  ])

  const stepIdx = STEPS.indexOf(step)
  const { title, subtitle } = STEP_COPY[step]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="!fixed !inset-0 !top-[38px] !translate-x-0 !translate-y-0 !max-w-none !w-full !h-[calc(100vh-38px)] !rounded-none !border-0 !p-0 !gap-0 flex flex-col bg-stone-50"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Minimal top bar with back/close + step dots */}
        <div className="shrink-0 px-5 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={stepIdx > 0 ? goBack : handleClose}
            className="p-2 -ml-2 rounded-lg hover:bg-stone-200/60 transition-colors"
            aria-label={stepIdx > 0 ? 'Back' : 'Close'}
          >
            {stepIdx > 0
              ? <ArrowLeft className="h-4 w-4 text-stone-500" />
              : <X className="h-4 w-4 text-stone-500" />}
          </button>

          <StepIndicator currentStep={step} />

          {/* Spacer to balance layout */}
          <div className="w-8" />
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-[560px] mx-auto px-6 pt-2 pb-32">
            {/* Hero title — centered, big, warm */}
            <div className="text-center mb-5">
              <h1 className="text-[28px] font-bold tracking-tight text-stone-900 font-[family-name:var(--font-display)]">
                {title}
              </h1>
              <p className="text-[15px] text-stone-500 mt-2">
                {subtitle}
              </p>
            </div>

            {/* Announce step changes for screen readers */}
            <div aria-live="polite" className="sr-only">
              {title}
            </div>

            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                initial={{ opacity: 0, y: direction > 0 ? 16 : -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: direction > 0 ? -8 : 8 }}
                transition={TRANSITION_ENTER}
              >
                {step === 'identity' && (
                  <IdentityStep
                    data={identity}
                    onChange={setIdentity}
                    templates={templates}
                    skills={skills}
                  />
                )}

                {step === 'sources' && (
                  <SourcesStep
                    workspaceId={workspaceId}
                    sources={sources}
                    templateCategory={identity.templateCategory}
                    agentName={identity.name}
                    agentDescription={identity.description}
                    selectedSlugs={selectedSources}
                    onToggleSource={handleToggleSource}
                    onSourceImported={() => {}}
                  />
                )}

                {step === 'review' && (
                  <ReviewStep
                    name={identity.name}
                    description={identity.description}
                    icon={identity.icon}
                    sourceSlugs={selectedSourceSlugs}
                    sources={sources}
                    commands={commands}
                    onCommandsChange={setCommands}
                    permissionMode={permissionMode}
                    onPermissionModeChange={setPermissionMode}
                    memoryEnabled={memoryEnabled}
                    onMemoryEnabledChange={setMemoryEnabled}
                    creating={creating}
                    onCreateAgent={handleCreateAgent}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Sticky bottom bar — identity + sources only */}
        {step !== 'review' && (
          <div className="absolute bottom-0 left-0 right-0 px-6 py-5 bg-gradient-to-t from-stone-50 via-stone-50 to-stone-50/0 pointer-events-none">
            <div className="max-w-[560px] mx-auto flex justify-end pointer-events-auto">
              <button
                type="button"
                onClick={goForward}
                disabled={!canAdvance(step)}
                className={cn(
                  'h-11 px-8 text-sm font-semibold rounded-xl transition-all',
                  'bg-amber-600 text-white shadow-sm',
                  'hover:bg-amber-700 hover:shadow-md',
                  'active:scale-[0.98]',
                  'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
                )}
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
