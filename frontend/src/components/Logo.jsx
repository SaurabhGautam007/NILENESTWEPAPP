import React from "react";

/**
 * NileNest brand mark — two curved tea leaves emerging from a common base,
 * angled outward and upward, above a solid maroon crescent arc.
 * Redrawn to match the reference: pointed tip, rounded base, asymmetric
 * outer/inner curve so the petals feel like real leaves — not eye-shaped.
 */
export const BrandMark = ({ className = "w-10 h-10", title = "NileNest" }) => (
  <svg
    role="img"
    aria-label={title}
    viewBox="0 0 240 140"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="nn-leafGrad" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stopColor="#BDDD73" />
        <stop offset="45%" stopColor="#7DBC3B" />
        <stop offset="100%" stopColor="#2E7A22" />
      </linearGradient>

      {/* One leaf, drawn upright with base at (0,0) and tip at (0,-80).
          Outer edge (right side) is more bowed than inner edge. Rotate to place. */}
      <symbol id="nn-leaf" viewBox="-30 -84 60 96">
        <path
          d="M 0 0
             C -6 -8 -18 -18 -22 -34
             C -24 -50 -14 -70 0 -80
             C 14 -70 24 -50 22 -34
             C 18 -18 6 -8 0 0 Z"
          fill="url(#nn-leafGrad)"
        />
        {/* Central vein */}
        <path
          d="M 0 -2 L 0 -78"
          stroke="#F4FBE9"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.95"
        />
        {/* Side veins — 4 pairs, angled up-and-out */}
        <path d="M 0 -20 Q -8 -26 -14 -32" stroke="#F4FBE9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 0 -36 Q -10 -42 -18 -48" stroke="#F4FBE9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 0 -52 Q -9 -58 -14 -64" stroke="#F4FBE9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 0 -66 Q -6 -70 -9 -74" stroke="#F4FBE9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8" />
        <path d="M 0 -20 Q 8 -26 14 -32" stroke="#F4FBE9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 0 -36 Q 10 -42 18 -48" stroke="#F4FBE9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 0 -52 Q 9 -58 14 -64" stroke="#F4FBE9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 0 -66 Q 6 -70 9 -74" stroke="#F4FBE9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8" />
      </symbol>
    </defs>

    {/* Solid maroon crescent arc — thin, tapered at both ends, peaked in the middle */}
    <path
      d="M 24 108 Q 120 70 216 108 Q 120 88 24 108 Z"
      fill="#8B1B1F"
    />

    {/* Left leaf — rotated LEFT so its tip points up-left */}
    <g transform="translate(112 82) rotate(-22)">
      <use href="#nn-leaf" width="60" height="96" x="-30" y="-84" />
    </g>
    {/* Right leaf — rotated RIGHT so its tip points up-right */}
    <g transform="translate(128 82) rotate(22)">
      <use href="#nn-leaf" width="60" height="96" x="-30" y="-84" />
    </g>
  </svg>
);

const wordmarkStyle = {
  fontFamily: "'Cinzel', 'Playfair Display', 'Cormorant Garamond', serif",
  fontWeight: 700,
  letterSpacing: "0.04em",
};

/**
 * Full lockup — mark above wordmark. Use for footers, splash, order confirmations.
 */
export const Logo = ({ tone = "dark", className = "" }) => {
  const textColor = tone === "light" ? "text-primary-foreground" : "text-black";
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <BrandMark className="w-36 h-24 md:w-40 md:h-28" />
      <div
        className={`uppercase text-3xl md:text-4xl ${textColor} leading-none mt-1`}
        style={wordmarkStyle}
      >
        NileNest
      </div>
    </div>
  );
};

/**
 * Horizontal lockup — mark left, wordmark right. Header use.
 */
export const LogoHorizontal = ({ className = "" }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <BrandMark className="w-14 h-10 sm:w-16 sm:h-11" />
    <span
      className="uppercase text-lg sm:text-xl text-black leading-none"
      style={wordmarkStyle}
    >
      NileNest
    </span>
  </div>
);

export default Logo;
