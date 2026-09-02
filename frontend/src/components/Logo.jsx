import React from "react";

/**
 * NileNest brand mark — two mirrored tea leaves rising above a terracotta arc.
 * Pure inline SVG. Scales cleanly at any size.
 */
export const BrandMark = ({ className = "w-10 h-10", title = "NileNest" }) => (
  <svg
    role="img"
    aria-label={title}
    viewBox="0 0 120 74"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="nn-leaf" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#9CC757" />
        <stop offset="55%" stopColor="#5FA23A" />
        <stop offset="100%" stopColor="#2F7A28" />
      </linearGradient>
      <linearGradient id="nn-arc" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#7A1F1F" stopOpacity="0.6" />
        <stop offset="50%" stopColor="#8E2B2B" />
        <stop offset="100%" stopColor="#7A1F1F" stopOpacity="0.6" />
      </linearGradient>
      <symbol id="nn-leaf-shape" viewBox="-20 -30 40 60">
        <path
          d="M 0 -28 C 12 -20 16 12 0 28 C -16 12 -12 -20 0 -28 Z"
          fill="url(#nn-leaf)"
        />
        {/* central vein */}
        <path d="M 0 -26 L 0 26" stroke="#F4FBE9" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
        {/* left veins */}
        <path d="M 0 -16 Q -6 -10 -10 -3" stroke="#F4FBE9" strokeWidth="0.7" fill="none" opacity="0.75" strokeLinecap="round" />
        <path d="M 0 -3 Q -6 3 -11 10" stroke="#F4FBE9" strokeWidth="0.7" fill="none" opacity="0.75" strokeLinecap="round" />
        <path d="M 0 10 Q -5 15 -8 20" stroke="#F4FBE9" strokeWidth="0.7" fill="none" opacity="0.75" strokeLinecap="round" />
        {/* right veins */}
        <path d="M 0 -16 Q 6 -10 10 -3" stroke="#F4FBE9" strokeWidth="0.7" fill="none" opacity="0.75" strokeLinecap="round" />
        <path d="M 0 -3 Q 6 3 11 10" stroke="#F4FBE9" strokeWidth="0.7" fill="none" opacity="0.75" strokeLinecap="round" />
        <path d="M 0 10 Q 5 15 8 20" stroke="#F4FBE9" strokeWidth="0.7" fill="none" opacity="0.75" strokeLinecap="round" />
      </symbol>
    </defs>

    {/* Terracotta arc — thin crescent, tapered at both ends */}
    <path
      d="M 8 55 Q 60 34 112 55 Q 60 46 8 55 Z"
      fill="url(#nn-arc)"
    />

    {/* Left leaf, angled outward */}
    <g transform="translate(52 30) rotate(-26)">
      <use href="#nn-leaf-shape" x="-20" y="-30" width="40" height="60" />
    </g>
    {/* Right leaf, mirrored */}
    <g transform="translate(68 30) rotate(26)">
      <use href="#nn-leaf-shape" x="-20" y="-30" width="40" height="60" />
    </g>
  </svg>
);

/**
 * Full lockup — mark above wordmark. Use for footers, splash, order confirmations.
 */
export const Logo = ({ tone = "dark", className = "" }) => {
  const textColor = tone === "light" ? "text-primary-foreground" : "text-primary";
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <BrandMark className="w-24 h-16" />
      <div className={`font-display font-bold uppercase tracking-[0.28em] text-2xl ${textColor} mt-1`}>
        NileNest
      </div>
    </div>
  );
};

/**
 * Horizontal lockup — mark left, wordmark right. Use for header.
 */
export const LogoHorizontal = ({ className = "" }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <BrandMark className="w-11 h-8 sm:w-12 sm:h-9" />
    <span className="font-display font-bold uppercase tracking-[0.22em] text-lg sm:text-xl text-primary leading-none">
      NileNest
    </span>
  </div>
);

export default Logo;
