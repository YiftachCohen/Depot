/**
 * Shared constants for agent creation wizard.
 * Extracted so TemplatePicker, IdentityStep, and AgentPreviewCard can share them.
 */

import {
  Briefcase, Heart, Target, Code2, BarChart3, Lightbulb,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

// ---------------------------------------------------------------------------
// Personality presets
// ---------------------------------------------------------------------------

export interface PersonalityPreset {
  id: string
  label: string
  icon: React.FC<LucideProps>
  iconBg: string
  iconColor: string
  short: string
  value: string
}

export const PERSONALITY_PRESETS: PersonalityPreset[] = [
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

export type CatColor = { bg: string; bgSelected: string; icon: string; iconSelected: string; text: string }

export const CATEGORY_COLORS: Record<string, CatColor> = {
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

export const DEFAULT_CAT: CatColor = { bg: 'bg-stone-100', bgSelected: 'bg-amber-100', icon: 'text-stone-500', iconSelected: 'text-amber-700', text: 'text-stone-900' }
