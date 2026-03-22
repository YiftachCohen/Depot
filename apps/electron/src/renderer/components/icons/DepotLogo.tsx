interface DepotLogoProps {
  className?: string
}

/**
 * Depot pixel art logo - uses accent color from theme
 * Apply text-accent class to get the brand amber color
 *
 * Pixel grid: 15px wide × 13px tall blocks, 8px gap between letters.
 * Letters: D(4col) E(4col) P(4col) O(4col) T(5col) = "DEPOT"
 */
export function DepotLogo({ className }: DepotLogoProps) {
  return (
    <svg
      viewBox="0 0 347 65"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* D */}
      <rect x="0"  y="0"  width="15" height="65" />
      <rect x="15" y="0"  width="30" height="13" />
      <rect x="45" y="13" width="15" height="39" />
      <rect x="15" y="52" width="30" height="13" />

      {/* E */}
      <rect x="68"  y="0"  width="15" height="65" />
      <rect x="83"  y="0"  width="45" height="13" />
      <rect x="83"  y="26" width="30" height="13" />
      <rect x="83"  y="52" width="45" height="13" />

      {/* P */}
      <rect x="136" y="0"  width="15" height="65" />
      <rect x="151" y="0"  width="30" height="13" />
      <rect x="181" y="13" width="15" height="13" />
      <rect x="151" y="26" width="30" height="13" />

      {/* O */}
      <rect x="219" y="0"  width="30" height="13" />
      <rect x="204" y="13" width="15" height="39" />
      <rect x="249" y="13" width="15" height="39" />
      <rect x="219" y="52" width="30" height="13" />

      {/* T */}
      <rect x="272" y="0"  width="75" height="13" />
      <rect x="302" y="13" width="15" height="52" />
    </svg>
  )
}
