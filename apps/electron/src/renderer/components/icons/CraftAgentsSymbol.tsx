import { useEffect, useSyncExternalStore } from 'react'
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

function getIconSvgDataUrl(id: string): string {
  const icon = getIconById(id)
  return `data:image/svg+xml;base64,${btoa(icon.svgString512)}`
}

async function getIconPngDataUrl(id: string): Promise<string> {
  const image = new Image()
  const svgDataUrl = getIconSvgDataUrl(id)

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Failed to load app icon: ${id}`))
    image.src = svgDataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to create canvas context for app icon')
  }

  ctx.drawImage(image, 0, 0, 512, 512)
  return canvas.toDataURL('image/png')
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

export function useSyncDepotAppIcon(): void {
  const iconId = useDepotIconId()

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const dataUrl = await getIconPngDataUrl(iconId)
        if (!cancelled) {
          await window.electronAPI.setAppIcon(dataUrl)
        }
      } catch (error) {
        console.error('Failed to sync app icon:', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [iconId])
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
