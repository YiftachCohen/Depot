/**
 * TemplateVariableModal
 *
 * Shows a dialog when a Quick Command has template variables ({{var}}).
 * Renders appropriate input controls based on variable type and resolves
 * the prompt template before triggering session creation.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRegisterModal } from '@/context/ModalContext'
import type { QuickCommandVariable } from '@depot/shared/skills/types'

export interface TemplateVariableModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback to change open state */
  onOpenChange: (open: boolean) => void
  /** Display name for the quick command */
  commandName: string
  /** Prompt template with {{variable}} placeholders */
  promptTemplate: string
  /** Variable definitions for the template */
  variables: QuickCommandVariable[]
  /** Called with the resolved prompt when user submits */
  onSubmit: (resolvedPrompt: string) => void
}

/**
 * Resolve a prompt template by replacing {{variable}} placeholders with values.
 */
function resolvePromptTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    return values[name] ?? match
  })
}

export function TemplateVariableModal({
  open,
  onOpenChange,
  commandName,
  promptTemplate,
  variables,
  onSubmit,
}: TemplateVariableModalProps) {
  // Initialize values with defaults
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const v of variables) {
      if (v.default) {
        initial[v.name] = v.default
      } else if (v.type === 'select' && v.options && v.options.length > 0) {
        initial[v.name] = v.options[0]!
      } else {
        initial[v.name] = ''
      }
    }
    return initial
  })

  const firstInputRef = useRef<HTMLInputElement>(null)

  // Register with modal context so X button / Cmd+W closes this dialog first
  useRegisterModal(open, () => onOpenChange(false))

  // Reset values when modal opens with new variables
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {}
      for (const v of variables) {
        if (v.default) {
          initial[v.name] = v.default
        } else if (v.type === 'select' && v.options && v.options.length > 0) {
          initial[v.name] = v.options[0]!
        } else {
          initial[v.name] = ''
        }
      }
      setValues(initial)

      // Focus first input after dialog opens
      const timer = setTimeout(() => {
        firstInputRef.current?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [open, variables])

  const updateValue = useCallback((name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = useCallback(() => {
    const resolved = resolvePromptTemplate(promptTemplate, values)
    onSubmit(resolved)
    onOpenChange(false)
  }, [promptTemplate, values, onSubmit, onOpenChange])

  // Check if all required fields have values
  const isValid = variables.every(v => {
    const val = values[v.name]
    if (v.type === 'number') {
      return val !== undefined && val !== ''
    }
    return val !== undefined && val.trim() !== ''
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{commandName}</DialogTitle>
          <DialogDescription>
            Fill in the values below to configure this command.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          {variables.map((variable, index) => (
            <div key={variable.name} className="flex flex-col gap-1.5">
              <label
                htmlFor={`var-${variable.name}`}
                className="text-sm font-medium text-foreground"
              >
                {variable.label}
              </label>

              {variable.type === 'text' && (
                <Input
                  id={`var-${variable.name}`}
                  ref={index === 0 ? firstInputRef : undefined}
                  value={values[variable.name] ?? ''}
                  onChange={(e) => updateValue(variable.name, e.target.value)}
                  placeholder={variable.placeholder ?? ''}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isValid) {
                      handleSubmit()
                    }
                  }}
                />
              )}

              {variable.type === 'number' && (
                <Input
                  id={`var-${variable.name}`}
                  ref={index === 0 ? firstInputRef : undefined}
                  type="number"
                  value={values[variable.name] ?? ''}
                  onChange={(e) => updateValue(variable.name, e.target.value)}
                  placeholder={variable.placeholder ?? ''}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isValid) {
                      handleSubmit()
                    }
                  }}
                />
              )}

              {variable.type === 'select' && variable.options && (
                <Select
                  value={values[variable.name] ?? ''}
                  onValueChange={(val) => updateValue(variable.name, val)}
                >
                  <SelectTrigger id={`var-${variable.name}`}>
                    <SelectValue placeholder={variable.placeholder ?? 'Select an option'} />
                  </SelectTrigger>
                  <SelectContent>
                    {variable.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Run Command
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
