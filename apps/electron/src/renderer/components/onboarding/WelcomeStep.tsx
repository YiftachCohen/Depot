import { useState, useCallback, useEffect } from "react"
import { CraftAgentsSymbol } from "@/components/icons/CraftAgentsSymbol"
import { Input } from "@/components/ui/input"
import { StepFormLayout, ContinueButton } from "./primitives"

interface WelcomeStepProps {
  onContinue: () => void
  /** Whether this is an existing user updating settings */
  isExistingUser?: boolean
  /** Whether the app is loading (e.g., checking Git Bash on Windows) */
  isLoading?: boolean
}

/**
 * WelcomeStep - Initial welcome screen for onboarding
 *
 * Shows different messaging for new vs existing users:
 * - New users: Welcome to Depot Agents (with name input)
 * - Existing users: Update your API connection settings
 */
export function WelcomeStep({
  onContinue,
  isExistingUser = false,
  isLoading = false
}: WelcomeStepProps) {
  const [name, setName] = useState('')

  // Load existing name from preferences
  useEffect(() => {
    window.electronAPI.readPreferences().then((result) => {
      try {
        const prefs = JSON.parse(result.content)
        if (prefs.name) setName(prefs.name)
      } catch { /* ignore */ }
    }).catch(() => { /* ignore */ })
  }, [])

  const handleContinue = useCallback(async () => {
    // Save name to preferences before continuing
    if (name.trim()) {
      try {
        const result = await window.electronAPI.readPreferences()
        let prefs: Record<string, unknown> = {}
        try { prefs = JSON.parse(result.content) } catch { /* start fresh */ }
        prefs.name = name.trim()
        prefs.updatedAt = Date.now()
        await window.electronAPI.writePreferences(JSON.stringify(prefs, null, 2))
      } catch {
        // Don't block onboarding if save fails
      }
    }
    onContinue()
  }, [name, onContinue])

  return (
    <StepFormLayout
      iconElement={
        <div className="flex size-16 items-center justify-center">
          <CraftAgentsSymbol className="size-10 text-accent" />
        </div>
      }
      title={isExistingUser ? 'Update Settings' : 'Welcome to Depot'}
      description={
        isExistingUser
          ? 'Update your API connection or change your setup.'
          : 'Agents with the UX they deserve. Connect anything. Organize your sessions. Everything you need to do the work of your life!'
      }
      actions={
        <ContinueButton onClick={handleContinue} className="w-full" loading={isLoading} loadingText="Checking...">
          {isExistingUser ? 'Continue' : 'Get Started'}
        </ContinueButton>
      }
    >
      {!isExistingUser && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="onboarding-name" className="text-sm text-muted-foreground">
            What should we call you?
          </label>
          <Input
            id="onboarding-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
        </div>
      )}
    </StepFormLayout>
  )
}
