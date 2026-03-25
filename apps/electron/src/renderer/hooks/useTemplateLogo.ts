/**
 * Resolve a favicon/logo URL for a source template.
 * Uses the same getLogoUrl IPC as SourceAvatar.
 */

import * as React from 'react'
import { logoUrlCache } from '@/lib/icon-cache'
import type { SourceTemplate } from '@depot/shared/sources/templates'

export function useTemplateLogo(template: SourceTemplate): string | null {
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)

  // Use template.id as provider hint so 'gmail', 'google-drive', etc. map
  // to their canonical domains — template.sourceInput.provider is often a
  // shared value like 'google' which has no logo mapping.
  const provider = template.id
  const serviceUrl = template.sourceInput.mcp?.url
    ?? template.sourceInput.api?.baseUrl
    ?? null

  React.useEffect(() => {
    // Local folder doesn't need a logo
    if (template.sourceInput.type === 'local') return

    // For stdio MCP sources (no URL), still attempt logo via provider domain lookup
    const effectiveUrl = serviceUrl ?? ''

    const cacheKey = `${effectiveUrl}:${provider}`
    const cached = logoUrlCache.get(cacheKey)
    if (cached !== undefined) {
      setLogoUrl(cached)
      return
    }

    let cancelled = false
    window.electronAPI.getLogoUrl(effectiveUrl, provider)
      .then((result) => {
        if (cancelled) return
        logoUrlCache.set(cacheKey, result)
        setLogoUrl(result)
      })
      .catch(() => {
        if (cancelled) return
        logoUrlCache.set(cacheKey, null)
      })

    return () => { cancelled = true }
  }, [provider, serviceUrl, template.sourceInput.type])

  return logoUrl
}
