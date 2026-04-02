import { describe, expect, it, mock } from 'bun:test'

mock.module('electron', () => ({
  Menu: {
    setApplicationMenu: mock(() => {}),
    buildFromTemplate: mock(() => ({})),
  },
  app: {
    isPackaged: true,
    getPath: mock((_name: string) => '/tmp/mock'),
  },
  shell: {
    openExternal: mock(async () => {}),
  },
  BrowserWindow: {
    getFocusedWindow: mock(() => null),
  },
  BrowserView: class MockBrowserView {},
  ipcMain: { handle: mock(() => {}), on: mock(() => {}), removeHandler: mock(() => {}) },
  nativeTheme: { shouldUseDarkColors: false },
  session: { fromPartition: mock(() => ({ setPermissionCheckHandler: mock(() => {}), setPermissionRequestHandler: mock(() => {}), webRequest: { onBeforeRequest: mock(() => {}), onHeadersReceived: mock(() => {}) } })) },
}))

mock.module('../logger', () => ({
  mainLog: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} },
}))

describe('getMacUpdateMenuEntries', () => {
  it('returns install and changelog entries when update is ready with a release URL', async () => {
    const { getMacUpdateMenuEntries } = await import('../menu')

    expect(getMacUpdateMenuEntries({
      available: true,
      currentVersion: '1.2.7',
      latestVersion: '1.2.8',
      releaseUrl: 'https://github.com/YiftachCohen/Depot/releases/tag/v1.2.8',
      downloadState: 'ready',
      downloadProgress: 100,
    })).toEqual([
      { action: 'install', label: 'Install Update…\t【1.2.8】' },
      { action: 'releaseNotes', label: 'View Changelog…' },
    ])
  })

  it('returns only install when update is ready without a release URL', async () => {
    const { getMacUpdateMenuEntries } = await import('../menu')

    expect(getMacUpdateMenuEntries({
      available: true,
      currentVersion: '1.2.7',
      latestVersion: '1.2.8',
      releaseUrl: null,
      downloadState: 'ready',
      downloadProgress: 100,
    })).toEqual([
      { action: 'install', label: 'Install Update…\t【1.2.8】' },
    ])
  })

  it('returns check-for-updates when no ready update exists', async () => {
    const { getMacUpdateMenuEntries } = await import('../menu')

    expect(getMacUpdateMenuEntries({
      available: false,
      currentVersion: '1.2.7',
      latestVersion: null,
      releaseUrl: null,
      downloadState: 'idle',
      downloadProgress: 0,
    })).toEqual([
      { action: 'check', label: 'Check for Updates…' },
    ])
  })
})
