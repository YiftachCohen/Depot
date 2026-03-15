const DEFAULT_DEEPLINK_SCHEME = 'craftagents'
const LEGACY_DEEPLINK_SCHEME = 'depot'

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

export function getPrimaryDeepLinkScheme(): string {
  return process.env.CRAFT_DEEPLINK_SCHEME || process.env.DEPOT_DEEPLINK_SCHEME || DEFAULT_DEEPLINK_SCHEME
}

export function getSupportedDeepLinkSchemes(): string[] {
  return unique([
    process.env.CRAFT_DEEPLINK_SCHEME,
    process.env.DEPOT_DEEPLINK_SCHEME,
    getPrimaryDeepLinkScheme(),
    DEFAULT_DEEPLINK_SCHEME,
    LEGACY_DEEPLINK_SCHEME,
  ])
}

export function getPrimaryDeepLinkPrefix(): string {
  return `${getPrimaryDeepLinkScheme()}://`
}

export function isSupportedDeepLinkProtocol(protocol: string): boolean {
  const normalizedProtocol = protocol.endsWith(':') ? protocol.slice(0, -1) : protocol
  return getSupportedDeepLinkSchemes().includes(normalizedProtocol)
}

export function isSupportedDeepLinkUrl(url: string): boolean {
  try {
    return isSupportedDeepLinkProtocol(new URL(url).protocol)
  } catch {
    return false
  }
}
