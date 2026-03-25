import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import * as storage from '../dock-icon-storage'

const VALID_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg=='
const VALID_PNG_DATA_URL = `data:image/png;base64,${VALID_PNG_BASE64}`
const HEADER_ONLY_PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
const isDecodableTestPng = (buffer: Buffer) => buffer.toString('base64') === VALID_PNG_BASE64

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createTempConfigDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'depot-dock-icon-test-'))
  tempDirs.push(dir)
  return dir
}

describe('dock icon storage', () => {
  it('persists a validated PNG dock icon atomically', () => {
    const configDir = createTempConfigDir()
    const dockIconPath = storage.getDockIconFilePath(configDir)

    const persistedPath = storage.persistDockIconDataUrl(VALID_PNG_DATA_URL, dockIconPath, isDecodableTestPng)

    expect(persistedPath).toBe(dockIconPath)
    expect(existsSync(dockIconPath)).toBe(true)
    expect(existsSync(`${dockIconPath}.tmp`)).toBe(false)
    expect(readFileSync(dockIconPath).subarray(0, 8).toString('hex')).toBe(
      storage.decodeValidatedDockIconDataUrl(VALID_PNG_DATA_URL, isDecodableTestPng).subarray(0, 8).toString('hex'),
    )
    expect(storage.hasValidPersistedDockIcon(dockIconPath, isDecodableTestPng)).toBe(true)
  })

  it('rejects non-PNG data URLs', () => {
    expect(() => storage.decodeValidatedDockIconDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', isDecodableTestPng)).toThrow(
      'Dock icon must be a PNG data URL',
    )
  })

  it('rejects oversized PNG payloads', () => {
    const oversizedBuffer = Buffer.concat([
      HEADER_ONLY_PNG,
      Buffer.alloc(storage.MAX_DOCK_ICON_BYTES),
    ])
    const oversizedDataUrl = `data:image/png;base64,${oversizedBuffer.toString('base64')}`

    expect(() => storage.decodeValidatedDockIconDataUrl(oversizedDataUrl, isDecodableTestPng)).toThrow(
      `Dock icon PNG exceeds ${storage.MAX_DOCK_ICON_BYTES} bytes`,
    )
  })

  it('falls back to bundled icon when the persisted icon is corrupt', () => {
    const configDir = createTempConfigDir()
    const persistedDockIconPath = storage.getDockIconFilePath(configDir)
    const bundledDockIconPath = join(configDir, 'resources', 'icon.png')

    writeFileSync(persistedDockIconPath, 'not-a-png')
    mkdirSync(dirname(bundledDockIconPath), { recursive: true })
    writeFileSync(bundledDockIconPath, Buffer.from(VALID_PNG_BASE64, 'base64'))

    expect(storage.hasValidPersistedDockIcon(persistedDockIconPath, isDecodableTestPng)).toBe(false)
    expect(storage.resolveStartupDockIconPath([bundledDockIconPath], persistedDockIconPath, isDecodableTestPng)).toBe(
      bundledDockIconPath,
    )
  })

  it('falls back to bundled icon when the persisted icon has a PNG header but is not decodable', () => {
    const configDir = createTempConfigDir()
    const persistedDockIconPath = storage.getDockIconFilePath(configDir)
    const bundledDockIconPath = join(configDir, 'resources', 'icon.png')

    writeFileSync(persistedDockIconPath, HEADER_ONLY_PNG)
    mkdirSync(dirname(bundledDockIconPath), { recursive: true })
    writeFileSync(bundledDockIconPath, Buffer.from(VALID_PNG_BASE64, 'base64'))

    expect(storage.hasValidPersistedDockIcon(persistedDockIconPath, isDecodableTestPng)).toBe(false)
    expect(storage.resolveStartupDockIconPath([bundledDockIconPath], persistedDockIconPath, isDecodableTestPng)).toBe(
      bundledDockIconPath,
    )
  })

  it('persists the selected icon ID as JSON', () => {
    const configDir = createTempConfigDir()
    const preferencePath = storage.getIconPreferenceFilePath(configDir)

    storage.persistIconPreference('starburst-grid', preferencePath)

    expect(JSON.parse(readFileSync(preferencePath, 'utf-8'))).toEqual({ iconId: 'starburst-grid' })
  })
})
