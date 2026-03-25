import { describe, expect, it, mock } from 'bun:test'

import { buildManualUpdateToastOptions, buildReadyUpdateToastOptions } from '../update-toast-config'

describe('buildReadyUpdateToastOptions', () => {
  it('includes restart and changelog actions when a release URL exists', () => {
    const onInstall = mock(() => {})
    const onOpenReleaseNotes = mock(() => {})
    const onDismiss = mock(() => {})

    const options = buildReadyUpdateToastOptions({
      version: '1.2.8',
      releaseUrl: 'https://github.com/YiftachCohen/Depot/releases/tag/v1.2.8',
      onInstall,
      onOpenReleaseNotes,
      onDismiss,
    })

    const action = options.action as { label: string; onClick: (event: never) => void } | undefined
    const cancel = options.cancel as { label: string; onClick: (event: never) => void } | undefined

    expect(action?.label).toBe('Restart')
    expect(cancel?.label).toBe('View Changelog')

    cancel?.onClick({} as never)

    expect(onOpenReleaseNotes).toHaveBeenCalledTimes(1)
  })

  it('omits the changelog action when no release URL exists', () => {
    const options = buildReadyUpdateToastOptions({
      version: '1.2.8',
      releaseUrl: null,
      onInstall: () => {},
      onOpenReleaseNotes: () => {},
      onDismiss: () => {},
    })

    expect(options.cancel).toBeUndefined()
  })
})

describe('buildManualUpdateToastOptions', () => {
  it('adds a changelog action for downloading updates', () => {
    const onOpenReleaseNotes = mock(() => {})

    const toast = buildManualUpdateToastOptions({
      version: '1.2.8',
      releaseUrl: 'https://github.com/YiftachCohen/Depot/releases/tag/v1.2.8',
      downloadProgress: 42,
      state: 'downloading',
      onOpenReleaseNotes,
    })

    expect(toast.message).toBe('Downloading v1.2.8...')
    expect(toast.options.description).toBe('42% complete')

    const action = toast.options.action as { label: string; onClick: (event: never) => void } | undefined
    action?.onClick({} as never)

    expect(onOpenReleaseNotes).toHaveBeenCalledTimes(1)
  })

  it('omits the changelog action when no release URL exists', () => {
    const toast = buildManualUpdateToastOptions({
      version: '1.2.8',
      releaseUrl: null,
      state: 'available',
      onOpenReleaseNotes: () => {},
    })

    expect(toast.message).toBe('Update v1.2.8 found')
    expect(toast.options.action).toBeUndefined()
  })
})
