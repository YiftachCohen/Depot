/**
 * StepIndicator — 3 labeled step dots, centered, with connecting lines.
 */

import { cn } from '@/lib/utils'

export type WizardStep = 'identity' | 'sources' | 'review'

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'identity', label: 'Identity' },
  { key: 'sources', label: 'Sources' },
  { key: 'review', label: 'Review' },
]

const stepIndex = (step: WizardStep) => STEPS.findIndex(s => s.key === step)

interface StepIndicatorProps {
  currentStep: WizardStep
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const current = stepIndex(currentStep)

  return (
    <div className="flex items-center gap-1" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={3}>
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          {/* Dot + label */}
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'h-2 w-2 rounded-full transition-all duration-300',
                i < current && 'bg-amber-500',
                i === current && 'bg-amber-600 ring-4 ring-amber-100',
                i > current && 'bg-stone-300',
              )}
            />
            <span
              className={cn(
                'text-[11px] font-medium transition-colors duration-300',
                i <= current ? 'text-stone-600' : 'text-stone-400',
              )}
            >
              {step.label}
            </span>
          </div>

          {/* Connector */}
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'h-px w-5 mx-1 transition-colors duration-300',
                i < current ? 'bg-amber-400' : 'bg-stone-200',
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
