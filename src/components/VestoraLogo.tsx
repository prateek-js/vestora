import React from 'react';

interface VestoraLogoProps {
  size?: number;
  className?: string;
}

/**
 * Faceted white-and-emerald geometric V crest on a deep midnight obsidian tile,
 * matching Vestora Wealth's launch icon and storefront emblem.
 */
export const VestoraLogo: React.FC<VestoraLogoProps> = ({ size = 32, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill="#0A0D1C" />
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="13"
        stroke="#02C37E"
        strokeOpacity="0.32"
        strokeWidth="1.5"
      />
      {/* Left wing: crisp ivory face + ice silver inner bevel */}
      <polygon points="13,19 22,19 30,42 28,49" fill="#F8FAFC" />
      <polygon points="22,19 27,22 31,34 30,42" fill="#CBD5E1" />
      {/* Right wing: layered emerald prism planes */}
      <polygon points="31,34 41,17 44,24 32,42" fill="#02A26D" />
      <polygon points="41,17 51,12 44,24" fill="#34D99B" />
      <polygon points="28,49 30,42 44,24 51,12 31,49" fill="#02C37E" />
    </svg>
  );
};
