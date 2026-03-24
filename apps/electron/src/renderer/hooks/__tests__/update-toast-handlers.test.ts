import { describe, expect, it, mock } from 'bun:test'

import { createReadyUpdateToastHandlers } from '../update-toast-handlers'

describe('createReadyUpdateToastHandlers', () => {
  it('does not persist dismissal after opening the changelog', () => {
    const onInstall = mock(() => {})
    const onOpenReleaseNotesUrl = mock(() => {})
    const onPersistDismissal = mock(() => {})
    const onDismissToast = mock(() => {})

    const handlers = createReadyUpdateToastHandlers({
      version: '1.2.8',
      releaseUrl: 'https://github.com/YiftachCohen/Depot/releases/tag/v1.2.8',
      onInstall,
      onOpenReleaseNotesUrl,
      onPersistDismissal,
      onDismissToast,
    })

    handlers.onOpenReleaseNotes()
    handlers.onDismiss()

    expect(onDismissToast).toHaveBeenCalledTimes(1)
    expect(onOpenReleaseNotesUrl).toHaveBeenCalledWith('https://github.com/YiftachCohen/Depot/releases/tag/v1.2.8')
    expect(onPersistDismissal).not.toHaveBeenCalled()
  })

  it('does not persist dismissal after restart is clicked', () => {
    const onInstall = mock(() => {})
    const onPersistDismissal = mock(() => {})

    const handlers = createReadyUpdateToastHandlers({
      version: '1.2.8',
      releaseUrl: null,
      onInstall,
      onOpenReleaseNotesUrl: () => {},
      onPersistDismissal,
      onDismissToast: () => {},
    })

    handlers.onInstall()
    handlers.onDismiss()

    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(onPersistDismissal).not.toHaveBeenCalled()
  })

  it('persists dismissal when the toast is dismissed manually', () => {
    const onPersistDismissal = mock(() => {})

    const handlers = createReadyUpdateToastHandlers({
      version: '1.2.8',
      releaseUrl: null,
      onInstall: () => {},
      onOpenReleaseNotesUrl: () => {},
      onPersistDismissal,
      onDismissToast: () => {},
    })

    handlers.onDismiss()

    expect(onPersistDismissal).toHaveBeenCalledWith('1.2.8')
  })
})
