/**
 * CreateAgentFlow — 2-phase agent creation: Template Picker → Split-Panel Builder.
 *
 * Phase 1: Full-screen template browser with prompt-first entry.
 * Phase 2: Split-panel builder (left: tabs for identity/sources/commands, right: live preview).
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowLeft, X, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { TemplatePicker } from './steps/TemplatePicker'
import { IdentityStep, isIdentityValid, type IdentityData } from './steps/IdentityStep'
import { SourcesStep } from './steps/SourcesStep'
import { AgentPreviewCard } from './components/AgentPreviewCard'
import { CommandEditor } from './components/CommandEditor'
import { useCommandTemplates } from './hooks/useCommandTemplates'
import { slugify } from './steps/IdentityStep'

import type {
  AgentTemplate,
  LoadedSkill,
  LoadedSource,
  DepotSkillManifest,
  QuickCommand,
} from '../../../shared/types'

// DESIGN.md motion values
const TRANSITION_ENTER = { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }

type Phase = 'pick' | 'build'
type BuildTab = 'identity' | 'sources' | 'commands'

const TAB_LABELS: { key: BuildTab; label: string }[] = [
  { key: 'identity', label: 'Identity' },
  { key: 'sources', label: 'Sources' },
  { key: 'commands', label: 'Commands' },
]

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
  const [phase, setPhase] = useState<Phase>('pick')
  const [activeTab, setActiveTab] = useState<BuildTab>('identity')
  const [creating, setCreating] = useState(false)
  const [commandsUserEdited, setCommandsUserEdited] = useState(false)
  const [llmAvailable, setLlmAvailable] = useState(false)

  // Check LLM availability on mount
  useEffect(() => {
    if (open) {
      window.electronAPI.checkLlmAvailable().then(
        (result) => setLlmAvailable(result.available),
      ).catch(() => setLlmAvailable(false))
    }
  }, [open])

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
  const [showAdvanced, setShowAdvanced] = useState(false)

  const existingSlugs = useMemo(() => new Set(skills.map(s => s.slug)), [skills])
  const selectedSourceSlugs = useMemo(() => Array.from(selectedSources), [selectedSources])
  const selectedTemplate = identity.selectedTemplateId
    ? templates.find(t => t.id === identity.selectedTemplateId) ?? null
    : null

  const autoCommands = useCommandTemplates(
    selectedSourceSlugs,
    selectedTemplate?.manifest.quick_commands,
  )

  // Auto-regenerate commands when sources change and commands haven't been user-edited
  const prevSourcesRef = useRef(selectedSourceSlugs)
  useEffect(() => {
    const sourcesChanged = JSON.stringify(prevSourcesRef.current) !== JSON.stringify(selectedSourceSlugs)
    if (sourcesChanged && !commandsUserEdited && autoCommands.length > 0) {
      setCommands(autoCommands)
    }
    prevSourcesRef.current = selectedSourceSlugs
  }, [selectedSourceSlugs, autoCommands, commandsUserEdited])

  const isModified = identity.name.length > 0 || selectedSources.size > 0

  // Count sources needing auth
  const needsAuthCount = selectedSourceSlugs.filter(slug => {
    const source = sources.find(s => s.config.name === slug)
    return source?.config.connectionStatus === 'needs_auth'
  }).length

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const resetState = useCallback(() => {
    setPhase('pick')
    setActiveTab('identity')
    setIdentity({ name: '', slug: '', icon: 'bot', description: '', personality: '', selectedTemplateId: null, templateCategory: null })
    setSelectedSources(new Set())
    setCommands([])
    setPermissionMode('ask')
    setMemoryEnabled(true)
    setCreating(false)
    setCommandsUserEdited(false)
    setShowAdvanced(false)
  }, [])

  const handleClose = useCallback(() => {
    if (isModified && !creating) {
      if (!window.confirm('Discard this agent?')) return
    }
    onOpenChange(false)
  }, [isModified, creating, onOpenChange])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) resetState()
    onOpenChange(nextOpen)
  }, [onOpenChange, resetState])

  const handleSelectTemplate = useCallback((template: AgentTemplate) => {
    setIdentity({
      name: template.manifest.name,
      slug: slugify(template.manifest.name),
      icon: template.manifest.icon,
      description: template.manifest.description,
      personality: template.manifest.personality ?? '',
      selectedTemplateId: template.id,
      templateCategory: template.category,
    })
    // Pre-fill commands from template
    if (template.manifest.quick_commands?.length) {
      setCommands(template.manifest.quick_commands)
    }
    setCommandsUserEdited(false)
    setPhase('build')
    setActiveTab('identity')
  }, [])

  const handleBuildCustom = useCallback((intentText?: string) => {
    if (intentText) {
      // Auto-generate name from first few words
      const words = intentText.split(/\s+/).slice(0, 4).join(' ')
      const name = words.charAt(0).toUpperCase() + words.slice(1)
      setIdentity(prev => ({
        ...prev,
        name,
        slug: slugify(name),
        description: intentText,
      }))
    }
    setPhase('build')
    setActiveTab('identity')
  }, [])

  const handleAIGenerated = useCallback((manifest: {
    name: string; icon: string; description: string; personality: string;
    sources: string[]; quick_commands: Array<{ name: string; prompt: string; icon?: string }>;
  }) => {
    setIdentity({
      name: manifest.name,
      slug: slugify(manifest.name),
      icon: manifest.icon,
      description: manifest.description,
      personality: manifest.personality,
      selectedTemplateId: null,
      templateCategory: null,
    })
    // Pre-fill sources
    setSelectedSources(new Set(manifest.sources))
    // Pre-fill commands
    if (manifest.quick_commands.length > 0) {
      setCommands(manifest.quick_commands)
    }
    setCommandsUserEdited(false)
    setPhase('build')
    setActiveTab('identity')
  }, [])

  const handleBack = useCallback(() => {
    if (phase === 'build') {
      setPhase('pick')
    } else {
      handleClose()
    }
  }, [phase, handleClose])

  const handleToggleSource = useCallback((slug: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }, [])

  const handleCommandsChange = useCallback((cmds: QuickCommand[]) => {
    setCommands(cmds)
    setCommandsUserEdited(true)
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
        await onCreateFromScratch(identity.slug, identity.name, identity.description)
        await onPromoteToAgent(workspaceId, identity.slug, manifest)
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="!max-w-[960px] !w-[calc(100%-2rem)] !h-[min(720px,calc(100vh-100px))] !rounded-[14px] !border !border-stone-200/60 !p-0 !gap-0 flex flex-col bg-stone-50 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Top bar */}
        <div className="shrink-0 px-5 py-3 flex items-center justify-between border-b border-stone-200/60">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 -ml-2 rounded-lg hover:bg-stone-200/60 transition-colors"
            aria-label={phase === 'build' ? 'Back to templates' : 'Close'}
          >
            {phase === 'build'
              ? <ArrowLeft className="h-4 w-4 text-stone-500" />
              : <X className="h-4 w-4 text-stone-500" />}
          </button>

          <span className="text-sm font-semibold text-stone-700">
            {phase === 'pick' ? 'New Agent' : 'Build your agent'}
          </span>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 -mr-2 rounded-lg hover:bg-stone-200/60 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-stone-500" />
          </button>
        </div>

        {/* Announce phase changes for screen readers */}
        <div aria-live="polite" className="sr-only">
          {phase === 'pick' ? 'Choose a template or describe what you need' : 'Configure your agent'}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait" initial={false}>
          {phase === 'pick' ? (
            <motion.div
              key="pick"
              className="flex-1 min-h-0 overflow-hidden"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={TRANSITION_ENTER}
            >
              <TemplatePicker
                templates={templates}
                onSelectTemplate={handleSelectTemplate}
                onBuildCustom={handleBuildCustom}
                onAIGenerated={handleAIGenerated}
                selectedTemplateId={identity.selectedTemplateId}
                llmAvailable={llmAvailable}
                workspaceSources={sources.map(s => s.config.name)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="build"
              className="flex-1 min-h-0 flex"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={TRANSITION_ENTER}
            >
              {/* Left panel: builder tabs */}
              <div className="flex-1 min-w-0 flex flex-col border-r border-stone-200/60">
                {/* Tab bar */}
                <div className="shrink-0 flex border-b border-stone-200/60" role="tablist">
                  {TAB_LABELS.map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'flex-1 py-2.5 text-xs font-medium transition-all text-center',
                        activeTab === tab.key
                          ? 'text-amber-700 border-b-2 border-amber-500 bg-amber-50/30'
                          : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100/50',
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 min-h-0 overflow-y-auto" role="tabpanel">
                  <div className="max-w-[520px] mx-auto px-6 py-6">
                    {activeTab === 'identity' && (
                      <IdentityStep
                        data={identity}
                        onChange={setIdentity}
                        skills={skills}
                      />
                    )}

                    {activeTab === 'sources' && (
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

                    {activeTab === 'commands' && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-xs font-semibold text-stone-700 mb-3 uppercase tracking-wider">
                            Quick Commands
                          </h3>
                          <CommandEditor commands={commands} onChange={handleCommandsChange} />
                        </div>

                        {/* Advanced settings — collapsed by default */}
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowAdvanced(v => !v)}
                            className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
                          >
                            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            Advanced Settings
                          </button>

                          {showAdvanced && (
                            <div className="mt-3 space-y-3 pl-4 border-l-2 border-stone-200/30">
                              {/* Permission Mode */}
                              <div>
                                <label className="text-[10px] text-stone-400 mb-1.5 block">Permission Mode</label>
                                <div className="flex items-center gap-2">
                                  {(['safe', 'ask', 'allow-all'] as const).map((mode) => (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={() => setPermissionMode(mode)}
                                      className={cn(
                                        'h-7 px-3 text-xs font-medium rounded-full transition-colors',
                                        permissionMode === mode
                                          ? 'bg-stone-800 text-white'
                                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200',
                                      )}
                                    >
                                      {mode}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Memory */}
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] text-stone-400">Cross-session memory</label>
                                <button
                                  type="button"
                                  onClick={() => setMemoryEnabled(!memoryEnabled)}
                                  className={cn(
                                    'h-5 w-9 rounded-full transition-colors relative',
                                    memoryEnabled ? 'bg-amber-600' : 'bg-stone-300',
                                  )}
                                >
                                  <div className={cn(
                                    'h-4 w-4 rounded-full bg-white absolute top-0.5 transition-transform',
                                    memoryEnabled ? 'translate-x-4' : 'translate-x-0.5',
                                  )} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right panel: live preview */}
              <div className="w-[320px] shrink-0 bg-stone-100/50 flex flex-col p-4 max-lg:hidden">
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Live Preview</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">How this agent appears on your dashboard</p>
                </div>

                <div className="flex-1 min-h-0">
                  <AgentPreviewCard
                    name={identity.name}
                    description={identity.description}
                    icon={identity.icon}
                    personality={identity.personality}
                    templateCategory={identity.templateCategory}
                    sourceSlugs={selectedSourceSlugs}
                    commands={commands}
                    needsAuthCount={needsAuthCount}
                    creating={creating}
                    onCreateAgent={handleCreateAgent}
                  />
                </div>
              </div>

              {/* Mobile create button (when preview is hidden) */}
              <div className="hidden max-lg:flex absolute bottom-0 left-0 right-0 px-6 py-4 bg-gradient-to-t from-stone-50 via-stone-50 to-stone-50/0 pointer-events-none">
                <div className="w-full pointer-events-auto">
                  <button
                    type="button"
                    onClick={handleCreateAgent}
                    disabled={creating || !identity.name.trim() || commands.length === 0}
                    className={cn(
                      'w-full h-11 rounded-xl text-sm font-semibold transition-all',
                      'bg-amber-600 text-white hover:bg-amber-700',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {creating ? 'Creating...' : 'Create Agent'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
