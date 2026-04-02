/**
 * TemplatePicker — template browser with AI-powered agent generation.
 *
 * Phase 1 of the agent creation flow. Users can:
 * 1. Type what they need and let AI generate a full agent config
 * 2. Browse templates by category and pick one
 * 3. Start from scratch with "Build Custom"
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Search, Plus, Check, Zap, Sparkles, Loader2, X } from 'lucide-react'
import { resolveIconComponent } from '@/lib/command-icon'
import { CATEGORY_COLORS, DEFAULT_CAT, PERSONALITY_PRESETS } from '../constants'
import type { AgentTemplate, DepotSkillManifest } from '../../../../shared/types'

type AIState = 'idle' | 'generating' | 'clarifying' | 'error'

interface GeneratedManifest {
  name: string
  icon: string
  description: string
  personality: string
  sources: string[]
  quick_commands: Array<{ name: string; prompt: string; icon?: string }>
}

interface TemplatePickerProps {
  templates: AgentTemplate[]
  onSelectTemplate: (template: AgentTemplate) => void
  onBuildCustom: (intentText?: string) => void
  onAIGenerated: (manifest: GeneratedManifest) => void
  selectedTemplateId: string | null
  llmAvailable: boolean
  workspaceSources: string[]
}

function scoreMatch(template: AgentTemplate, query: string): number {
  const q = query.toLowerCase()
  const name = template.manifest.name.toLowerCase()
  const desc = template.manifest.description.toLowerCase()
  const id = template.id.toLowerCase()
  const tags = template.tags?.map(t => t.toLowerCase()) ?? []

  let score = 0
  if (name.includes(q)) score += 10
  if (name.startsWith(q)) score += 5
  if (desc.includes(q)) score += 5
  if (id.includes(q)) score += 3
  if (tags.some(t => t.includes(q))) score += 7

  const words = q.split(/\s+/).filter(Boolean)
  for (const word of words) {
    if (name.includes(word)) score += 3
    if (desc.includes(word)) score += 2
    if (tags.some(t => t.includes(word))) score += 2
  }

  return score
}

export function TemplatePicker({
  templates,
  onSelectTemplate,
  onBuildCustom,
  onAIGenerated,
  selectedTemplateId,
  llmAvailable,
  workspaceSources,
}: TemplatePickerProps) {
  const [intent, setIntent] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [aiState, setAiState] = useState<AIState>('idle')
  const [aiError, setAiError] = useState<string | null>(null)
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([])
  const [clarifyingAnswers, setClarifyingAnswers] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Cleanup abort on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category))
    return Array.from(cats).sort()
  }, [templates])

  const filteredTemplates = useMemo(() => {
    let result = templates

    if (intent.trim()) {
      const scored = result.map(t => ({ t, score: scoreMatch(t, intent.trim()) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
      result = scored.map(({ t }) => t)
    }

    if (activeCategory) {
      result = result.filter(t => t.category === activeCategory)
    }

    return result
  }, [templates, intent, activeCategory])

  const handleGenerate = useCallback(async (answers?: Record<string, string>) => {
    const trimmed = intent.trim().slice(0, 500)
    if (!trimmed || !llmAvailable) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setAiState('generating')
    setAiError(null)

    try {
      const result = await window.electronAPI.generateAgentManifest({
        prompt: trimmed,
        workspaceSources,
        answers,
      })

      if (controller.signal.aborted) return

      if ('error' in result) {
        console.error('[AgentGeneration] LLM error:', result.error)
        if (result.error.includes('timeout') || result.error.includes('timed out')) {
          setAiError('Took too long. Try a simpler description or pick a template.')
        } else if (result.error.includes('rate_limit') || result.error.includes('429')) {
          setAiError('Too many requests. Wait a moment and try again.')
        } else if (result.error.includes('credentials') || result.error.includes('No LLM')) {
          setAiError('No AI connection configured. Go to Settings → AI to set one up.')
        } else {
          setAiError(`Couldn't generate an agent: ${result.error}`)
        }
        setAiState('error')
        return
      }

      // Check for clarifying questions
      if (result.clarifying_questions?.length && !answers) {
        setClarifyingQuestions(result.clarifying_questions)
        setClarifyingAnswers({})
        setAiState('clarifying')
        return
      }

      // Success — pass the generated manifest up
      onAIGenerated({
        name: result.name,
        icon: result.icon,
        description: result.description,
        personality: result.personality,
        sources: result.sources,
        quick_commands: result.quick_commands,
      })
      setAiState('idle')
    } catch {
      if (!controller.signal.aborted) {
        setAiError('Something went wrong. Try again or pick a template.')
        setAiState('error')
      }
    }
  }, [intent, llmAvailable, workspaceSources, onAIGenerated])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    setAiState('idle')
    setAiError(null)
    setClarifyingQuestions([])
  }, [])

  const handleSubmitAnswers = useCallback(() => {
    handleGenerate(clarifyingAnswers)
  }, [handleGenerate, clarifyingAnswers])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && intent.trim()) {
      e.preventDefault()
      if (llmAvailable) {
        handleGenerate()
      } else if (filteredTemplates.length > 0) {
        const best = filteredTemplates[0]
        if (best) onSelectTemplate(best)
      } else {
        onBuildCustom(intent.trim())
      }
    }
  }, [intent, llmAvailable, filteredTemplates, handleGenerate, onSelectTemplate, onBuildCustom])

  const hasResults = filteredTemplates.length > 0
  const showingSearchResults = intent.trim().length > 0
  const isGenerating = aiState === 'generating'

  return (
    <div className="flex flex-col h-full">
      {/* Prompt-first entry */}
      <div className="px-8 pt-6 pb-4">
        <div className="max-w-[720px] mx-auto">
          <h1 className="text-[28px] font-bold tracking-tight text-stone-900 font-[family-name:var(--font-display)] text-center mb-2">
            Who's joining the team?
          </h1>
          <p className="text-[15px] text-stone-500 text-center mb-6">
            {llmAvailable
              ? 'Describe what you need and AI will create your agent, or pick a template'
              : 'Describe what you need, or pick a template to get started'}
          </p>

          <div className="relative">
            {isGenerating ? (
              <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-amber-500 animate-spin" />
            ) : (
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
            )}
            <input
              ref={inputRef}
              type="text"
              placeholder={llmAvailable ? 'Describe the teammate you need...' : 'Search templates...'}
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              maxLength={500}
              className={cn(
                'w-full h-14 pl-12 pr-32 text-[17px] rounded-2xl',
                'bg-white border border-stone-200 shadow-thin',
                'placeholder:text-stone-400',
                'focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400',
                'transition-shadow font-[family-name:var(--font-display)]',
                'disabled:opacity-60',
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {isGenerating && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="h-8 px-3 text-xs font-medium rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors"
                >
                  Cancel
                </button>
              )}
              {!isGenerating && intent.trim() && llmAvailable && (
                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  className="h-8 px-4 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="h-3 w-3" />
                  Generate
                </button>
              )}
              {!isGenerating && intent.trim() && !llmAvailable && !hasResults && (
                <button
                  type="button"
                  onClick={() => onBuildCustom(intent.trim())}
                  className="h-8 px-4 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                >
                  Build Custom →
                </button>
              )}
              {!isGenerating && intent.trim() && !llmAvailable && hasResults && (
                <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                  <span className="px-1.5 py-0.5 rounded bg-stone-100 font-mono text-[10px]">↵</span>
                  <span>best match</span>
                </div>
              )}
            </div>
          </div>

          {/* AI generating state */}
          {isGenerating && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
              <Sparkles className="h-4 w-4" />
              Creating your agent...
            </div>
          )}

          {/* AI error state */}
          {aiState === 'error' && aiError && (
            <div className="mt-3 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200/60">
              <span className="text-xs text-red-700">{aiError}</span>
              <button
                type="button"
                onClick={() => handleGenerate()}
                className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Clarifying questions */}
          {aiState === 'clarifying' && clarifyingQuestions.length > 0 && (
            <div className="mt-4 space-y-3 p-4 rounded-xl bg-amber-50/50 border border-amber-200/40">
              <p className="text-xs font-medium text-amber-800">A few quick questions to get this right:</p>
              {clarifyingQuestions.map((q, i) => (
                <div key={i}>
                  <label className="text-xs font-medium text-stone-700 mb-1 block">{q}</label>
                  <input
                    type="text"
                    value={clarifyingAnswers[q] ?? ''}
                    onChange={(e) => setClarifyingAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                    className={cn(
                      'w-full h-9 px-3 text-sm rounded-lg',
                      'bg-white border border-stone-200',
                      'focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400',
                    )}
                    placeholder="Type your answer..."
                  />
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSubmitAnswers}
                  className="h-8 px-4 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="h-3 w-3" />
                  Generate Agent
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="h-8 px-3 text-xs font-medium text-stone-500 hover:text-stone-700 transition-colors"
                >
                  Skip questions
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category pills — hidden during AI generation */}
      {aiState === 'idle' && (
        <div className="px-8 pb-3">
          <div className="max-w-[720px] mx-auto flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={cn(
                'h-8 px-4 text-xs font-medium rounded-full whitespace-nowrap transition-all',
                !activeCategory
                  ? 'bg-amber-600 text-white'
                  : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300',
              )}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={cn(
                  'h-8 px-4 text-xs font-medium rounded-full whitespace-nowrap transition-all',
                  activeCategory === cat
                    ? 'bg-amber-600 text-white'
                    : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Template grid — hidden during AI generation/clarifying */}
      {(aiState === 'idle' || aiState === 'error') && (
        <div className="flex-1 overflow-y-auto px-8 pb-24">
          <div className="max-w-[720px] mx-auto">
            {showingSearchResults && hasResults && (
              <p className="text-xs font-medium text-stone-400 mb-3 uppercase tracking-wider">
                {filteredTemplates.length} matching template{filteredTemplates.length !== 1 ? 's' : ''}
              </p>
            )}

            {hasResults ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="listbox" aria-label="Agent templates">
                {/* Build Custom card */}
                <button
                  type="button"
                  onClick={() => onBuildCustom(intent.trim() || undefined)}
                  role="option"
                  aria-selected={false}
                  className={cn(
                    'flex flex-col rounded-xl border-2 border-dashed overflow-hidden text-left transition-all',
                    'border-amber-300/60 hover:border-amber-400 hover:shadow-thin',
                    'bg-gradient-to-b from-amber-50/50 to-stone-50',
                  )}
                >
                  <div className="px-4 pt-5 pb-3 flex-1">
                    <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-amber-100 border-2 border-dashed border-amber-300 mb-3">
                      <Plus className="h-5 w-5 text-amber-600" />
                    </div>
                    <p className="text-sm font-semibold text-stone-900 mb-1">Build Custom</p>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Start from scratch with full control
                    </p>
                  </div>
                  <div className="px-4 pb-4">
                    <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">Full customization</span>
                  </div>
                </button>

                {/* Template cards */}
                {filteredTemplates.map((template, index) => {
                  const TplIcon = resolveIconComponent(template.manifest.icon)
                  const isSelected = selectedTemplateId === template.id
                  const isBestMatch = showingSearchResults && index === 0
                  const cat = CATEGORY_COLORS[template.category] ?? DEFAULT_CAT
                  const personality = PERSONALITY_PRESETS.find(
                    p => p.value === template.manifest.personality,
                  )
                  const cmdCount = template.manifest.quick_commands?.length ?? 0

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => onSelectTemplate(template)}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        'flex flex-col rounded-xl border overflow-hidden text-left transition-all',
                        isSelected
                          ? 'border-amber-400 shadow-minimal ring-2 ring-amber-400/20'
                          : isBestMatch
                            ? 'border-amber-300 shadow-thin ring-1 ring-amber-200/40'
                            : 'border-stone-200/80 hover:border-stone-300 hover:shadow-thin',
                        'bg-white',
                      )}
                    >
                      <div className={cn('relative px-4 pt-4 pb-3', cat.bg)}>
                        {isSelected && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-amber-600 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        {isBestMatch && !isSelected && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 h-5 px-2 rounded-full bg-amber-600 text-white">
                            <Sparkles className="h-2.5 w-2.5" />
                            <span className="text-[9px] font-semibold uppercase tracking-wider">Best match</span>
                          </div>
                        )}
                        <div className={cn(
                          'flex items-center justify-center h-11 w-11 rounded-xl bg-white/80 backdrop-blur-sm shadow-thin mb-2',
                        )}>
                          <TplIcon className={cn('h-5 w-5', cat.icon)} />
                        </div>
                        <p className="text-sm font-semibold text-stone-900">{template.manifest.name}</p>
                      </div>

                      <div className="px-4 py-3 flex-1">
                        <p className="text-xs text-stone-500 leading-relaxed line-clamp-2 mb-3">
                          {template.manifest.description}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {template.manifest.sources?.slice(0, 3).map(src => (
                            <span key={src} className="inline-flex items-center h-5 px-2 text-[10px] font-medium rounded-full bg-stone-100 text-stone-500">
                              {src}
                            </span>
                          ))}
                          {cmdCount > 0 && (
                            <span className="inline-flex items-center gap-1 h-5 px-2 text-[10px] font-medium rounded-full bg-stone-100 text-stone-500">
                              <Zap className="h-2.5 w-2.5" />
                              {cmdCount} cmd{cmdCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="px-4 pb-3 pt-1 border-t border-stone-100">
                        {personality ? (
                          <div className="flex items-center gap-1.5">
                            <div className={cn('h-1.5 w-1.5 rounded-full', personality.iconBg.replace('bg-', 'bg-'))} />
                            <span className="text-[10px] text-stone-400 font-medium">{personality.label} personality</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-stone-400 font-medium">{template.category}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                {showingSearchResults ? (
                  <>
                    <p className="text-sm font-medium text-stone-500 mb-2">
                      No templates match "{intent}"
                    </p>
                    <p className="text-xs text-stone-400 mb-4">
                      {llmAvailable
                        ? 'Press Enter or click Generate to create a custom agent with AI'
                        : 'Build a custom agent from your description instead'}
                    </p>
                    <button
                      type="button"
                      onClick={() => llmAvailable ? handleGenerate() : onBuildCustom(intent.trim())}
                      className="h-10 px-6 text-sm font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center gap-2 mx-auto"
                    >
                      {llmAvailable && <Sparkles className="h-4 w-4" />}
                      {llmAvailable ? 'Generate with AI' : 'Build Custom Agent'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-stone-500 mb-2">
                      No templates available
                    </p>
                    <p className="text-xs text-stone-400 mb-4">
                      Build a custom agent from scratch
                    </p>
                    <button
                      type="button"
                      onClick={() => onBuildCustom()}
                      className="h-10 px-6 text-sm font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                    >
                      Build Custom Agent
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sticky bottom bar when template selected */}
      {selectedTemplateId && aiState === 'idle' && (
        <div className="absolute bottom-0 left-0 right-0 px-8 py-4 bg-gradient-to-t from-stone-50 via-stone-50 to-stone-50/0 pointer-events-none">
          <div className="max-w-[720px] mx-auto flex items-center justify-between pointer-events-auto">
            <p className="text-sm text-stone-600">
              Selected: <span className="font-semibold text-stone-900">
                {templates.find(t => t.id === selectedTemplateId)?.manifest.name}
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                const tpl = templates.find(t => t.id === selectedTemplateId)
                if (tpl) onSelectTemplate(tpl)
              }}
              className="h-11 px-8 text-sm font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 active:scale-[0.98] transition-all shadow-thin"
            >
              Customize & Create →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
