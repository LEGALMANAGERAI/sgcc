"use client";

import { useId } from "react";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { w: 120, h: 38, fs: 42, sw: 2.5, dash: "6,3", textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { w: 160, h: 50, fs: 56, sw: 3, dash: "8,4", textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { w: 210, h: 66, fs: 74, sw: 3.5, dash: "10,5", textSize: "text-xs", boldSize: "text-sm" },
  xl: { w: 290, h: 90, fs: 102, sw: 4.5, dash: "14,6", textSize: "text-sm", boldSize: "text-base" },
};

const LETTERS = [
  { char: "S", color: "#1B4F9B" },
  { char: "G", color: "#2A9D5C" },
  { char: "C", color: "#E8732A" },
  { char: "C", color: "#D42B2B" },
];

export function SgccLogo({ size = "md", showText = true, darkBg = false }: Props) {
  const s = SIZES[size];
  const textColor = darkBg ? "text-white/80" : "text-gray-500";
  const boldColor = darkBg ? "text-white" : "text-gray-900";
  const positions = [0, 28, 54, 78];

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
        {LETTERS.map((l, i) => (
          <text
            key={i}
            x={`${positions[i]}%`}
            y="80%"
            fill="none"
            stroke={l.color}
            strokeWidth={s.sw}
            strokeDasharray={s.dash}
            strokeLinecap="round"
            fontFamily="'Arial Black', 'Impact', system-ui, sans-serif"
            fontSize={s.fs}
            fontWeight={900}
          >
            {l.char}
          </text>
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
