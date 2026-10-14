import React from "react";

interface CompassInstrumentProps {
  bearingDeg: number;
  size?: number;
  label?: string;
}

export const CompassInstrument: React.FC<CompassInstrumentProps> = ({
  bearingDeg,
  size = 48,
  label
}) => {
  const normDeg = Math.round(((bearingDeg % 360) + 360) % 360);

  return (
    <div
      className="relative flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
      title={label || `Arah Sebaran: ${normDeg}°`}
    >
      {/* Outer Glow Ring */}
      <div className="absolute inset-0 rounded-full bg-[#EB895B]/15 blur-[2px] pointer-events-none" />

      {/* SVG Compass Instrument */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-md overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* Dial Face Gradient */}
          <radialGradient id="compassDialFace" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1f1816" />
            <stop offset="70%" stopColor="#120e0d" />
            <stop offset="100%" stopColor="#080605" />
          </radialGradient>

          {/* Faceted Needle - North / Drift Pointing Side */}
          <linearGradient id="needleNorthLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFA066" />
            <stop offset="100%" stopColor="#EB895B" />
          </linearGradient>
          <linearGradient id="needleNorthDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EB895B" />
            <stop offset="100%" stopColor="#C94A2D" />
          </linearGradient>

          {/* Faceted Needle - South / Counterweight Tail */}
          <linearGradient id="needleSouthLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="needleSouthDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Brass Pivot Cap */}
          <radialGradient id="compassPivot" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFF2D6" />
            <stop offset="50%" stopColor="#EB895B" />
            <stop offset="100%" stopColor="#872E2E" />
          </radialGradient>

          {/* Needle Drop Shadow */}
          <filter id="needleGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* 1. Bezel Ring Exterior */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="url(#compassDialFace)"
          stroke="#EB895B"
          strokeOpacity="0.45"
          strokeWidth="1.8"
        />
        {/* Fine Inner Track Ring */}
        <circle
          cx="50"
          cy="50"
          r="43"
          fill="none"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="0.8"
        />

        {/* 2. Dial Ticks (Every 30 degrees, 12 tick marks) */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
          const isCardinal = deg % 90 === 0;
          return (
            <line
              key={deg}
              x1="50"
              y1={isCardinal ? (deg === 0 ? "6.5" : "7.5") : "10"}
              x2="50"
              y2={isCardinal ? (deg === 0 ? "13.5" : "12.5") : "11.5"}
              stroke={
                deg === 0
                  ? "#EB895B"
                  : isCardinal
                  ? "rgba(255, 255, 255, 0.75)"
                  : "rgba(255, 255, 255, 0.22)"
              }
              strokeWidth={deg === 0 ? "2.2" : isCardinal ? "1.6" : "0.9"}
              strokeLinecap="round"
              transform={`rotate(${deg} 50 50)`}
            />
          );
        })}

        {/* 3. Cardinal Direction Labels */}
        <text
          x="50"
          y="22"
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="900"
          fill="#EB895B"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.5"
        >
          U
        </text>
        <text
          x="82"
          y="53.5"
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="700"
          fill="rgba(255, 255, 255, 0.45)"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          T
        </text>
        <text
          x="50"
          y="85"
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="700"
          fill="rgba(255, 255, 255, 0.45)"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          S
        </text>
        <text
          x="18"
          y="53.5"
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="700"
          fill="rgba(255, 255, 255, 0.45)"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          B
        </text>

        {/* 4. Rotating Needle Assembly (100% Mathematically Centered at (50, 50)) */}
        <g transform="translate(50, 50)">
          <g transform={`rotate(${normDeg})`} filter="url(#needleGlow)">
            {/* North / Drift Pointing Tip (Faceted Dual-Tone) */}
            <polygon
              points="0,-37 4.5,0 0,-3"
              fill="url(#needleNorthDark)"
            />
            <polygon
              points="0,-37 -4.5,0 0,-3"
              fill="url(#needleNorthLight)"
            />
            {/* Sharp White Spine Highlight on Needle Apex */}
            <line
              x1="0"
              y1="-36"
              x2="0"
              y2="-14"
              stroke="#FFFFFF"
              strokeWidth="0.8"
              strokeOpacity="0.85"
              strokeLinecap="round"
            />

            {/* South Counterweight Tail (Faceted Dual-Tone) */}
            <polygon
              points="0,37 4,0 0,3"
              fill="url(#needleSouthDark)"
            />
            <polygon
              points="0,37 -4,0 0,3"
              fill="url(#needleSouthLight)"
            />

            {/* Brass Center Pivot Cap - Locked Exactly at (0, 0) */}
            <circle
              cx="0"
              cy="0"
              r="4.8"
              fill="url(#compassPivot)"
              stroke="#120e0d"
              strokeWidth="1.2"
            />
            <circle
              cx="-1.2"
              cy="-1.2"
              r="1.4"
              fill="#FFFFFF"
              fillOpacity="0.9"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};
