/**
 * Depot Icon Registry
 *
 * All available app icon variations as inline SVG components.
 * The selected icon is stored in localStorage and rendered by CraftAgentsSymbol.
 */

import type { ReactNode } from 'react'

export interface DepotIconDef {
  id: string
  name: string
  /** Inline SVG for the toolbar/symbol (24x24 viewBox) */
  symbol: (className?: string) => ReactNode
  /** Inline SVG for the icon picker preview (no className, fixed size) */
  preview: () => ReactNode
  /** SVG string for generating PNGs (512x512 viewBox) */
  svgString512: string
}

// ─── Shared D-shape path (24x24) ───
const D_OUTER = 'M4,2.5 L13,2.5 C18,2.5 21.5,6.5 21.5,12 C21.5,17.5 18,21.5 13,21.5 L4,21.5 Z'
const D_INNER = 'M8.5,7 L12.5,7 C15,7 17,9 17,12 C17,15 15,17 12.5,17 L8.5,17 Z'
const D_PATH = `${D_OUTER} ${D_INNER}`

// ─── Shared D-shape path (512x512) ───
const D512_OUTER = 'M128,100 L270,100 C350,100 400,160 400,256 C400,352 350,412 270,412 L128,412 Z'
const D512_INNER = 'M190,170 L260,170 C310,170 335,200 335,256 C335,312 310,342 260,342 L190,342 Z'
const D512 = `${D512_OUTER} ${D512_INNER}`

export const DEPOT_ICONS: DepotIconDef[] = [
  // ─── DEFAULT: Starburst Grid ───
  {
    id: 'starburst-grid',
    name: 'Starburst Grid',
    symbol: (className) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="sg-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#sg-glow)"/>
        <rect x="2.5" y="2.5" width="5.2" height="5.2" rx="1.2" fill="#a78bfa" opacity="0.6"/>
        <rect x="9.4" y="2.5" width="5.2" height="5.2" rx="1.2" fill="#818cf8" opacity="0.75"/>
        <rect x="16.3" y="2.5" width="5.2" height="5.2" rx="1.2" fill="#a78bfa" opacity="0.6"/>
        <rect x="2.5" y="9.4" width="5.2" height="5.2" rx="1.2" fill="#818cf8" opacity="0.75"/>
        <rect x="9.4" y="9.4" width="5.2" height="5.2" rx="1.4" fill="#22d3ee"/>
        <rect x="9.4" y="9.4" width="5.2" height="5.2" rx="1.4" fill="#fff" opacity="0.15"/>
        <rect x="9.4" y="9.4" width="5.2" height="2.8" rx="1.4" fill="#fff" opacity="0.1"/>
        <rect x="16.3" y="9.4" width="5.2" height="5.2" rx="1.2" fill="#818cf8" opacity="0.75"/>
        <rect x="2.5" y="16.3" width="5.2" height="5.2" rx="1.2" fill="#a78bfa" opacity="0.6"/>
        <rect x="9.4" y="16.3" width="5.2" height="5.2" rx="1.2" fill="#818cf8" opacity="0.75"/>
        <rect x="16.3" y="16.3" width="5.2" height="5.2" rx="1.2" fill="#a78bfa" opacity="0.6"/>
      </svg>
    ),
    preview: () => (
      <svg width="64" height="64" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="sg-p-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="256" cy="256" r="200" fill="url(#sg-p-glow)"/>
        <rect x="108" y="108" width="80" height="80" rx="14" fill="#a78bfa" opacity="0.6"/>
        <rect x="216" y="108" width="80" height="80" rx="14" fill="#818cf8" opacity="0.75"/>
        <rect x="324" y="108" width="80" height="80" rx="14" fill="#a78bfa" opacity="0.6"/>
        <rect x="108" y="216" width="80" height="80" rx="14" fill="#818cf8" opacity="0.75"/>
        <rect x="216" y="216" width="80" height="80" rx="18" fill="#22d3ee"/>
        <rect x="216" y="216" width="80" height="80" rx="18" fill="#fff" opacity="0.15"/>
        <rect x="216" y="216" width="80" height="44" rx="18" fill="#fff" opacity="0.1"/>
        <rect x="324" y="216" width="80" height="80" rx="14" fill="#818cf8" opacity="0.75"/>
        <rect x="108" y="324" width="80" height="80" rx="14" fill="#a78bfa" opacity="0.6"/>
        <rect x="216" y="324" width="80" height="80" rx="14" fill="#818cf8" opacity="0.75"/>
        <rect x="324" y="324" width="80" height="80" rx="14" fill="#a78bfa" opacity="0.6"/>
      </svg>
    ),
    svgString512: `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(30.72, 30.72) scale(0.88)">
      <rect width="512" height="512" rx="112" fill="#0c0a1d"/>
      <defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#06b6d4" stop-opacity="0.4"/><stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/></radialGradient></defs>
      <circle cx="256" cy="256" r="200" fill="url(#g)"/>
      <rect x="108" y="108" width="80" height="80" rx="14" fill="#a78bfa" opacity="0.6"/>
      <rect x="216" y="108" width="80" height="80" rx="14" fill="#818cf8" opacity="0.75"/>
      <rect x="324" y="108" width="80" height="80" rx="14" fill="#a78bfa" opacity="0.6"/>
      <rect x="108" y="216" width="80" height="80" rx="14" fill="#818cf8" opacity="0.75"/>
      <rect x="216" y="216" width="80" height="80" rx="18" fill="#22d3ee"/>
      <rect x="216" y="216" width="80" height="80" rx="18" fill="#fff" opacity="0.15"/>
      <rect x="216" y="216" width="80" height="44" rx="18" fill="#fff" opacity="0.1"/>
      <rect x="324" y="216" width="80" height="80" rx="14" fill="#818cf8" opacity="0.75"/>
      <rect x="108" y="324" width="80" height="80" rx="14" fill="#a78bfa" opacity="0.6"/>
      <rect x="216" y="324" width="80" height="80" rx="14" fill="#818cf8" opacity="0.75"/>
      <rect x="324" y="324" width="80" height="80" rx="14" fill="#a78bfa" opacity="0.6"/>
      </g>
    </svg>`,
  },

  // ─── Gradient D ───
  {
    id: 'gradient-d',
    name: 'Gradient D',
    symbol: (className) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gd-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa"/><stop offset="50%" stopColor="#6366f1"/><stop offset="100%" stopColor="#06b6d4"/>
          </linearGradient>
        </defs>
        <path d={D_PATH} fill="url(#gd-g)" fillRule="evenodd"/>
      </svg>
    ),
    preview: () => (
      <svg width="64" height="64" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gd-p" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa"/><stop offset="50%" stopColor="#6366f1"/><stop offset="100%" stopColor="#06b6d4"/>
          </linearGradient>
        </defs>
        <path d={D512} fill="url(#gd-p)" fillRule="evenodd"/>
      </svg>
    ),
    svgString512: `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(30.72, 30.72) scale(0.88)">
      <rect width="512" height="512" rx="112" fill="#0c0a1d"/>
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#a78bfa"/><stop offset="50%" stop-color="#6366f1"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs>
      <path d="${D512}" fill="url(#g)" fill-rule="evenodd"/>
      </g>
    </svg>`,
  },

  // ─── Split Arc ───
  {
    id: 'split-arc',
    name: 'Split Arc',
    symbol: (className) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="3" width="4.5" height="18" rx="1.2" fill="#6366f1"/>
        <path d="M10,3 L13,3 C18,3 21.5,7 21.5,12 C21.5,17 18,21 13,21 L10,21 L10,17.5 L12.8,17.5 C16,17.5 18,15.5 18,12 C18,8.5 16,6.5 12.8,6.5 L10,6.5 Z" fill="#06b6d4"/>
        <circle cx="10" cy="12" r="1.2" fill="#a78bfa"/>
      </svg>
    ),
    preview: () => (
      <svg width="64" height="64" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect x="128" y="100" width="60" height="312" rx="14" fill="#6366f1"/>
        <path d="M210,100 L270,100 C355,100 405,165 405,256 C405,347 355,412 270,412 L210,412 L210,340 L265,340 C315,340 340,310 340,256 C340,202 315,172 265,172 L210,172 Z" fill="#06b6d4"/>
        <circle cx="210" cy="256" r="10" fill="#a78bfa"/>
      </svg>
    ),
    svgString512: `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(30.72, 30.72) scale(0.88)">
      <rect width="512" height="512" rx="112" fill="#0c0a1d"/>
      <rect x="128" y="100" width="60" height="312" rx="14" fill="#6366f1"/>
      <path d="M210,100 L270,100 C355,100 405,165 405,256 C405,347 355,412 270,412 L210,412 L210,340 L265,340 C315,340 340,310 340,256 C340,202 315,172 265,172 L210,172 Z" fill="#06b6d4"/>
      <circle cx="210" cy="256" r="10" fill="#a78bfa"/>
      </g>
    </svg>`,
  },

  // ─── Pixel Art D ───
  {
    id: 'pixel-art-d',
    name: 'Pixel Art D',
    symbol: (className) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="3" width="3" height="3" fill="#818cf8"/>
        <rect x="7" y="3" width="3" height="3" fill="#818cf8"/>
        <rect x="10" y="3" width="3" height="3" fill="#818cf8"/>
        <rect x="13" y="3" width="3" height="3" fill="#6366f1"/>
        <rect x="4" y="6" width="3" height="3" fill="#818cf8"/>
        <rect x="16" y="6" width="3" height="3" fill="#6366f1"/>
        <rect x="4" y="9" width="3" height="3" fill="#6366f1"/>
        <rect x="19" y="9" width="3" height="3" fill="#4f46e5"/>
        <rect x="4" y="12" width="3" height="3" fill="#6366f1"/>
        <rect x="19" y="12" width="3" height="3" fill="#06b6d4"/>
        <rect x="4" y="15" width="3" height="3" fill="#4f46e5"/>
        <rect x="16" y="15" width="3" height="3" fill="#3b82f6"/>
        <rect x="4" y="18" width="3" height="3" fill="#3b82f6"/>
        <rect x="7" y="18" width="3" height="3" fill="#3b82f6"/>
        <rect x="10" y="18" width="3" height="3" fill="#06b6d4"/>
        <rect x="13" y="18" width="3" height="3" fill="#06b6d4"/>
      </svg>
    ),
    preview: () => (
      <svg width="64" height="64" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect x="128" y="96" width="48" height="48" fill="#818cf8"/>
        <rect x="176" y="96" width="48" height="48" fill="#818cf8"/>
        <rect x="224" y="96" width="48" height="48" fill="#818cf8"/>
        <rect x="272" y="96" width="48" height="48" fill="#6366f1"/>
        <rect x="128" y="144" width="48" height="48" fill="#818cf8"/>
        <rect x="320" y="144" width="48" height="48" fill="#6366f1"/>
        <rect x="128" y="192" width="48" height="48" fill="#6366f1"/>
        <rect x="368" y="192" width="48" height="48" fill="#4f46e5"/>
        <rect x="128" y="240" width="48" height="48" fill="#6366f1"/>
        <rect x="368" y="240" width="48" height="48" fill="#06b6d4"/>
        <rect x="128" y="288" width="48" height="48" fill="#4f46e5"/>
        <rect x="368" y="288" width="48" height="48" fill="#06b6d4"/>
        <rect x="128" y="336" width="48" height="48" fill="#4f46e5"/>
        <rect x="320" y="336" width="48" height="48" fill="#3b82f6"/>
        <rect x="128" y="384" width="48" height="48" fill="#3b82f6"/>
        <rect x="176" y="384" width="48" height="48" fill="#3b82f6"/>
        <rect x="224" y="384" width="48" height="48" fill="#06b6d4"/>
        <rect x="272" y="384" width="48" height="48" fill="#06b6d4"/>
      </svg>
    ),
    svgString512: `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(30.72, 30.72) scale(0.88)">
      <rect width="512" height="512" rx="112" fill="#0c0a1d"/>
      <rect x="128" y="96" width="48" height="48" fill="#818cf8"/>
      <rect x="176" y="96" width="48" height="48" fill="#818cf8"/>
      <rect x="224" y="96" width="48" height="48" fill="#818cf8"/>
      <rect x="272" y="96" width="48" height="48" fill="#6366f1"/>
      <rect x="128" y="144" width="48" height="48" fill="#818cf8"/>
      <rect x="320" y="144" width="48" height="48" fill="#6366f1"/>
      <rect x="128" y="192" width="48" height="48" fill="#6366f1"/>
      <rect x="368" y="192" width="48" height="48" fill="#4f46e5"/>
      <rect x="128" y="240" width="48" height="48" fill="#6366f1"/>
      <rect x="368" y="240" width="48" height="48" fill="#06b6d4"/>
      <rect x="128" y="288" width="48" height="48" fill="#4f46e5"/>
      <rect x="368" y="288" width="48" height="48" fill="#06b6d4"/>
      <rect x="128" y="336" width="48" height="48" fill="#4f46e5"/>
      <rect x="320" y="336" width="48" height="48" fill="#3b82f6"/>
      <rect x="128" y="384" width="48" height="48" fill="#3b82f6"/>
      <rect x="176" y="384" width="48" height="48" fill="#3b82f6"/>
      <rect x="224" y="384" width="48" height="48" fill="#06b6d4"/>
      <rect x="272" y="384" width="48" height="48" fill="#06b6d4"/>
      </g>
    </svg>`,
  },

  // ─── Tile Cascade ───
  {
    id: 'tile-cascade',
    name: 'Tile Cascade',
    symbol: (className) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="11" height="8" rx="1.8" fill="#4f46e5" opacity="0.5"/>
        <rect x="5" y="5.5" width="11" height="8" rx="1.8" fill="#6366f1" opacity="0.65"/>
        <rect x="8" y="9" width="11" height="8" rx="1.8" fill="#818cf8" opacity="0.8"/>
        <rect x="11" y="12.5" width="11" height="8" rx="1.8" fill="#06b6d4"/>
        <circle cx="16.5" cy="16.5" r="1.8" fill="#fff" opacity="0.9"/>
        <circle cx="16.5" cy="16.5" r="0.8" fill="#06b6d4"/>
      </svg>
    ),
    preview: () => (
      <svg width="64" height="64" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect x="90" y="90" width="200" height="140" rx="24" fill="#4f46e5" opacity="0.5"/>
        <rect x="140" y="150" width="200" height="140" rx="24" fill="#6366f1" opacity="0.65"/>
        <rect x="190" y="210" width="200" height="140" rx="24" fill="#818cf8" opacity="0.8"/>
        <rect x="240" y="270" width="200" height="140" rx="24" fill="#06b6d4"/>
        <circle cx="340" cy="340" r="20" fill="#fff" opacity="0.9"/>
        <circle cx="340" cy="340" r="9" fill="#06b6d4"/>
      </svg>
    ),
    svgString512: `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(30.72, 30.72) scale(0.88)">
      <rect width="512" height="512" rx="112" fill="#0c0a1d"/>
      <rect x="90" y="90" width="200" height="140" rx="24" fill="#4f46e5" opacity="0.5"/>
      <rect x="140" y="150" width="200" height="140" rx="24" fill="#6366f1" opacity="0.65"/>
      <rect x="190" y="210" width="200" height="140" rx="24" fill="#818cf8" opacity="0.8"/>
      <rect x="240" y="270" width="200" height="140" rx="24" fill="#06b6d4"/>
      <circle cx="340" cy="340" r="20" fill="#fff" opacity="0.9"/>
      <circle cx="340" cy="340" r="9" fill="#06b6d4"/>
      </g>
    </svg>`,
  },
]

export const DEFAULT_ICON_ID = 'starburst-grid'

export function getIconById(id: string): DepotIconDef {
  return DEPOT_ICONS.find(i => i.id === id) ?? DEPOT_ICONS[0]
}

const DARK_BG = '#0c0a1d'
const LIGHT_BG = '#f0f0f0'

/** Return the 512x512 SVG string with the appropriate background for the current theme */
export function getIconSvg512(icon: DepotIconDef, isDark: boolean): string {
  if (isDark) return icon.svgString512
  return icon.svgString512.replaceAll(DARK_BG, LIGHT_BG)
}
