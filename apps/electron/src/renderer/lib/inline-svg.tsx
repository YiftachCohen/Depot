import * as React from 'react'

const SAFE_SVG_ATTRIBUTES = new Set([
  'ariaHidden',
  'clipPath',
  'clipPathUnits',
  'clipRule',
  'color',
  'colorInterpolationFilters',
  'cx',
  'cy',
  'd',
  'direction',
  'display',
  'dominantBaseline',
  'dx',
  'dy',
  'fill',
  'fillOpacity',
  'fillRule',
  'filter',
  'filterUnits',
  'floodColor',
  'floodOpacity',
  'focusable',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'gradientTransform',
  'gradientUnits',
  'height',
  'href',
  'id',
  'in',
  'in2',
  'k1',
  'k2',
  'k3',
  'k4',
  'markerEnd',
  'markerHeight',
  'markerMid',
  'markerStart',
  'markerWidth',
  'mask',
  'maskContentUnits',
  'maskType',
  'maskUnits',
  'offset',
  'opacity',
  'operator',
  'orient',
  'pathLength',
  'patternContentUnits',
  'patternTransform',
  'patternUnits',
  'points',
  'preserveAspectRatio',
  'primitiveUnits',
  'r',
  'refX',
  'refY',
  'result',
  'role',
  'rotate',
  'rx',
  'ry',
  'spreadMethod',
  'startOffset',
  'stdDeviation',
  'stopColor',
  'stopOpacity',
  'stroke',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeMiterlimit',
  'strokeOpacity',
  'strokeWidth',
  'textAnchor',
  'transform',
  'transformBox',
  'transformOrigin',
  'type',
  'values',
  'vectorEffect',
  'version',
  'viewBox',
  'width',
  'x',
  'x1',
  'x2',
  'xlinkHref',
  'xmlSpace',
  'xmlns',
  'xmlnsXlink',
  'y',
  'y1',
  'y2',
])

const SAFE_STYLE_PROPERTIES = new Set([
  'color',
  'fill',
  'fillOpacity',
  'fillRule',
  'opacity',
  'stroke',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeMiterlimit',
  'strokeOpacity',
  'strokeWidth',
  'transform',
  'transformBox',
  'transformOrigin',
])

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

function parseStyleAttribute(style: string): Record<string, string> {
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

function filterSafeStyleProperties(style: string): React.CSSProperties | undefined {
  const parsedStyle = parseStyleAttribute(style)
  const safeEntries = Object.entries(parsedStyle)
    .filter(([property]) => SAFE_STYLE_PROPERTIES.has(property))

  return safeEntries.length > 0 ? Object.fromEntries(safeEntries) : undefined
}

function isSafeSvgAttribute(name: string): boolean {
  return SAFE_SVG_ATTRIBUTES.has(name) || name.startsWith('aria-')
}

function getElementProps(element: Element): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  for (const { name, value } of Array.from(element.attributes)) {
    if (name === 'style') {
      const safeStyle = filterSafeStyleProperties(value)
      if (safeStyle) props.style = safeStyle
      continue
    }

    if (name === 'class') continue

    const reactName = toReactAttributeName(name)
    if (!isSafeSvgAttribute(reactName)) continue
    props[reactName] = value
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
  const sanitized = svg
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')

  return sanitized.replace(/<svg\b[^>]*>/i, (tag) =>
    tag.replace(/\s+(width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ''),
  )
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
