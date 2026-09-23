import React from 'react';

export interface LearnSphereLogoProps {
  variant?: 'full' | 'symbol' | 'compact';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: 'dark' | 'light';
  showSubtitle?: boolean;
}

/**
 * Custom Vector SVG Symbol for LearnSphere.
 * Visual concept: Precision sphere with interconnected orbital knowledge pathways
 * forming an integrated "L" and connected intelligence nodes.
 */
export const LearnSphereSymbol: React.FC<{ size?: number; className?: string }> = ({ 
  size = 28, 
  className = '' 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Navy/Indigo primary gradient */}
        <linearGradient id="ls-sphere-grad" x1="3" y1="3" x2="29" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="60%" stopColor="#172554" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Cyan/Blue orbital accent */}
        <linearGradient id="ls-orbit-grad" x1="4" y1="12" x2="28" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="70%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>

        {/* Core sphere inner glow */}
        <radialGradient id="ls-inner-glow" cx="16" cy="16" r="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sphere Base & Glow */}
      <circle cx="16" cy="16" r="13" fill="url(#ls-inner-glow)" />
      <circle
        cx="16"
        cy="16"
        r="13"
        stroke="url(#ls-sphere-grad)"
        strokeWidth="2"
        strokeOpacity="0.9"
      />

      {/* Subtle Longitudinal Grid Meridian */}
      <ellipse
        cx="16"
        cy="16"
        rx="5.5"
        ry="13"
        stroke="#94A3B8"
        strokeWidth="1"
        strokeOpacity="0.35"
        strokeDasharray="2 2"
      />

      {/* Dynamic Knowledge Orbit Ring (Inclined at -25°) */}
      <ellipse
        cx="16"
        cy="16"
        rx="14"
        ry="5"
        transform="rotate(-25 16 16)"
        stroke="url(#ls-orbit-grad)"
        strokeWidth="1.75"
      />

      {/* Precision Geometric 'L' Knowledge Pathway */}
      <path
        d="M 11.5 8.5 V 20 C 11.5 21.4 12.6 22.5 14 22.5 H 22"
        stroke="#1E3A8A"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Integrated Knowledge Nodes (Learning Convergence Points) */}
      {/* Node 1: Top Origin */}
      <circle cx="11.5" cy="8.5" r="2.25" fill="#38BDF8" stroke="#1E3A8A" strokeWidth="1" />

      {/* Node 2: Orbital Crossing Point */}
      <circle cx="20.5" cy="13.2" r="1.75" fill="#60A5FA" />

      {/* Node 3: Base Terminal */}
      <circle cx="22" cy="22.5" r="2" fill="#2563EB" stroke="#FFFFFF" strokeWidth="0.75" />

      {/* Inner Central Micro-Spark */}
      <circle cx="15.5" cy="16" r="1" fill="#38BDF8" />
    </svg>
  );
};

export const LearnSphereLogo: React.FC<LearnSphereLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  theme = 'light',
  showSubtitle = false,
}) => {
  const symbolSizes = {
    sm: 22,
    md: 28,
    lg: 36,
  };

  const currentSize = symbolSizes[size] || 28;

  if (variant === 'symbol') {
    return (
      <div 
        className={`inline-flex items-center justify-center ${className}`}
        role="img"
        aria-label="LearnSphere"
      >
        <LearnSphereSymbol size={currentSize} />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div 
        className={`inline-flex items-center gap-2 ${className}`}
        role="img"
        aria-label="LearnSphere"
      >
        <LearnSphereSymbol size={currentSize} />
        <span className="text-sm font-bold tracking-tight text-[#1F242E] font-serif-display leading-none">
          LearnSphere
        </span>
      </div>
    );
  }

  // variant === 'full'
  return (
    <div 
      className={`inline-flex items-center gap-2.5 ${className}`}
      role="img"
      aria-label="LearnSphere"
    >
      <div className="flex-shrink-0 flex items-center justify-center">
        <LearnSphereSymbol size={currentSize} />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-bold tracking-tight font-serif-display ${
            size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-base sm:text-lg'
          } ${theme === 'dark' ? 'text-white' : 'text-[#1F242E]'}`}>
            LearnSphere
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[10px] text-[#737887] tracking-normal mt-0.5 font-sans">
            Academic Study Workspace
          </span>
        )}
      </div>
    </div>
  );
};
