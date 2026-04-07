"use client";

import { useId } from "react";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

/* Proporciones: ~5-6 franjas visibles por letra, gaps anchos y claros */
const SIZES = {
  sm: { w: 110, h: 34, fs: 40, stripe: 4, gap: 3, textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { w: 150, h: 46, fs: 54, stripe: 5, gap: 4, textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { w: 200, h: 62, fs: 72, stripe: 6, gap: 5, textSize: "text-xs", boldSize: "text-sm" },
  xl: { w: 280, h: 86, fs: 100, stripe: 8, gap: 6, textSize: "text-sm", boldSize: "text-base" },
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
  const step = s.stripe + s.gap;

  /* Posiciones X para cada letra (porcentajes del viewBox) */
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
        <defs>
          {LETTERS.map((l, i) => (
            <pattern
              key={i}
              id={`${id}-${i}`}
              patternUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={s.w}
              height={step}
            >
              {/* Solo la franja de color, el resto queda transparente */}
              <rect x="0" y="0" width={s.w} height={s.stripe} fill={l.color} />
            </pattern>
          ))}
        </defs>

        {LETTERS.map((l, i) => (
          <text
            key={i}
            x={`${positions[i]}%`}
            y="80%"
            fill={`url(#${id}-${i})`}
            stroke="none"
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
