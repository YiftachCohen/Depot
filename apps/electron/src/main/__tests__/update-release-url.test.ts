import { describe, expect, it } from 'bun:test'

import { buildGitHubReleaseUrl } from '../update-release-url'

describe('buildGitHubReleaseUrl', () => {
  it('builds a release URL from a bare semver', () => {
    expect(buildGitHubReleaseUrl('1.2.8')).toBe('https://github.com/YiftachCohen/Depot/releases/tag/v1.2.8')
  })

  it('preserves v-prefixed versions', () => {
    expect(buildGitHubReleaseUrl('v1.2.8')).toBe('https://github.com/YiftachCohen/Depot/releases/tag/v1.2.8')
  })

  it('returns null for nullish or blank values', () => {
    expect(buildGitHubReleaseUrl(null)).toBeNull()
    expect(buildGitHubReleaseUrl(undefined)).toBeNull()
    expect(buildGitHubReleaseUrl('   ')).toBeNull()
  })
})
