import * as React from 'react'

function toReactAttributeName(name: string): string {
  if (name === 'class') return 'className'
  if (name === 'for') return 'htmlFor'
  if (name === 'tabindex') return 'tabIndex'
  if (name === 'viewbox') return 'viewBox'
  if (name === 'preserveaspectratio') return 'preserveAspectRatio'
  if (name.includes(':')) {
    const [prefix, suffix] = name.split(':', 2)
    return `${prefix}${suffix ? suffix.charAt(0).toUpperCase() + suffix.slice(1) : ''}`
  }
  if (name.startsWith('aria-') || name.startsWith('data-')) return name
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function parseStyleAttribute(style: string): React.CSSProperties {
  const entries = style
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const colonIndex = declaration.indexOf(':')
      if (colonIndex === -1) return null
      const property = declaration.slice(0, colonIndex).trim()
      const value = declaration.slice(colonIndex + 1).trim()
      if (!property || !value) return null
      return [toReactAttributeName(property), value] as const
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry))

  return Object.fromEntries(entries)
}

function getElementProps(element: Element): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  for (const { name, value } of Array.from(element.attributes)) {
    if (name === 'style') {
      props.style = parseStyleAttribute(value)
      continue
    }
    props[toReactAttributeName(name)] = value
  }

  return props
}

function renderSvgNode(node: ChildNode, key: number): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent
    return text?.trim() ? text : null
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const element = node as Element
  const props = getElementProps(element)
  const children = Array.from(element.childNodes)
    .map((child, index) => renderSvgNode(child, index))
    .filter((child) => child !== null)

  return React.createElement(
    element.tagName.toLowerCase(),
    { ...props, key },
    ...(children.length > 0 ? children : []),
  )
}

function parseSvgElement(svg: string): SVGSVGElement | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  return root.tagName.toLowerCase() === 'svg' ? (root as unknown as SVGSVGElement) : null
}

/**
 * Sanitize SVG content before inline rendering.
 * Removes scripts, inline event handlers, and JavaScript URLs, and strips
 * explicit width/height so the caller controls sizing.
 */
export function sanitizeSvgForInline(svg: string): string {
  return svg
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/\s+width="[^"]*"/gi, '')
    .replace(/\s+height="[^"]*"/gi, '')
}

export function parseInlineSvg(
  svg: string,
  props?: React.SVGProps<SVGSVGElement>,
): React.ReactElement | null {
  const root = parseSvgElement(sanitizeSvgForInline(svg))
  if (!root) return null

  const parsedProps = getElementProps(root)
  const children = Array.from(root.childNodes)
    .map((child, index) => renderSvgNode(child, index))
    .filter((child) => child !== null)

  return React.createElement(
    'svg',
    {
      ...parsedProps,
      ...props,
      className: [parsedProps.className, props?.className].filter(Boolean).join(' ') || undefined,
      style: {
        ...(parsedProps.style as React.CSSProperties | undefined),
        ...(props?.style ?? {}),
      },
    },
    ...(children.length > 0 ? children : []),
  )
}

export function InlineSvg({
  svg,
  ...props
}: { svg: string } & React.SVGProps<SVGSVGElement>) {
  return React.useMemo(() => parseInlineSvg(svg, props), [svg, props])
}
