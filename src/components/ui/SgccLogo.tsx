"use client";

import { useId } from "react";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { w: 130, h: 42, fs: 46, barH: 4, gapH: 3, textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { w: 170, h: 54, fs: 60, barH: 5, gapH: 3.5, textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { w: 230, h: 72, fs: 80, barH: 7, gapH: 5, textSize: "text-xs", boldSize: "text-sm" },
  xl: { w: 310, h: 96, fs: 108, barH: 9, gapH: 6, textSize: "text-sm", boldSize: "text-base" },
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
  const positions = [2, 35, 68, 100];
  const step = s.barH + s.gapH;
  const numBars = Math.ceil(s.h / step) + 1;

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
            <clipPath key={i} id={`${id}-c${i}`}>
              <text
                x={positions[i]}
                y={s.h * 0.82}
                fontFamily="'Arial Black', 'Impact', system-ui, sans-serif"
                fontSize={s.fs}
                fontWeight={900}
              >
                {l.char}
              </text>
            </clipPath>
          ))}
        </defs>

        {LETTERS.map((l, i) => (
          <g key={i} clipPath={`url(#${id}-c${i})`}>
            {Array.from({ length: numBars }, (_, j) => (
              <rect
                key={j}
                x={0}
                y={j * step}
                width={s.w}
                height={s.barH}
                fill={l.color}
              />
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
