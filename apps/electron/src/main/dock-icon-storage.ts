import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { CONFIG_DIR } from '@depot/shared/config/paths'

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'
const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

export const MAX_DOCK_ICON_BYTES = 4 * 1024 * 1024
export type PngDecoder = (buffer: Buffer) => boolean

export function getDockIconFilePath(configDir = CONFIG_DIR): string {
  return join(configDir, 'dock-icon.png')
}

export function getIconPreferenceFilePath(configDir = CONFIG_DIR): string {
  return join(configDir, 'icon-preference.json')
}

export function isValidPngBuffer(buffer: Buffer): boolean {
  return buffer.length >= PNG_MAGIC_BYTES.length && buffer.subarray(0, PNG_MAGIC_BYTES.length).equals(PNG_MAGIC_BYTES)
}

function isDecodablePngBuffer(buffer: Buffer): boolean {
  try {
    // Lazy require to avoid top-level import — electron is not available in test context
    // and import.meta.url is undefined in the CJS main process bundle
    const { nativeImage } = require('electron') as typeof import('electron')
    const image = nativeImage.createFromBuffer(buffer)
    return !image.isEmpty()
  } catch {
    return false
  }
}

export function decodeValidatedDockIconDataUrl(dataUrl: string, decoder: PngDecoder = isDecodablePngBuffer): Buffer {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new Error('Dock icon must be a PNG data URL')
  }

  const base64 = dataUrl.slice(PNG_DATA_URL_PREFIX.length)
  if (!base64) {
    throw new Error('Dock icon data URL is empty')
  }

  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length === 0) {
    throw new Error('Dock icon PNG failed to decode')
  }

  if (buffer.length > MAX_DOCK_ICON_BYTES) {
    throw new Error(`Dock icon PNG exceeds ${MAX_DOCK_ICON_BYTES} bytes`)
  }

  if (!isValidPngBuffer(buffer)) {
    throw new Error('Dock icon data is not a valid PNG')
  }

  if (!decoder(buffer)) {
    throw new Error('Dock icon PNG could not be decoded')
  }

  return buffer
}

export function persistDockIconDataUrl(
  dataUrl: string,
  dockIconPath = getDockIconFilePath(),
  decoder: PngDecoder = isDecodablePngBuffer,
): string {
  const buffer = decodeValidatedDockIconDataUrl(dataUrl, decoder)
  mkdirSync(dirname(dockIconPath), { recursive: true })
  atomicWriteBufferSync(dockIconPath, buffer)
  return dockIconPath
}

export function persistIconPreference(iconId: string, preferencePath = getIconPreferenceFilePath()): void {
  const trimmedIconId = iconId.trim()
  if (!trimmedIconId) {
    throw new Error('Icon ID must be a non-empty string')
  }

  mkdirSync(dirname(preferencePath), { recursive: true })
  atomicWriteBufferSync(preferencePath, Buffer.from(JSON.stringify({ iconId: trimmedIconId }, null, 2)))
}

export function hasValidPersistedDockIcon(
  dockIconPath = getDockIconFilePath(),
  decoder: PngDecoder = isDecodablePngBuffer,
): boolean {
  if (!existsSync(dockIconPath)) {
    return false
  }

  try {
    const buffer = readFileSync(dockIconPath)
    return isValidPngBuffer(buffer) && decoder(buffer)
  } catch {
    return false
  }
}

export function resolveStartupDockIconPath(
  bundledIconPaths: string[],
  dockIconPath = getDockIconFilePath(),
  decoder: PngDecoder = isDecodablePngBuffer,
): string | null {
  if (hasValidPersistedDockIcon(dockIconPath, decoder)) {
    return dockIconPath
  }

  return bundledIconPaths.find((iconPath) => existsSync(iconPath)) ?? null
}

function atomicWriteBufferSync(filePath: string, data: Buffer): void {
  const tmpPath = `${filePath}.tmp`

  try {
    writeFileSync(tmpPath, data)
    renameSync(tmpPath, filePath)
  } catch (error) {
    try {
      unlinkSync(tmpPath)
    } catch {}
    throw error
  }
}
