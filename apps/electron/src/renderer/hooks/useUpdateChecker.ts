/**
 * Update Checker Hook
 *
 * Manages auto-update state for the Electron app.
 * - Listens for update availability broadcasts from main process
 * - Tracks download progress
 * - Provides methods to check for updates and install
 * - Shows toast notification when update is ready
 * - Persistent dismissal across app restarts (per version)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { UpdateInfo } from '../../shared/types'
import { buildManualUpdateToastOptions, buildReadyUpdateToastOptions } from './update-toast-config'
import { createReadyUpdateToastHandlers } from './update-toast-handlers'

interface UseUpdateCheckerResult {
  /** Current update info */
  updateInfo: UpdateInfo | null
  /** GitHub release page for the available update */
  releaseUrl: string | null
  /** Whether an update is available */
  updateAvailable: boolean
  /** Whether update is currently downloading */
  isDownloading: boolean
  /** Whether update is ready to install */
  isReadyToInstall: boolean
  /** Download progress (0-100) */
  downloadProgress: number
  /** Check for updates manually */
  checkForUpdates: () => Promise<void>
  /** Install the downloaded update and restart */
  installUpdate: () => Promise<void>
  /** Open the changelog for the available update */
  openReleaseNotes: () => Promise<void>
}

// Toast ID for update notification (allows dismiss/update)
const UPDATE_TOAST_ID = 'update-available'

export function useUpdateChecker(): UseUpdateCheckerResult {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  // Track if we've shown the toast for this version to avoid duplicates
  const shownToastVersionRef = useRef<string | null>(null)

  const openReleaseNotes = useCallback(async () => {
    const releaseUrl = updateInfo?.releaseUrl
    if (!releaseUrl) return

    await window.electronAPI.openUrl(releaseUrl)
  }, [updateInfo?.releaseUrl])

  // Show toast notification when update is ready
  const showUpdateToast = useCallback((version: string, releaseUrl: string | null, onInstall: () => void) => {
    // Don't show if already shown for this version in this session
    if (shownToastVersionRef.current === version) {
      return
    }
    shownToastVersionRef.current = version

    const handlers = createReadyUpdateToastHandlers({
      version,
      releaseUrl,
      onInstall,
      onOpenReleaseNotesUrl: (url) => {
        void window.electronAPI.openUrl(url)
      },
      onPersistDismissal: (dismissedVersion) => {
        void window.electronAPI.dismissUpdate(dismissedVersion)
      },
      onDismissToast: () => {
        toast.dismiss(UPDATE_TOAST_ID)
      },
    })

    toast.info(`Update v${version} ready`, {
      id: UPDATE_TOAST_ID,
      ...buildReadyUpdateToastOptions({
        version,
        releaseUrl,
        onInstall: handlers.onInstall,
        onOpenReleaseNotes: handlers.onOpenReleaseNotes,
        onDismiss: handlers.onDismiss,
      }),
    })
  }, [])

  // Install the update
  const installUpdate = useCallback(async () => {
    try {
      // Dismiss the update toast first
      toast.dismiss(UPDATE_TOAST_ID)
      toast.info('Installing update...', {
        description: 'The app will restart automatically.',
        duration: 5000,
      })
      await window.electronAPI.installUpdate()
    } catch (error) {
      console.error('[useUpdateChecker] Install failed:', error)
      toast.error('Failed to install update', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [])

  // Load initial state and check if update ready
  useEffect(() => {
    const checkAndNotify = async (info: UpdateInfo) => {
      if (!info.available || !info.latestVersion) return
      if (info.downloadState !== 'ready') return

      // Check if this version was dismissed
      const dismissedVersion = await window.electronAPI.getDismissedUpdateVersion()
      if (dismissedVersion === info.latestVersion) {
        return
      }

      // Show toast for ready update
      showUpdateToast(info.latestVersion, info.releaseUrl, installUpdate)
    }

    // Get initial update info
    window.electronAPI.getUpdateInfo().then((info) => {
      setUpdateInfo(info)
      checkAndNotify(info)
    })

    // Subscribe to update availability changes
    const cleanupAvailable = window.electronAPI.onUpdateAvailable((info) => {
      setUpdateInfo(info)
      checkAndNotify(info)
    })

    // Subscribe to download progress updates
    const cleanupProgress = window.electronAPI.onUpdateDownloadProgress((progress) => {
      setUpdateInfo((prev) => prev ? { ...prev, downloadProgress: progress } : prev)
    })

    return () => {
      cleanupAvailable()
      cleanupProgress()
    }
  }, [showUpdateToast, installUpdate])

  // Check for updates manually
  const checkForUpdates = useCallback(async () => {
    try {
      const info = await window.electronAPI.checkForUpdates()
      setUpdateInfo(info)

      if (info.downloadState === 'error') {
        toast.error('Failed to check for updates', {
          description: info.error || 'Unknown error',
          duration: 5000,
        })
      } else if (!info.available) {
        toast.success('You\'re up to date', {
          description: `Version ${info.currentVersion} is the latest.`,
          duration: 3000,
        })
      } else if (info.downloadState === 'ready' && info.latestVersion) {
        // If already ready, show toast (clear any previous dismissal since user explicitly checked)
        shownToastVersionRef.current = null // Reset so toast can show again
        showUpdateToast(info.latestVersion, info.releaseUrl, installUpdate)
      } else if (info.downloadState === 'downloading' && info.latestVersion) {
        const manualToast = buildManualUpdateToastOptions({
          version: info.latestVersion,
          releaseUrl: info.releaseUrl,
          downloadProgress: info.downloadProgress,
          state: 'downloading',
          onOpenReleaseNotes: () => {
            if (info.releaseUrl) {
              void window.electronAPI.openUrl(info.releaseUrl)
            }
          },
        })
        toast.info(manualToast.message, manualToast.options)
      } else if (info.available && info.latestVersion) {
        const manualToast = buildManualUpdateToastOptions({
          version: info.latestVersion,
          releaseUrl: info.releaseUrl,
          state: 'available',
          onOpenReleaseNotes: () => {
            if (info.releaseUrl) {
              void window.electronAPI.openUrl(info.releaseUrl)
            }
          },
        })
        toast.info(manualToast.message, manualToast.options)
      }
    } catch (error) {
      console.error('[useUpdateChecker] Check failed:', error)
      toast.error('Failed to check for updates', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [showUpdateToast, installUpdate])

  return {
    updateInfo,
    releaseUrl: updateInfo?.releaseUrl ?? null,
    updateAvailable: updateInfo?.available ?? false,
    isDownloading: updateInfo?.downloadState === 'downloading',
    isReadyToInstall: updateInfo?.downloadState === 'ready',
    downloadProgress: updateInfo?.downloadProgress ?? 0,
    checkForUpdates,
    installUpdate,
    openReleaseNotes,
  }
}
