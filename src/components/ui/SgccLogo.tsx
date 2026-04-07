"use client";

import { useId } from "react";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { w: 130, h: 40, fs: 44, rings: [10, 8, 6, 4, 2] as number[], textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { w: 170, h: 52, fs: 58, rings: [13, 10.5, 8, 5.5, 3] as number[], textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { w: 230, h: 70, fs: 78, rings: [16, 13, 10, 7, 4] as number[], textSize: "text-xs", boldSize: "text-sm" },
  xl: { w: 310, h: 94, fs: 106, rings: [20, 16, 12, 8, 4] as number[], textSize: "text-sm", boldSize: "text-base" },
};

const LETTERS = [
  { char: "S", color: "#1B4F9B" },
  { char: "G", color: "#2A9D5C" },
  { char: "C", color: "#E8732A" },
  { char: "C", color: "#D42B2B" },
];

export function SgccLogo({ size = "md", showText = true, darkBg = false }: Props) {
  const id = useId();
  const s = SIZES[size];
  const textColor = darkBg ? "text-white/80" : "text-gray-500";
  const boldColor = darkBg ? "text-white" : "text-gray-900";
  const bgColor = darkBg ? "#0D2340" : "#ffffff";
  const positions = [0, 27, 53, 77];

  return (
    <div className="flex items-center gap-3">
      <svg
        width={s.w}
        height={s.h}
        viewBox={`0 0 ${s.w} ${s.h}`}
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
        aria-label="SGCC"
        role="img"
      >
        {LETTERS.map((l, li) => (
          <g key={li}>
            {/* Capas alternando: color → fondo → color → fondo → color */}
            {s.rings.map((sw, ri) => (
              <text
                key={ri}
                x={`${positions[li]}%`}
                y="82%"
                fill="none"
                stroke={ri % 2 === 0 ? l.color : bgColor}
                strokeWidth={sw}
                strokeLinejoin="round"
                strokeLinecap="round"
                fontFamily="'Arial Black', 'Impact', system-ui, sans-serif"
                fontSize={s.fs}
                fontWeight={900}
              >
                {l.char}
              </text>
            ))}
          </g>
        ))}
      </svg>

      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          <span className={`${s.textSize} ${textColor} font-medium uppercase tracking-widest`}>
            Sistema de Gesti&oacute;n
          </span>
          <span className={`${s.boldSize} ${boldColor} font-extrabold uppercase tracking-wide`}>
            para Centros de Conciliaci&oacute;n
          </span>
        </div>
      )}
    </div>
  );
}
