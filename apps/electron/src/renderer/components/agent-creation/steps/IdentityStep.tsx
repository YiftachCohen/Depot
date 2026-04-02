/**
 * IdentityStep — Clean identity form for agent creation.
 *
 * Icon picker, name input, description, personality grid, advanced settings.
 * Template browsing is handled by TemplatePicker.
 */

import { useState, useMemo, useCallback, useId } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { resolveIconComponent } from '@/lib/command-icon'
import { IconPicker } from '../components/IconPicker'
import { PERSONALITY_PRESETS } from '../constants'
import type { PersonalityPreset } from '../constants'
import type { LoadedSkill } from '../../../../shared/types'

/** Strip newlines to prevent SKILL.md frontmatter injection. Does NOT trim — trimming on every keystroke eats trailing spaces. */
export function sanitize(s: string): string {
  return s.replace(/[\n\r]/g, ' ')
}

export function slugify(name: string): string {
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
  skills: LoadedSkill[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IdentityStep({ data, onChange, skills }: IdentityStepProps) {
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customPersonality, setCustomPersonality] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const nameId = useId()
  const descId = useId()

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
      {/* Agent identity card */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-thin space-y-5">
        {/* Icon + Name row */}
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setShowIconPicker(v => !v)}
              className={cn(
                'flex items-center justify-center h-14 w-14 rounded-xl transition-all cursor-pointer',
                'bg-amber-50 border-2 border-amber-200/60',
                'hover:border-amber-400 hover:shadow-thin',
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
