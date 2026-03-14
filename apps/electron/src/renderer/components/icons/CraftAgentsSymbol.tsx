import { useSyncExternalStore } from 'react'
import { getIconById, DEFAULT_ICON_ID } from './depot-icon-registry'

const STORAGE_KEY = 'craft-depot-icon'

/** Subscribe to storage changes (cross-tab + same-tab) */
const listeners = new Set<() => void>()
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
function getSnapshot(): string {
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_ICON_ID
}

// Listen for storage events from other tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) listeners.forEach(l => l())
  })
}

/** Set the active icon and notify all subscribers */
export function setDepotIcon(id: string) {
  localStorage.setItem(STORAGE_KEY, id)
  listeners.forEach(l => l())
}

/** Hook to get the current icon id reactively */
export function useDepotIconId(): string {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_ICON_ID)
}

interface CraftAgentsSymbolProps {
  className?: string
}

/**
 * Depot icon symbol — renders the user-selected icon variant.
 * Used in toolbar, splash screen, onboarding, and menus.
 */
export function CraftAgentsSymbol({ className }: CraftAgentsSymbolProps) {
  const iconId = useDepotIconId()
  const icon = getIconById(iconId)
  return <>{icon.symbol(className)}</>
}
