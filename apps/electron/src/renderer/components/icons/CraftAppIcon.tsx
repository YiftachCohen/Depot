import depotLogo from "@/assets/craft_logo_c.svg"

interface DepotAppIconProps {
  className?: string
  size?: number
}

/**
 * DepotAppIcon - Displays the Depot logo (segmented "D" icon)
 */
export function DepotAppIcon({ className, size = 64 }: DepotAppIconProps) {
  return (
    <img
      src={depotLogo}
      alt="Depot"
      width={size}
      height={size}
      className={className}
    />
  )
}

/** @deprecated Use DepotAppIcon instead */
export const CraftAppIcon = DepotAppIcon
