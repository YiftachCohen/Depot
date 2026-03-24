import type { ExternalToast } from 'sonner'

interface ReadyUpdateToastOptionsParams {
  version: string
  releaseUrl: string | null
  onInstall: () => void
  onOpenReleaseNotes: () => void
  onDismiss: () => void
}

interface ManualUpdateToastOptionsParams {
  version: string
  releaseUrl: string | null
  downloadProgress?: number
  state: 'downloading' | 'available'
  onOpenReleaseNotes: () => void
}

export function buildReadyUpdateToastOptions({
  version,
  releaseUrl,
  onInstall,
  onOpenReleaseNotes,
  onDismiss,
}: ReadyUpdateToastOptionsParams): ExternalToast {
  return {
    description: `Restart to install v${version}.`,
    duration: 10000,
    action: {
      label: 'Restart',
      onClick: onInstall,
    },
    cancel: releaseUrl ? {
      label: 'View Changelog',
      onClick: onOpenReleaseNotes,
    } : undefined,
    onDismiss,
  }
}

export function buildManualUpdateToastOptions({
  version,
  releaseUrl,
  downloadProgress,
  state,
  onOpenReleaseNotes,
}: ManualUpdateToastOptionsParams): { message: string; options: ExternalToast } {
  if (state === 'downloading') {
    return {
      message: `Downloading v${version}...`,
      options: {
        description: `${downloadProgress ?? 0}% complete`,
        duration: 3000,
        action: releaseUrl ? {
          label: 'View Changelog',
          onClick: onOpenReleaseNotes,
        } : undefined,
      },
    }
  }

  return {
    message: `Update v${version} found`,
    options: {
      description: 'Download will start automatically.',
      duration: 3000,
      action: releaseUrl ? {
        label: 'View Changelog',
        onClick: onOpenReleaseNotes,
      } : undefined,
    },
  }
}
