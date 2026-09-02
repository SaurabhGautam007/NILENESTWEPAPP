import React from "react";

/**
 * NileNest brand mark & lockups.
 * The client-provided original logo asset is served at 1x/2x/3x for retina crispness.
 */
const LOGO_1X = "/nilenest-logo.png?v=3";
const LOGO_2X = "/nilenest-logo@2x.png?v=3";
const LOGO_3X = "/nilenest-logo@3x.png?v=3";
const LOGO_SRCSET = `${LOGO_1X} 1x, ${LOGO_2X} 2x, ${LOGO_3X} 3x`;

const commonImgProps = {
  src: LOGO_1X,
  srcSet: LOGO_SRCSET,
  draggable: "false",
  alt: "NileNest",
  loading: "eager",
  decoding: "sync",
  style: { imageRendering: "-webkit-optimize-contrast" },
};

export const BrandMark = ({ className = "h-10", title = "NileNest" }) => (
  <img {...commonImgProps} alt={title} className={`${className} w-auto object-contain select-none`} />
);

/** Full lockup — for footers, splash, order confirmations. */
export const Logo = ({ className = "" }) => (
  <div className={`inline-flex items-center justify-center ${className}`}>
    <img {...commonImgProps} className="h-24 md:h-28 w-auto object-contain select-none" />
  </div>
);

/** Header lockup — the same asset at a larger height. */
export const LogoHorizontal = ({ className = "" }) => (
  <img
    {...commonImgProps}
    className={`h-20 sm:h-24 md:h-28 lg:h-32 w-auto object-contain select-none ${className}`}
  />
);

export default Logo;
