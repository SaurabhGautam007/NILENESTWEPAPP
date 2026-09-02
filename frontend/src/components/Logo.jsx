import React from "react";

/**
 * NileNest brand mark & lockups.
 * IMPORTANT: This is the ORIGINAL client-provided logo asset, used as-is.
 * Do not replace with an AI-generated SVG re-creation. Any resize is via width/height only.
 */
const LOGO_SRC = "/nilenest-logo.png?v=2";

export const BrandMark = ({ className = "h-10", title = "NileNest" }) => (
  <img
    src={LOGO_SRC}
    alt={title}
    className={`${className} w-auto object-contain select-none`}
    draggable="false"
  />
);

/**
 * Full lockup — logo image is already stacked (leaves + arc + NILENEST).
 * Use for footers, splash, order confirmations.
 */
export const Logo = ({ className = "" }) => (
  <div className={`inline-flex items-center justify-center ${className}`}>
    <img
      src={LOGO_SRC}
      alt="NileNest"
      className="h-24 md:h-28 w-auto object-contain select-none"
      draggable="false"
    />
  </div>
);

/**
 * Horizontal-space-efficient lockup — the full logo scaled to header height.
 * The reference asset already contains the mark + wordmark, so this is just a size variant.
 */
export const LogoHorizontal = ({ className = "" }) => (
  <img
    src={LOGO_SRC}
    alt="NileNest"
    className={`h-20 sm:h-24 md:h-28 lg:h-32 w-auto object-contain select-none ${className}`}
    draggable="false"
  />
);

export default Logo;
