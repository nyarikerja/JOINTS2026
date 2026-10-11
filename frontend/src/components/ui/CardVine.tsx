import React from "react";

export type CardVinePosition = 
  | "top-right" 
  | "top-left" 
  | "bottom-right" 
  | "bottom-left" 
  | "top-edge" 
  | "navbar";

interface CardVineProps {
  position?: CardVinePosition;
  className?: string;
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
}

/* Helper komponen kelopak bunga 5 helai alami */
const FlowerBlossom: React.FC<{ x: number; y: number; scale?: number; rotation?: number }> = ({
  x,
  y,
  scale = 1,
  rotation = 0
}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rotation}) scale(${scale})`}>
    {/* 5 Helai Kelopak Bunga Bergradasi Lembut */}
    {[0, 72, 144, 216, 288].map((angle, i) => (
      <ellipse
        key={i}
        cx="0"
        cy="-3.2"
        rx="2.3"
        ry="3.6"
        transform={`rotate(${angle})`}
        fill="url(#flowerPetalGrad)"
        stroke="#EB895B"
        strokeWidth="0.35"
      />
    ))}
    {/* Dasar tangkai hijau kecil */}
    <circle cx="0" cy="0" r="2.2" fill="#4A7532" opacity="0.3" />
    {/* Putik Sari Bunga Keemasan */}
    <circle cx="0" cy="0" r="1.8" fill="#F59E0B" />
    <circle cx="0" cy="0" r="0.9" fill="#D97706" />
    <circle cx="-0.5" cy="-0.5" r="0.4" fill="#FEF3C7" />
  </g>
);

/* Kuncup Bunga Kecil */
const FlowerBud: React.FC<{ x: number; y: number; scale?: number; rotation?: number }> = ({
  x,
  y,
  scale = 1,
  rotation = 0
}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rotation}) scale(${scale})`}>
    <path d="M-1.5 2 C-2 -1 -3 -3 0 -5 C3 -3 2 -1 1.5 2 Z" fill="#FDE8E8" stroke="#EB895B" strokeWidth="0.3" />
    <path d="M-2 1 C-1.5 3 1.5 3 2 1 C1 0 -1 0 -2 1 Z" fill="#4E7C38" />
  </g>
);

export const CardVine: React.FC<CardVineProps> = ({
  position = "top-right",
  className = "",
  size = "md",
  style
}) => {
  const scaleMap = {
    sm: 0.85,
    md: 1.0,
    lg: 1.2
  };
  const scale = scaleMap[size];

  // 1. VARIAN NAVBAR: Bunga rambat horizontal di sepanjang navbar
  if (position === "navbar") {
    return (
      <div
        className={`absolute bottom-[-10px] left-0 right-0 h-[24px] pointer-events-none z-30 select-none overflow-visible flex items-center justify-between ${className}`}
        style={style}
        aria-hidden="true"
      >
        <svg
          width="100%"
          height="24"
          viewBox="0 0 1200 24"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible drop-shadow-[0_2px_4px_rgba(0,0,0,0.22)]"
        >
          <defs>
            <linearGradient id="flowerPetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="70%" stopColor="#FFF4E6" />
              <stop offset="100%" stopColor="#FED7AA" />
            </linearGradient>
            <linearGradient id="leafGradNav" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5E9643" />
              <stop offset="100%" stopColor="#315B22" />
            </linearGradient>
          </defs>

          {/* Batang sulur utama merayap di bawah border navbar */}
          <path
            d="M 0 10 Q 150 18, 300 9 T 600 12 T 900 8 T 1200 11"
            stroke="#2E4D23"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 0 10 Q 150 18, 300 9 T 600 12 T 900 8 T 1200 11"
            stroke="rgba(235, 252, 215, 0.4)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />

          {/* Sulur pilin meliuk */}
          {[120, 380, 680, 940, 1120].map((pos, idx) => (
            <path
              key={idx}
              d={`M ${pos} 10 C ${pos + 8} 3, ${pos + 16} 5, ${pos + 14} 12 C ${pos + 12} 16, ${pos + 6} 15, ${pos + 8} 12`}
              stroke="#446E31"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          ))}

          {/* Deretan daun-daun segar di sepanjang batang navbar */}
          {[60, 180, 260, 340, 440, 530, 620, 720, 810, 890, 990, 1070, 1160].map((xPos, idx) => {
            const rot = idx % 2 === 0 ? -35 : 145;
            const yOffset = idx % 2 === 0 ? 8 : 12;
            return (
              <g key={idx} transform={`translate(${xPos}, ${yOffset}) rotate(${rot}) scale(0.85)`}>
                <path
                  d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
                  fill="url(#leafGradNav)"
                  stroke="rgba(0,0,0,0.18)"
                  strokeWidth="0.4"
                />
                <path d="M0 -1 L0 -12 M0 -5 L-2 -8 M0 -8 L2 -10" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
              </g>
            );
          })}

          {/* Bunga-bunga rambat mekar (Flower Blossoms) di sepanjang navbar */}
          <FlowerBlossom x={95} y={11} scale={0.9} rotation={12} />
          <FlowerBud x={145} y={8} scale={0.8} rotation={-25} />
          <FlowerBlossom x={290} y={9} scale={1.05} rotation={-15} />
          <FlowerBlossom x={490} y={13} scale={0.85} rotation={35} />
          <FlowerBud x={560} y={7} scale={0.85} rotation={10} />
          <FlowerBlossom x={755} y={10} scale={1.0} rotation={-8} />
          <FlowerBlossom x={850} y={8} scale={0.9} rotation={22} />
          <FlowerBud x={915} y={12} scale={0.8} rotation={-40} />
          <FlowerBlossom x={1030} y={11} scale={0.95} rotation={18} />
        </svg>
      </div>
    );
  }

  // 2. VARIAN TOP-EDGE: Sulur di tepi atas kartu
  if (position === "top-edge") {
    return (
      <div
        className={`absolute -top-4 left-1/2 -translate-x-1/2 pointer-events-none z-20 select-none overflow-visible ${className}`}
        style={{ transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center", ...style }}
        aria-hidden="true"
      >
        <svg
          width="170"
          height="42"
          viewBox="0 0 170 42"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible drop-shadow-[0_2px_5px_rgba(0,0,0,0.2)]"
        >
          <defs>
            <linearGradient id="flowerPetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="70%" stopColor="#FFF4E6" />
              <stop offset="100%" stopColor="#FED7AA" />
            </linearGradient>
            <linearGradient id="leafGradEdge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#588C3E" />
              <stop offset="100%" stopColor="#305822" />
            </linearGradient>
          </defs>

          {/* Batang sulur utama merayap bergelombang */}
          <path
            d="M 10 22 C 38 13, 65 27, 95 16 C 120 10, 142 24, 160 17"
            stroke="#2E4D23"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 10 22 C 38 13, 65 27, 95 16 C 120 10, 142 24, 160 17"
            stroke="rgba(235, 252, 215, 0.4)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />

          {/* Sulur pilin spiral */}
          <path
            d="M 116 14 C 122 7, 128 9, 129 14 C 130 18, 125 21, 122 19 C 120 18, 121 15, 123 15"
            stroke="#4A6E38"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M 28 17 C 23 9, 16 11, 15 16 C 14 20, 19 23, 22 21"
            stroke="#4A6E38"
            strokeWidth="1.1"
            strokeLinecap="round"
          />

          {/* Daun-daun organik */}
          <g transform="translate(34, 16) rotate(-45) scale(0.95)">
            <path
              d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
              fill="url(#leafGradEdge)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
            <path d="M0 -1 L0 -12 M0 -5 L-2 -8 M0 -8 L2 -10" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
          </g>

          <g transform="translate(60, 24) rotate(135) scale(0.8)">
            <path
              d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
              fill="url(#leafGradEdge)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
            <path d="M0 -1 L0 -12" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
          </g>

          <g transform="translate(80, 18) rotate(-35) scale(1)">
            <path
              d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
              fill="url(#leafGradEdge)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
            <path d="M0 -1 L0 -12 M0 -5 L-2 -8 M0 -8 L2 -10" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
          </g>

          <g transform="translate(138, 16) rotate(-25) scale(0.9)">
            <path
              d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
              fill="url(#leafGradEdge)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
            <path d="M0 -1 L0 -12 M0 -5 L-2 -8 M0 -8 L2 -10" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
          </g>

          {/* 2 Bunga Mekar & 1 Kuncup */}
          <FlowerBlossom x={48} y={17} scale={0.9} rotation={-15} />
          <FlowerBlossom x={98} y={16} scale={1.05} rotation={18} />
          <FlowerBud x={148} y={15} scale={0.8} rotation={25} />
        </svg>
      </div>
    );
  }

  // 3. VARIAN TOP-LEFT: Sudut Kiri Atas
  if (position === "top-left") {
    return (
      <div
        className={`absolute -top-4 -left-4 pointer-events-none z-20 select-none overflow-visible ${className}`}
        style={{ transform: `scale(${scale})`, transformOrigin: "top left", ...style }}
        aria-hidden="true"
      >
        <svg
          width="104"
          height="104"
          viewBox="0 0 104 104"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible drop-shadow-[0_2px_6px_rgba(0,0,0,0.22)]"
        >
          <defs>
            <linearGradient id="flowerPetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="70%" stopColor="#FFF4E6" />
              <stop offset="100%" stopColor="#FED7AA" />
            </linearGradient>
            <linearGradient id="leafGradTL" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5D9242" />
              <stop offset="100%" stopColor="#315B22" />
            </linearGradient>
          </defs>

          {/* Batang utama melengkung memeluk sudut kiri atas */}
          <path
            d="M 18 90 C 14 68, 20 50, 17 35 C 14 20, 24 14, 38 16 C 56 18, 76 13, 94 17"
            stroke="#2E4D23"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M 18 90 C 14 68, 20 50, 17 35 C 14 20, 24 14, 38 16 C 56 18, 76 13, 94 17"
            stroke="rgba(235, 252, 215, 0.4)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />

          {/* Sulur pilin melingkar di luar sudut */}
          <path
            d="M 21 23 C 15 15, 14 7, 20 6 C 25 5, 28 11, 25 15 C 23 18, 20 17, 20 15"
            stroke="#4A6E38"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M 18 68 C 9 65, 8 57, 14 55 C 18 54, 20 58, 18 62"
            stroke="#4A6E38"
            strokeWidth="1.1"
            strokeLinecap="round"
          />

          {/* Daun-daun lebat */}
          <g transform="translate(16, 72) rotate(-115) scale(0.9)">
            <path
              d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
              fill="url(#leafGradTL)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
            <path d="M0 -1 L0 -12 M0 -5 L-2 -8 M0 -8 L2 -10" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
          </g>

          <g transform="translate(18, 48) rotate(45) scale(0.75)">
            <path
              d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
              fill="url(#leafGradTL)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
            <path d="M0 -1 L0 -12" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
          </g>

          <g transform="translate(24, 16) rotate(-65) scale(1.05)">
            <path
              d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
              fill="url(#leafGradTL)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
            <path d="M0 -1 L0 -12 M0 -5 L-2 -8 M0 -8 L2 -10" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
          </g>

          <g transform="translate(62, 17) rotate(-35) scale(0.9)">
            <path
              d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
              fill="url(#leafGradTL)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
            <path d="M0 -1 L0 -12 M0 -5 L-2 -8 M0 -8 L2 -10" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
          </g>

          <g transform="translate(86, 16) rotate(20) scale(0.8)">
            <path
              d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
              fill="url(#leafGradTL)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
            <path d="M0 -1 L0 -12" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
          </g>

          {/* 3 Bunga Rambat Cantik Mekar di Sudut */}
          <FlowerBlossom x={38} y={16} scale={0.95} rotation={-10} />
          <FlowerBlossom x={18} y={32} scale={0.85} rotation={40} />
          <FlowerBud x={74} y={14} scale={0.8} rotation={25} />
        </svg>
      </div>
    );
  }

  // 4. VARIAN BOTTOM-RIGHT: Sudut Kanan Bawah
  if (position === "bottom-right") {
    return (
      <div
        className={`absolute -bottom-4 -right-4 pointer-events-none z-20 select-none overflow-visible ${className}`}
        style={{ transform: `scale(${scale})`, transformOrigin: "bottom right", ...style }}
        aria-hidden="true"
      >
        <svg
          width="104"
          height="104"
          viewBox="0 0 104 104"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible drop-shadow-[0_2px_6px_rgba(0,0,0,0.22)]"
        >
          <defs>
            <linearGradient id="flowerPetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="70%" stopColor="#FFF4E6" />
              <stop offset="100%" stopColor="#FED7AA" />
            </linearGradient>
            <linearGradient id="leafGradBR" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5D9242" />
              <stop offset="100%" stopColor="#315B22" />
            </linearGradient>
          </defs>

          {/* Batang utama memeluk sudut kanan bawah */}
          <path
            d="M 12 88 C 30 84, 50 89, 68 87 C 82 85, 90 77, 88 64 C 86 50, 91 32, 88 12"
            stroke="#2E4D23"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M 12 88 C 30 84, 50 89, 68 87 C 82 85, 90 77, 88 64 C 86 50, 91 32, 88 12"
            stroke="rgba(235, 252, 215, 0.4)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />

          <path
            d="M 85 82 C 92 88, 98 87, 98 82 C 98 77, 93 75, 90 78"
            stroke="#4A6E38"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          <g transform="translate(48, 87) rotate(145) scale(0.9)">
            <path
              d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
              fill="url(#leafGradBR)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
            <path d="M0 -1 L0 -12" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
          </g>

          <g transform="translate(88, 48) rotate(-45) scale(0.85)">
            <path
              d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
              fill="url(#leafGradBR)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
            />
            <path d="M0 -1 L0 -12" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
          </g>

          {/* Bunga mekar di sudut bawah */}
          <FlowerBlossom x={78} y={76} scale={0.95} rotation={45} />
          <FlowerBud x={32} y={87} scale={0.8} rotation={-15} />
        </svg>
      </div>
    );
  }

  // 5. DEFAULT: "top-right" (Sudut Kanan Atas dengan Bunga Mekar Kaya)
  return (
    <div
      className={`absolute -top-4 -right-4 pointer-events-none z-20 select-none overflow-visible ${className}`}
      style={{ transform: `scale(${scale})`, transformOrigin: "top right", ...style }}
      aria-hidden="true"
    >
      <svg
        width="104"
        height="104"
        viewBox="0 0 104 104"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible drop-shadow-[0_2px_6px_rgba(0,0,0,0.22)]"
      >
        <defs>
          <linearGradient id="flowerPetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="70%" stopColor="#FFF4E6" />
            <stop offset="100%" stopColor="#FED7AA" />
          </linearGradient>
          <linearGradient id="leafGradTR" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5D9242" />
            <stop offset="100%" stopColor="#315B22" />
          </linearGradient>
          <linearGradient id="leafGradTR2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6DA74E" />
            <stop offset="100%" stopColor="#3B6A2C" />
          </linearGradient>
        </defs>

        {/* Batang utama melengkung rapi memeluk sudut kanan atas */}
        <path
          d="M 10 17 C 28 13, 50 18, 68 15 C 80 13, 89 20, 87 35 C 85 50, 90 68, 87 90"
          stroke="#2E4D23"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M 10 17 C 28 13, 50 18, 68 15 C 80 13, 89 20, 87 35 C 85 50, 90 68, 87 90"
          stroke="rgba(235, 252, 215, 0.4)"
          strokeWidth="0.8"
          strokeLinecap="round"
        />

        {/* Sulur pilin spiral di puncak sudut */}
        <path
          d="M 83 22 C 89 15, 96 16, 97 21 C 98 26, 92 29, 89 27 C 87 26, 88 23, 90 23"
          stroke="#4A6E38"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M 88 64 C 96 66, 98 74, 93 77 C 89 79, 86 75, 88 71"
          stroke="#4A6E38"
          strokeWidth="1.1"
          strokeLinecap="round"
        />

        {/* Daun-daun lebat */}
        <g transform="translate(26, 16) rotate(-45) scale(0.85)">
          <path
            d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
            fill="url(#leafGradTR2)"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="0.4"
          />
          <path d="M0 -1 L0 -12 M0 -5 L-2 -8 M0 -8 L2 -10" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
        </g>

        <g transform="translate(52, 17) rotate(-30) scale(1.0)">
          <path
            d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
            fill="url(#leafGradTR)"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="0.4"
          />
          <path d="M0 -1 L0 -12 M0 -5 L-2 -8 M0 -8 L2 -10" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
        </g>

        <g transform="translate(80, 16) rotate(45) scale(1.05)">
          <path
            d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
            fill="url(#leafGradTR)"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="0.4"
          />
          <path d="M0 -1 L0 -12 M0 -5 L-2 -8 M0 -8 L2 -10" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
        </g>

        <g transform="translate(87, 56) rotate(120) scale(0.95)">
          <path
            d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
            fill="url(#leafGradTR2)"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="0.4"
          />
          <path d="M0 -1 L0 -12 M0 -5 L-2 -8 M0 -8 L2 -10" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
        </g>

        <g transform="translate(86, 78) rotate(-140) scale(0.8)">
          <path
            d="M0 0 C-3 -2.5 -5.5 -6 -4 -10 C-2.8 -12.5 -1 -13 0 -15 C1 -13 2.8 -12.5 4 -10 C5.5 -6 3 -2.5 0 0 Z"
            fill="url(#leafGradTR)"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="0.4"
          />
          <path d="M0 -1 L0 -12" stroke="#90C276" strokeWidth="0.55" strokeLinecap="round" />
        </g>

        {/* 3 Bunga Rambat Cantik Mekar di Sudut */}
        <FlowerBlossom x={68} y={16} scale={0.95} rotation={15} />
        <FlowerBlossom x={86} y={34} scale={1.0} rotation={-20} />
        <FlowerBud x={38} y={15} scale={0.85} rotation={-10} />
      </svg>
    </div>
  );
};
