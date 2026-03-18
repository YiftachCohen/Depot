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

  // ─── Petal Hub ───
  {
    id: 'petal-hub',
    name: 'Petal Hub',
    symbol: (className) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12,11 C12,8 10,4.5 7,4.5 C5.5,4.5 5.5,5.5 5.5,7 C5.5,9.5 8.5,11 11,11 Z" fill="#a78bfa"/>
        <path d="M13,12 C16,12 19.5,10 19.5,7 C19.5,5.5 18.5,5.5 17,5.5 C14.5,5.5 13,8.5 13,11 Z" fill="#6366f1"/>
        <path d="M12,13 C12,16 14,19.5 17,19.5 C18.5,19.5 18.5,18.5 18.5,17 C18.5,14.5 15.5,13 13,13 Z" fill="#3b82f6"/>
        <path d="M11,12 C8,12 4.5,14 4.5,17 C4.5,18.5 5.5,18.5 7,18.5 C9.5,18.5 11,15.5 11,13 Z" fill="#06b6d4"/>
        <circle cx="12" cy="12" r="2.2" fill="#0c0a1d"/>
        <circle cx="12" cy="12" r="1.3" fill="#818cf8"/>
        <circle cx="12" cy="12" r="0.6" fill="#fff"/>
      </svg>
    ),
    preview: () => (
      <svg width="64" height="64" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <path d="M256,240 C256,180 210,110 150,110 C110,110 110,150 110,190 C110,240 180,240 240,240 Z" fill="#a78bfa"/>
        <path d="M272,256 C332,256 402,210 402,150 C402,110 362,110 322,110 C272,110 272,180 272,240 Z" fill="#6366f1"/>
        <path d="M256,272 C256,332 302,402 362,402 C402,402 402,362 402,322 C402,272 332,272 272,272 Z" fill="#3b82f6"/>
        <path d="M240,256 C180,256 110,302 110,362 C110,402 150,402 190,402 C240,402 240,332 240,272 Z" fill="#06b6d4"/>
        <circle cx="256" cy="256" r="30" fill="#0c0a1d"/>
        <circle cx="256" cy="256" r="16" fill="#818cf8"/>
        <circle cx="256" cy="256" r="7" fill="#fff"/>
      </svg>
    ),
    svgString512: `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(30.72, 30.72) scale(0.88)">
      <rect width="512" height="512" rx="112" fill="#0c0a1d"/>
      <path d="M256,240 C256,180 210,110 150,110 C110,110 110,150 110,190 C110,240 180,240 240,240 Z" fill="#a78bfa"/>
      <path d="M272,256 C332,256 402,210 402,150 C402,110 362,110 322,110 C272,110 272,180 272,240 Z" fill="#6366f1"/>
      <path d="M256,272 C256,332 302,402 362,402 C402,402 402,362 402,322 C402,272 332,272 272,272 Z" fill="#3b82f6"/>
      <path d="M240,256 C180,256 110,302 110,362 C110,402 150,402 190,402 C240,402 240,332 240,272 Z" fill="#06b6d4"/>
      <circle cx="256" cy="256" r="30" fill="#0c0a1d"/>
      <circle cx="256" cy="256" r="16" fill="#818cf8"/>
      <circle cx="256" cy="256" r="7" fill="#fff"/>
      </g>
    </svg>`,
  },

  // ─── Orbital Hub ───
  {
    id: 'orbital-hub',
    name: 'Orbital Hub',
    symbol: (className) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="12" cy="12" rx="9" ry="3" fill="none" stroke="#818cf8" strokeWidth="0.8" opacity="0.5"/>
        <ellipse cx="12" cy="12" rx="9" ry="3" fill="none" stroke="#6366f1" strokeWidth="0.8" opacity="0.5" transform="rotate(60 12 12)"/>
        <ellipse cx="12" cy="12" rx="9" ry="3" fill="none" stroke="#06b6d4" strokeWidth="0.8" opacity="0.5" transform="rotate(-60 12 12)"/>
        <circle cx="12" cy="12" r="3" fill="#4f46e5"/>
        <circle cx="12" cy="12" r="1.5" fill="#818cf8"/>
        <circle cx="19" cy="7.5" r="1.3" fill="#818cf8"/><circle cx="19" cy="7.5" r="0.5" fill="#fff"/>
        <circle cx="5" cy="16.5" r="1.3" fill="#06b6d4"/><circle cx="5" cy="16.5" r="0.5" fill="#fff"/>
        <circle cx="17.5" cy="17.5" r="1.3" fill="#6366f1"/><circle cx="17.5" cy="17.5" r="0.5" fill="#fff"/>
      </svg>
    ),
    preview: () => (
      <svg width="64" height="64" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="256" cy="256" rx="180" ry="60" fill="none" stroke="#818cf8" strokeWidth="5" opacity="0.4"/>
        <ellipse cx="256" cy="256" rx="180" ry="60" fill="none" stroke="#6366f1" strokeWidth="5" opacity="0.4" transform="rotate(60 256 256)"/>
        <ellipse cx="256" cy="256" rx="180" ry="60" fill="none" stroke="#06b6d4" strokeWidth="5" opacity="0.4" transform="rotate(-60 256 256)"/>
        <circle cx="256" cy="256" r="52" fill="#4f46e5"/>
        <circle cx="256" cy="256" r="28" fill="#6366f1"/>
        <circle cx="256" cy="256" r="12" fill="#c7d2fe"/>
        <circle cx="400" cy="173" r="14" fill="#818cf8"/><circle cx="400" cy="173" r="5" fill="#fff"/>
        <circle cx="112" cy="339" r="14" fill="#06b6d4"/><circle cx="112" cy="339" r="5" fill="#fff"/>
        <circle cx="370" cy="370" r="14" fill="#6366f1"/><circle cx="370" cy="370" r="5" fill="#fff"/>
      </svg>
    ),
    svgString512: `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(30.72, 30.72) scale(0.88)">
      <rect width="512" height="512" rx="112" fill="#0c0a1d"/>
      <ellipse cx="256" cy="256" rx="180" ry="60" fill="none" stroke="#818cf8" stroke-width="5" opacity="0.4"/>
      <ellipse cx="256" cy="256" rx="180" ry="60" fill="none" stroke="#6366f1" stroke-width="5" opacity="0.4" transform="rotate(60 256 256)"/>
      <ellipse cx="256" cy="256" rx="180" ry="60" fill="none" stroke="#06b6d4" stroke-width="5" opacity="0.4" transform="rotate(-60 256 256)"/>
      <circle cx="256" cy="256" r="52" fill="#4f46e5"/>
      <circle cx="256" cy="256" r="28" fill="#6366f1"/>
      <circle cx="256" cy="256" r="12" fill="#c7d2fe"/>
      <circle cx="400" cy="173" r="14" fill="#818cf8"/><circle cx="400" cy="173" r="5" fill="#fff"/>
      <circle cx="112" cy="339" r="14" fill="#06b6d4"/><circle cx="112" cy="339" r="5" fill="#fff"/>
      <circle cx="370" cy="370" r="14" fill="#6366f1"/><circle cx="370" cy="370" r="5" fill="#fff"/>
      </g>
    </svg>`,
  },

  // ─── Signal Wave ───
  {
    id: 'signal-wave',
    name: 'Signal Wave',
    symbol: (className) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2.5" y="10" width="2.2" height="4" rx="0.8" fill="#a78bfa" opacity="0.5"/>
        <rect x="5.6" y="8.5" width="2.2" height="7" rx="0.8" fill="#a78bfa" opacity="0.6"/>
        <rect x="8.7" y="6.5" width="2.2" height="11" rx="0.8" fill="#818cf8" opacity="0.75"/>
        <rect x="11.8" y="4" width="2.2" height="16" rx="0.9" fill="#6366f1"/>
        <rect x="14.9" y="5" width="2.2" height="14" rx="0.9" fill="#06b6d4"/>
        <rect x="18" y="7" width="2.2" height="10" rx="0.8" fill="#3b82f6" opacity="0.75"/>
        <rect x="21.1" y="9.5" width="2.2" height="5" rx="0.8" fill="#06b6d4" opacity="0.6"/>
        <circle cx="12.9" cy="12" r="1.2" fill="#fff"/>
      </svg>
    ),
    preview: () => (
      <svg width="64" height="64" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect x="72" y="230" width="38" height="52" rx="10" fill="#a78bfa" opacity="0.5"/>
        <rect x="128" y="195" width="38" height="122" rx="10" fill="#a78bfa" opacity="0.6"/>
        <rect x="184" y="155" width="38" height="202" rx="10" fill="#818cf8" opacity="0.75"/>
        <rect x="240" y="105" width="38" height="302" rx="12" fill="#6366f1"/>
        <rect x="296" y="125" width="38" height="262" rx="12" fill="#06b6d4"/>
        <rect x="352" y="165" width="38" height="182" rx="10" fill="#3b82f6" opacity="0.75"/>
        <rect x="408" y="210" width="38" height="92" rx="10" fill="#06b6d4" opacity="0.6"/>
        <circle cx="259" cy="256" r="16" fill="#fff"/>
      </svg>
    ),
    svgString512: `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(30.72, 30.72) scale(0.88)">
      <rect width="512" height="512" rx="112" fill="#0c0a1d"/>
      <rect x="72" y="230" width="38" height="52" rx="10" fill="#a78bfa" opacity="0.5"/>
      <rect x="128" y="195" width="38" height="122" rx="10" fill="#a78bfa" opacity="0.6"/>
      <rect x="184" y="155" width="38" height="202" rx="10" fill="#818cf8" opacity="0.75"/>
      <rect x="240" y="105" width="38" height="302" rx="12" fill="#6366f1"/>
      <rect x="296" y="125" width="38" height="262" rx="12" fill="#06b6d4"/>
      <rect x="352" y="165" width="38" height="182" rx="10" fill="#3b82f6" opacity="0.75"/>
      <rect x="408" y="210" width="38" height="92" rx="10" fill="#06b6d4" opacity="0.6"/>
      <circle cx="259" cy="256" r="16" fill="#fff"/>
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
