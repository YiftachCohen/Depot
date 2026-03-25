import * as React from 'react'
import { Check, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoUrlCache } from '@/lib/icon-cache'
import type { SourceTemplate } from '@depot/shared/sources/templates'

interface SourceTemplateGridProps {
  templates?: SourceTemplate[]
  connectedSlugs?: string[]
  onSelect: (template: SourceTemplate) => void
  onConnectedClick?: (template: SourceTemplate) => void
}

/**
 * Resolve a favicon/logo URL for a source template.
 * Uses the same getLogoUrl IPC as SourceAvatar.
 */
function useTemplateLogo(template: SourceTemplate): string | null {
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)

  const provider = template.sourceInput.provider
  const serviceUrl = template.sourceInput.mcp?.url
    ?? template.sourceInput.api?.baseUrl
    ?? null

  React.useEffect(() => {
    // Local folder doesn't need a logo
    if (template.sourceInput.type === 'local') return

    if (!serviceUrl) return

    const cacheKey = `${serviceUrl}:${provider}`
    const cached = logoUrlCache.get(cacheKey)
    if (cached !== undefined) {
      setLogoUrl(cached)
      return
    }

    let cancelled = false
    window.electronAPI.getLogoUrl(serviceUrl, provider)
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

function TemplateIcon({ template }: { template: SourceTemplate }) {
  const logoUrl = useTemplateLogo(template)

  // Local folder → use Lucide icon
  if (template.sourceInput.type === 'local') {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <FolderOpen className="size-5 text-foreground/60" />
      </div>
    )
  }

  // Logo resolved → show image
  if (logoUrl) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <img
          src={logoUrl}
          alt={template.name}
          className="size-6 rounded-sm object-contain"
          loading="lazy"
          onError={(e) => {
            // Fall back to emoji on load error
            const el = e.currentTarget
            el.style.display = 'none'
            const parent = el.parentElement
            if (parent) {
              const span = document.createElement('span')
              span.textContent = template.icon
              span.className = 'text-lg'
              parent.appendChild(span)
            }
          }}
        />
      </div>
    )
  }

  // Fallback: emoji
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
      {template.icon}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-[10px] border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-3 w-36 rounded bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export function SourceTemplateGrid({
  templates,
  connectedSlugs,
  onSelect,
  onConnectedClick,
}: SourceTemplateGridProps) {
  // Loading state
  if (!templates || connectedSlugs === undefined) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  // Empty state
  if (templates.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No quick integrations available. Set up custom sources via the chat.
        </p>
      </div>
    )
  }

  const allConnected = templates.every(t =>
    connectedSlugs.includes(t.sourceInput.provider)
  )

  return (
    <div className="space-y-3">
      {allConnected && (
        <div className="flex items-center gap-2 rounded-[8px] bg-success/10 px-3 py-2 text-sm text-success">
          <Check className="size-4" />
          All integrations connected
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {templates.map((template) => {
          const isConnected = connectedSlugs.includes(template.sourceInput.provider)
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => isConnected && onConnectedClick ? onConnectedClick(template) : onSelect(template)}
              className={cn(
                'group relative flex items-start gap-3 rounded-[10px] border p-4 text-left transition-all duration-150',
                'bg-card border-border',
                'hover:-translate-y-px hover:shadow-minimal hover:border-accent/40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
              )}
            >
              <TemplateIcon template={template} />

              {/* Content */}
              <div className="min-w-0 flex-1">
                <h4 className="text-[16px] font-semibold leading-tight text-foreground">
                  {template.name}
                </h4>
                {isConnected ? (
                  <span className="mt-0.5 flex items-center gap-1 text-[13px] font-normal text-success">
                    <Check className="size-3.5" />
                    Connected
                  </span>
                ) : (
                  <p className="mt-0.5 truncate text-[13px] font-normal text-muted-foreground">
                    {template.tagline}
                  </p>
                )}
              </div>

              {/* Connected badge */}
              {isConnected && (
                <div className="absolute bottom-2 right-2 flex size-4 items-center justify-center rounded-full bg-success text-white">
                  <Check className="size-2.5" strokeWidth={3} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
