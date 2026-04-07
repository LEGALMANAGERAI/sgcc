"use client";

import { useId } from "react";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { w: 140, h: 44, fs: 48, sw: 12, lineH: 2, gapH: 2, textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { w: 185, h: 58, fs: 64, sw: 15, lineH: 2.5, gapH: 2.5, textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { w: 245, h: 76, fs: 84, sw: 18, lineH: 3, gapH: 3, textSize: "text-xs", boldSize: "text-sm" },
  xl: { w: 330, h: 100, fs: 112, sw: 22, lineH: 4, gapH: 3.5, textSize: "text-sm", boldSize: "text-base" },
};

const LETTERS = [
  { char: "S", color: "#1B4F9B", x: 3 },
  { char: "G", color: "#2A9D5C", x: 37 },
  { char: "C", color: "#E8732A", x: 55 },
  { char: "C", color: "#D42B2B", x: 78 },
];

export function SgccLogo({ size = "md", showText = true, darkBg = false }: Props) {
  const id = useId();
  const s = SIZES[size];
  const textColor = darkBg ? "text-white/80" : "text-gray-500";
  const boldColor = darkBg ? "text-white" : "text-gray-900";
  const step = s.lineH + s.gapH;

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
        <defs>
          {LETTERS.map((l, i) => (
            <pattern
              key={i}
              id={`${id}-s${i}`}
              patternUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={s.w}
              height={step}
            >
              <rect x="0" y="0" width={s.w} height={s.lineH} fill={l.color} />
            </pattern>
          ))}
        </defs>

        {LETTERS.map((l, i) => (
          <text
            key={i}
            x={`${l.x}%`}
            y="82%"
            fill="none"
            stroke={`url(#${id}-s${i})`}
            strokeWidth={s.sw}
            strokeLinejoin="round"
            strokeLinecap="butt"
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
