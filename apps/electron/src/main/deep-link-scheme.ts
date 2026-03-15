const DEFAULT_DEEPLINK_SCHEME = 'craftagents'
const LEGACY_DEEPLINK_SCHEME = 'depot'

function normalizeScheme(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim().replace(/:$/, '').toLowerCase()
  return normalized || undefined
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

export function getPrimaryDeepLinkScheme(): string {
  return normalizeScheme(process.env.CRAFT_DEEPLINK_SCHEME)
    ?? normalizeScheme(process.env.DEPOT_DEEPLINK_SCHEME)
    ?? DEFAULT_DEEPLINK_SCHEME
}

export function getSupportedDeepLinkSchemes(): string[] {
  return unique([
    normalizeScheme(process.env.CRAFT_DEEPLINK_SCHEME),
    normalizeScheme(process.env.DEPOT_DEEPLINK_SCHEME),
    getPrimaryDeepLinkScheme(),
    DEFAULT_DEEPLINK_SCHEME,
    LEGACY_DEEPLINK_SCHEME,
  ])
}

export function getPrimaryDeepLinkPrefix(): string {
  return `${getPrimaryDeepLinkScheme()}://`
}

export function isSupportedDeepLinkProtocol(protocol: string): boolean {
  const normalizedProtocol = protocol.endsWith(':') ? protocol.slice(0, -1).toLowerCase() : protocol.toLowerCase()
  return getSupportedDeepLinkSchemes().includes(normalizedProtocol)
}

export function isSupportedDeepLinkUrl(url: string): boolean {
  try {
    return isSupportedDeepLinkProtocol(new URL(url).protocol)
  } catch {
    return false
  }
}
