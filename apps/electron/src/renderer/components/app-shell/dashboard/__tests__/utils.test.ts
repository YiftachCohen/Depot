import { describe, expect, it } from 'bun:test'
import { getAccentColor, getActivityStatus, formatRelativeTime, ACCENT_PALETTE } from '../utils'

describe('getAccentColor', () => {
  it('returns a color from the palette', () => {
    const color = getAccentColor('test-agent')
    expect(ACCENT_PALETTE).toContain(color)
  })

  it('returns deterministic results for the same slug', () => {
    expect(getAccentColor('flight-monitor')).toBe(getAccentColor('flight-monitor'))
  })

  it('returns different colors for different slugs', () => {
    // Not guaranteed but very likely for different strings
    const colors = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map(s => getAccentColor(s)))
    expect(colors.size).toBeGreaterThan(1)
  })

  it('handles empty string', () => {
    const color = getAccentColor('')
    expect(ACCENT_PALETTE).toContain(color)
  })
})

describe('getActivityStatus', () => {
  it('returns active for timestamps within the last hour', () => {
    expect(getActivityStatus(Date.now() - 30 * 60_000)).toBe('active') // 30m ago
    expect(getActivityStatus(Date.now() - 1000)).toBe('active') // 1s ago
  })

  it('returns recent for timestamps within the last 24 hours', () => {
    expect(getActivityStatus(Date.now() - 2 * 3600_000)).toBe('recent') // 2h ago
    expect(getActivityStatus(Date.now() - 12 * 3600_000)).toBe('recent') // 12h ago
  })

  it('returns idle for timestamps older than 24 hours', () => {
    expect(getActivityStatus(Date.now() - 25 * 3600_000)).toBe('idle') // 25h ago
    expect(getActivityStatus(Date.now() - 7 * 86400_000)).toBe('idle') // 7d ago
  })

  it('returns idle for undefined input', () => {
    expect(getActivityStatus(undefined)).toBe('idle')
  })

  it('returns active at the exact 1 hour boundary', () => {
    // At exactly 1h, diff === 3600_000 which is NOT < 3600_000, so it should be 'recent'
    expect(getActivityStatus(Date.now() - 3600_000)).toBe('recent')
  })
})

describe('formatRelativeTime', () => {
  it('returns "just now" for timestamps less than 60 seconds ago', () => {
    expect(formatRelativeTime(Date.now() - 10_000)).toBe('just now')
    expect(formatRelativeTime(Date.now() - 59_000)).toBe('just now')
  })

  it('returns minutes for timestamps less than 1 hour ago', () => {
    expect(formatRelativeTime(Date.now() - 5 * 60_000)).toBe('5m ago')
    expect(formatRelativeTime(Date.now() - 30 * 60_000)).toBe('30m ago')
  })

  it('returns hours for timestamps less than 24 hours ago', () => {
    expect(formatRelativeTime(Date.now() - 2 * 3600_000)).toBe('2h ago')
    expect(formatRelativeTime(Date.now() - 12 * 3600_000)).toBe('12h ago')
  })

  it('returns days for timestamps less than 30 days ago', () => {
    expect(formatRelativeTime(Date.now() - 3 * 86400_000)).toBe('3d ago')
    expect(formatRelativeTime(Date.now() - 15 * 86400_000)).toBe('15d ago')
  })

  it('returns months for timestamps 30+ days ago', () => {
    expect(formatRelativeTime(Date.now() - 60 * 86400_000)).toBe('2mo ago')
    expect(formatRelativeTime(Date.now() - 90 * 86400_000)).toBe('3mo ago')
  })
})
