/**
 * IdentityStep — "Who's joining the team?"
 *
 * Apple setup assistant feel: big search prompt, visual template cards,
 * clean form with generous spacing. Personality is a key selectable feature.
 */

import { useState, useMemo, useCallback, useId, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  ChevronDown, ChevronUp, Search, Sparkles, Pencil,
  Briefcase, Heart, Target, Code2, BarChart3, Lightbulb,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { resolveIconComponent } from '@/lib/command-icon'
import { IconPicker } from '../components/IconPicker'
import type { AgentTemplate, LoadedSkill } from '../../../../shared/types'

/** Strip newlines to prevent SKILL.md frontmatter injection. Does NOT trim — trimming on every keystroke eats trailing spaces. */
function sanitize(s: string): string {
  return s.replace(/[\n\r]/g, ' ')
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export interface IdentityData {
  name: string
  slug: string
  icon: string
  description: string
  personality: string
  selectedTemplateId: string | null
  templateCategory: string | null
}

interface IdentityStepProps {
  data: IdentityData
  onChange: (data: IdentityData) => void
  templates: AgentTemplate[]
  skills: LoadedSkill[]
}

// ---------------------------------------------------------------------------
// Personality presets — selectable tone/style cards
// ---------------------------------------------------------------------------

interface PersonalityPreset {
  id: string
  label: string
  icon: React.FC<LucideProps>
  iconBg: string
  iconColor: string
  short: string
  value: string
}

const PERSONALITY_PRESETS: PersonalityPreset[] = [
  {
    id: 'professional',
    label: 'Professional',
    icon: Briefcase,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    short: 'Precise, thorough',
    value: 'Professional and thorough. Communicates clearly with well-structured responses. Provides evidence-based recommendations and always explains reasoning.',
  },
  {
    id: 'friendly',
    label: 'Friendly',
    icon: Heart,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-500',
    short: 'Warm, approachable',
    value: 'Friendly and approachable teammate. Explains things in plain language, asks clarifying questions, and celebrates wins. Encouraging but honest.',
  },
  {
    id: 'direct',
    label: 'Direct',
    icon: Target,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-500',
    short: 'Terse, no fluff',
    value: 'Extremely direct and concise. Leads with the answer, skips pleasantries. Uses bullet points and short sentences. Never restates the question.',
  },
  {
    id: 'senior-eng',
    label: 'Engineer',
    icon: Code2,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    short: 'Opinionated, code-first',
    value: 'Senior engineer who catches real bugs, not style nits. Direct, evidence-based, and always provides concrete fix suggestions with code examples.',
  },
  {
    id: 'analyst',
    label: 'Analyst',
    icon: BarChart3,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
    short: 'Data-driven',
    value: 'Analytical and structured. Breaks problems into components, quantifies when possible, and presents findings in tables or ranked lists. Always cites sources.',
  },
  {
    id: 'creative',
    label: 'Creative',
    icon: Lightbulb,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    short: 'Lateral thinker',
    value: 'Creative lateral thinker. Proposes unexpected approaches, connects dots across domains, and challenges assumptions. Balances wild ideas with practical execution.',
  },
]

// ---------------------------------------------------------------------------
// Category colors — every template category gets a color
// ---------------------------------------------------------------------------

type CatColor = { bg: string; bgSelected: string; icon: string; iconSelected: string; text: string }

const CATEGORY_COLORS: Record<string, CatColor> = {
  'Development':        { bg: 'bg-blue-50',    bgSelected: 'bg-blue-100',    icon: 'text-blue-500',    iconSelected: 'text-blue-700',    text: 'text-blue-900' },
  'Documentation':      { bg: 'bg-violet-50',  bgSelected: 'bg-violet-100',  icon: 'text-violet-500',  iconSelected: 'text-violet-700',  text: 'text-violet-900' },
  'Data & Analysis':    { bg: 'bg-emerald-50', bgSelected: 'bg-emerald-100', icon: 'text-emerald-500', iconSelected: 'text-emerald-700', text: 'text-emerald-900' },
  'Operations':         { bg: 'bg-orange-50',  bgSelected: 'bg-orange-100',  icon: 'text-orange-500',  iconSelected: 'text-orange-700',  text: 'text-orange-900' },
  'Security':           { bg: 'bg-red-50',     bgSelected: 'bg-red-100',     icon: 'text-red-500',     iconSelected: 'text-red-700',     text: 'text-red-900' },
  'DevOps':             { bg: 'bg-cyan-50',    bgSelected: 'bg-cyan-100',    icon: 'text-cyan-500',    iconSelected: 'text-cyan-700',    text: 'text-cyan-900' },
  'Project Management': { bg: 'bg-indigo-50',  bgSelected: 'bg-indigo-100',  icon: 'text-indigo-500',  iconSelected: 'text-indigo-700',  text: 'text-indigo-900' },
  'Product':            { bg: 'bg-fuchsia-50', bgSelected: 'bg-fuchsia-100', icon: 'text-fuchsia-500', iconSelected: 'text-fuchsia-700', text: 'text-fuchsia-900' },
  'Communication':      { bg: 'bg-sky-50',     bgSelected: 'bg-sky-100',     icon: 'text-sky-500',     iconSelected: 'text-sky-700',     text: 'text-sky-900' },
  'Customer & Support': { bg: 'bg-teal-50',    bgSelected: 'bg-teal-100',    icon: 'text-teal-500',    iconSelected: 'text-teal-700',    text: 'text-teal-900' },
  'Productivity':       { bg: 'bg-amber-50',   bgSelected: 'bg-amber-100',   icon: 'text-amber-500',   iconSelected: 'text-amber-700',   text: 'text-amber-900' },
  'Sales & Revenue':    { bg: 'bg-lime-50',    bgSelected: 'bg-lime-100',    icon: 'text-lime-600',    iconSelected: 'text-lime-700',    text: 'text-lime-900' },
  'Marketing':          { bg: 'bg-pink-50',    bgSelected: 'bg-pink-100',    icon: 'text-pink-500',    iconSelected: 'text-pink-700',    text: 'text-pink-900' },
  'HR & People':        { bg: 'bg-rose-50',    bgSelected: 'bg-rose-100',    icon: 'text-rose-500',    iconSelected: 'text-rose-700',    text: 'text-rose-900' },
}
const DEFAULT_CAT: CatColor = { bg: 'bg-stone-100', bgSelected: 'bg-amber-100', icon: 'text-stone-500', iconSelected: 'text-amber-700', text: 'text-stone-900' }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IdentityStep({ data, onChange, templates, skills }: IdentityStepProps) {
  const [intent, setIntent] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showAllTemplates, setShowAllTemplates] = useState(false)
  const [customPersonality, setCustomPersonality] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const nameId = useId()
  const descId = useId()
  const templateGridRef = useRef<HTMLDivElement>(null)

  const filteredTemplates = useMemo(() => {
    if (!intent.trim()) return templates
    const q = intent.trim().toLowerCase()
    return templates.filter(t =>
      t.manifest.name.toLowerCase().includes(q) ||
      t.manifest.description.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q)),
    )
  }, [templates, intent])

  const existingSlugs = useMemo(
    () => new Set(skills.map(s => s.slug)),
    [skills],
  )

  // Detect which preset matches the current personality (if any)
  const activePresetId = useMemo(() => {
    if (!data.personality || customPersonality) return null
    return PERSONALITY_PRESETS.find(p => p.value === data.personality)?.id ?? null
  }, [data.personality, customPersonality])

  const handleNameChange = useCallback((name: string) => {
    const sanitized = sanitize(name)
    const newSlug = !slugTouched ? slugify(sanitized) : data.slug
    onChange({ ...data, name: sanitized, slug: newSlug })
  }, [data, onChange, slugTouched])

  const handleSlugChange = useCallback((slug: string) => {
    const cleaned = slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSlugTouched(true)
    onChange({ ...data, slug: cleaned })
  }, [data, onChange])

  const validateSlug = useCallback(() => {
    if (existingSlugs.has(data.slug)) {
      setSlugError(`"${data.slug}" already exists. Try "${data.slug}-2"`)
    } else {
      setSlugError(null)
    }
  }, [data.slug, existingSlugs])

  const handleSelectTemplate = useCallback((template: AgentTemplate) => {
    onChange({
      ...data,
      name: template.manifest.name,
      slug: slugify(template.manifest.name),
      icon: template.manifest.icon,
      description: template.manifest.description,
      personality: template.manifest.personality ?? '',
      selectedTemplateId: template.id,
      templateCategory: template.category,
    })
    setSlugTouched(false)
    setCustomPersonality(false)
  }, [data, onChange])

  const handleSelectPreset = useCallback((preset: PersonalityPreset) => {
    setCustomPersonality(false)
    onChange({ ...data, personality: preset.value })
  }, [data, onChange])

  const handleCustomPersonality = useCallback(() => {
    setCustomPersonality(true)
  }, [])

  const IconComp = resolveIconComponent(data.icon)

  return (
    <div className="space-y-5">
      {/* Intent search — spotlight style */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-stone-400" />
        <input
          type="text"
          placeholder="What do you need help with?"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          autoFocus
          className={cn(
            'w-full h-12 pl-11 pr-4 text-[15px] rounded-2xl',
            'bg-white border border-stone-200 shadow-sm',
            'placeholder:text-stone-400',
            'focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400',
            'transition-shadow',
          )}
        />
      </div>

      {/* Template cards with category colors */}
      {filteredTemplates.length > 0 && (
        <div>
          <p className="text-xs font-medium text-stone-400 mb-3 uppercase tracking-wider">
            {intent.trim() ? 'Matching templates' : 'Start from a template'}
          </p>
          <div ref={templateGridRef} className="grid grid-cols-2 gap-2">
            {filteredTemplates.slice(0, showAllTemplates ? undefined : 4).map((template) => {
              const TplIcon = resolveIconComponent(template.manifest.icon)
              const isSelected = data.selectedTemplateId === template.id
              const cat = CATEGORY_COLORS[template.category] ?? DEFAULT_CAT
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all',
                    'border',
                    isSelected
                      ? 'border-amber-400 shadow-sm ring-1 ring-amber-400/20 bg-amber-50'
                      : 'bg-white border-stone-200/80 hover:border-stone-300 hover:shadow-sm',
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center h-9 w-9 rounded-lg shrink-0 transition-colors',
                    isSelected ? cat.bgSelected : cat.bg,
                  )}>
                    <TplIcon className={cn('h-4.5 w-4.5 transition-colors', isSelected ? cat.iconSelected : cat.icon)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[13px] font-medium truncate', isSelected ? cat.text : 'text-stone-700')}>
                      {template.manifest.name}
                    </p>
                    <p className="text-[11px] text-stone-400 truncate mt-0.5">
                      {template.manifest.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
          {filteredTemplates.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllTemplates(v => !v)}
              className="flex items-center justify-center gap-1.5 w-full mt-2 py-2 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors rounded-lg hover:bg-amber-50/50"
            >
              <Sparkles className="h-3 w-3" />
              {showAllTemplates
                ? 'Show fewer'
                : `Show all ${filteredTemplates.length} templates`}
            </button>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200/60" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 text-[11px] font-medium text-stone-400 bg-stone-50 uppercase tracking-wider">
            or customize
          </span>
        </div>
      </div>

      {/* Agent identity card */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm space-y-5">
        {/* Icon + Name row */}
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setShowIconPicker(v => !v)}
              className={cn(
                'flex items-center justify-center h-14 w-14 rounded-xl transition-all cursor-pointer',
                'bg-amber-50 border-2 border-amber-200/60',
                'hover:border-amber-400 hover:shadow-sm',
                'active:scale-95',
              )}
              title="Change icon"
            >
              <IconComp className="h-7 w-7 text-amber-700" />
            </button>
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <label htmlFor={nameId} className="text-xs font-medium text-stone-500 mb-1.5 block">
                Name
              </label>
              <input
                id={nameId}
                type="text"
                value={data.name}
                onChange={(e) => handleNameChange(e.target.value)}
                maxLength={60}
                className={cn(
                  'w-full h-10 px-3.5 text-[15px] font-medium rounded-xl',
                  'bg-stone-50/80 border border-stone-200/80',
                  'placeholder:text-stone-400',
                  'focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 focus:bg-white',
                  'transition-all',
                )}
                placeholder="e.g. PR Review Assistant"
              />
            </div>
          </div>
        </div>

        {/* Icon picker */}
        {showIconPicker && (
          <IconPicker
            value={data.icon}
            onChange={(icon) => {
              onChange({ ...data, icon })
              setShowIconPicker(false)
            }}
          />
        )}

        {/* Description */}
        <div>
          <label htmlFor={descId} className="text-xs font-medium text-stone-500 mb-1.5 block">
            Description
          </label>
          <textarea
            id={descId}
            value={data.description}
            onChange={(e) => onChange({ ...data, description: sanitize(e.target.value) })}
            rows={2}
            maxLength={200}
            className={cn(
              'w-full px-3.5 py-2.5 text-sm rounded-xl resize-none',
              'bg-stone-50/80 border border-stone-200/80',
              'placeholder:text-stone-400',
              'focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 focus:bg-white',
              'transition-all',
            )}
            placeholder="What does this agent do?"
          />
        </div>
      </div>

      {/* Personality picker — compact horizontal row */}
      <div>
        <p className="text-xs font-medium text-stone-400 mb-2.5 uppercase tracking-wider">
          Personality
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {PERSONALITY_PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id
            const PresetIcon = preset.icon
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-left',
                  'border',
                  isActive
                    ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400/20'
                    : 'bg-white border-stone-200/80 hover:border-stone-300',
                )}
              >
                <div className={cn('flex items-center justify-center h-6 w-6 rounded-md shrink-0', preset.iconBg)}>
                  <PresetIcon className={cn('h-3.5 w-3.5', preset.iconColor)} />
                </div>
                <div className="min-w-0">
                  <span className={cn(
                    'text-[11px] font-semibold block leading-tight truncate',
                    isActive ? 'text-amber-800' : 'text-stone-600',
                  )}>
                    {preset.label}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Custom personality toggle */}
        {customPersonality ? (
          <textarea
            value={data.personality}
            onChange={(e) => onChange({ ...data, personality: e.target.value })}
            rows={2}
            className={cn(
              'w-full mt-2 px-3.5 py-2.5 text-sm rounded-xl resize-none',
              'bg-white border border-stone-200/80',
              'placeholder:text-stone-400',
              'focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400',
            )}
            placeholder="Describe this agent's personality, tone, and expertise..."
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={handleCustomPersonality}
            className="flex items-center gap-1.5 mt-1.5 py-1 text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
          >
            <Pencil className="h-2.5 w-2.5" />
            Custom
          </button>
        )}
      </div>

      {/* Advanced section — slug only now */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Advanced settings
        </button>

        {showAdvanced && (
          <div className="mt-3 bg-white rounded-xl border border-stone-200/80 p-4">
            <label className="text-[11px] font-medium text-stone-400 mb-1 block">Slug (directory name)</label>
            <input
              type="text"
              value={data.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              onBlur={validateSlug}
              className={cn(
                'w-full h-8 px-3 text-xs font-mono rounded-lg',
                'bg-stone-50/80 border border-stone-200/80',
                'focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400',
                slugError && 'border-red-400',
              )}
              placeholder="agent-slug"
            />
            {slugError && <p className="text-[10px] text-red-500 mt-1">{slugError}</p>}
            {!slugError && data.slug && <p className="text-[10px] text-stone-400 mt-1">~/.depot/skills/{data.slug}/</p>}
          </div>
        )}
      </div>
    </div>
  )
}

export function isIdentityValid(data: IdentityData, existingSlugs: Set<string>): boolean {
  return data.name.trim().length > 0 &&
    data.name.length <= 60 &&
    data.description.trim().length > 0 &&
    data.description.length <= 200 &&
    data.slug.length > 0 &&
    !existingSlugs.has(data.slug)
}
