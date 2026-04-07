"use client";

import { useId } from "react";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

/*
 * Cada letra se dibuja con N capas de stroke alternando
 * color → fondo → color → fondo → color
 * para crear contornos concéntricos que siguen la forma de la letra.
 * El step entre cada capa define el grosor de cada anillo y gap.
 */
const SIZES = {
  sm: {
    w: 130, h: 42, fs: 46,
    layers: [14, 11.5, 9, 6.5, 4] as number[],
    textSize: "text-[8px]", boldSize: "text-[9px]",
  },
  md: {
    w: 170, h: 54, fs: 60,
    layers: [18, 15, 12, 9, 6, 3] as number[],
    textSize: "text-[10px]", boldSize: "text-xs",
  },
  lg: {
    w: 230, h: 72, fs: 80,
    layers: [22, 18.5, 15, 11.5, 8, 4.5, 2] as number[],
    textSize: "text-xs", boldSize: "text-sm",
  },
  xl: {
    w: 310, h: 96, fs: 108,
    layers: [28, 24, 20, 16, 12, 8, 4, 1.5] as number[],
    textSize: "text-sm", boldSize: "text-base",
  },
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
  const bgColor = darkBg ? "#0D2340" : "#ffffff";
  const positions = [2, 36, 70, 103];

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
        {LETTERS.map((l, li) =>
          /* Cada capa se dibuja de mayor a menor stroke-width */
          s.layers.map((sw, ri) => (
            <text
              key={`${li}-${ri}`}
              x={positions[li]}
              y={s.h * 0.82}
              fill="none"
              stroke={ri % 2 === 0 ? l.color : bgColor}
              strokeWidth={sw}
              strokeLinejoin="round"
              strokeLinecap="round"
              fontFamily="'Arial Black', 'Impact', system-ui, sans-serif"
              fontSize={s.fs}
              fontWeight={900}
              paintOrder="stroke"
            >
              {l.char}
            </text>
          ))
        )}
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
