const GITHUB_RELEASES_BASE_URL = 'https://github.com/YiftachCohen/Depot/releases/tag'

export function buildGitHubReleaseUrl(version: string | null | undefined): string | null {
  const normalizedVersion = version?.trim()
  if (!normalizedVersion) {
    return null
  }

  const tag = normalizedVersion.startsWith('v') ? normalizedVersion : `v${normalizedVersion}`
  return `${GITHUB_RELEASES_BASE_URL}/${tag}`
}
