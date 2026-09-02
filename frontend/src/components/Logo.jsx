import React from "react";

/**
 * NileNest brand mark — two mirrored tea leaves rising above a maroon arc.
 * SVG-only, scales to any size crisply.
 * viewBox chosen to give generous headroom for the leaves & tight breathing room around the arc.
 */
export const BrandMark = ({ className = "w-10 h-10", title = "NileNest" }) => (
  <svg
    role="img"
    aria-label={title}
    viewBox="0 0 220 130"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="nn-leafGrad" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stopColor="#B5D66E" />
        <stop offset="45%" stopColor="#7BBA3B" />
        <stop offset="100%" stopColor="#2E7A22" />
      </linearGradient>
      <symbol id="nn-leaf" viewBox="-32 -52 64 100">
        {/* Pointed-top, rounded-base tea leaf */}
        <path
          d="M 0 -48 C 22 -34 26 20 0 46 C -26 20 -22 -34 0 -48 Z"
          fill="url(#nn-leafGrad)"
        />
        {/* Central vein */}
        <path
          d="M 0 -44 L 0 42"
          stroke="#F6FBEA"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.92"
        />
        {/* Left veins */}
        <path d="M 0 -28 Q -10 -20 -16 -8" stroke="#F6FBEA" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 0 -12 Q -12 -4 -20 8" stroke="#F6FBEA" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 0 6 Q -10 14 -16 24" stroke="#F6FBEA" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 0 22 Q -7 28 -10 34" stroke="#F6FBEA" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8" />
        {/* Right veins */}
        <path d="M 0 -28 Q 10 -20 16 -8" stroke="#F6FBEA" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 0 -12 Q 12 -4 20 8" stroke="#F6FBEA" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 0 6 Q 10 14 16 24" stroke="#F6FBEA" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 0 22 Q 7 28 10 34" stroke="#F6FBEA" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8" />
      </symbol>
    </defs>

    {/* Maroon crescent arc — solid, thin, tapered at both ends, slight upward curve */}
    <path
      d="M 20 100 Q 110 62 200 100 Q 110 80 20 100 Z"
      fill="#8B1B1F"
    />

    {/* Left leaf */}
    <g transform="translate(96 58) rotate(-22)">
      <use href="#nn-leaf" x="-32" y="-52" width="64" height="100" />
    </g>
    {/* Right leaf */}
    <g transform="translate(124 58) rotate(22)">
      <use href="#nn-leaf" x="-32" y="-52" width="64" height="100" />
    </g>
  </svg>
);

const wordmarkStyle = { fontFamily: "'Playfair Display', 'Cormorant Garamond', serif", fontWeight: 700 };

/**
 * Full lockup — mark above wordmark. Use for footers, splash, order confirmations.
 */
export const Logo = ({ tone = "dark", className = "" }) => {
  const textColor = tone === "light" ? "text-primary-foreground" : "text-black";
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <BrandMark className="w-32 h-20 md:w-36 md:h-24" />
      <div
        className={`uppercase tracking-[0.12em] text-3xl md:text-4xl ${textColor} leading-none -mt-1`}
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
    <BrandMark className="w-12 h-9 sm:w-14 sm:h-10" />
    <span
      className="uppercase tracking-[0.1em] text-lg sm:text-xl text-black leading-none"
      style={wordmarkStyle}
    >
      NileNest
    </span>
  </div>
);

export default Logo;
