interface ReadyUpdateToastHandlersParams {
  version: string
  releaseUrl: string | null
  onInstall: () => void
  onOpenReleaseNotesUrl: (url: string) => void
  onPersistDismissal: (version: string) => void
  onDismissToast: () => void
}

export interface ReadyUpdateToastHandlers {
  onInstall: () => void
  onOpenReleaseNotes: () => void
  onDismiss: () => void
}

export function createReadyUpdateToastHandlers({
  version,
  releaseUrl,
  onInstall,
  onOpenReleaseNotesUrl,
  onPersistDismissal,
  onDismissToast,
}: ReadyUpdateToastHandlersParams): ReadyUpdateToastHandlers {
  let persistDismissal = true

  return {
    onInstall: () => {
      persistDismissal = false
      onInstall()
    },
    onOpenReleaseNotes: () => {
      persistDismissal = false
      onDismissToast()
      if (releaseUrl) {
        onOpenReleaseNotesUrl(releaseUrl)
      }
    },
    onDismiss: () => {
      if (!persistDismissal) {
        return
      }

      onPersistDismissal(version)
    },
  }
}
