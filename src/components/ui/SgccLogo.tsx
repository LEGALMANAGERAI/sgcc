"use client";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const BASE = { sm: 38, md: 50, lg: 66, xl: 88 };
const STROKE = { sm: 1.5, md: 2, lg: 2.5, xl: 3 };
const TEXT_SIZES = {
  sm: { textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { textSize: "text-xs", boldSize: "text-sm" },
  xl: { textSize: "text-sm", boldSize: "text-base" },
};

const LETTERS = [
  { char: "S", color: "#1B4F9B" },
  { char: "G", color: "#2A9D5C" },
  { char: "C", color: "#E8732A" },
  { char: "C", color: "#D42B2B" },
];

/* 4 contornos concéntricos por letra, del más grande al más pequeño */
const SCALES = [1, 0.8, 0.6, 0.4];

export function SgccLogo({ size = "md", showText = true, darkBg = false }: Props) {
  const fs = BASE[size];
  const sw = STROKE[size];
  const ts = TEXT_SIZES[size];
  const textColor = darkBg ? "text-white/80" : "text-gray-500";
  const boldColor = darkBg ? "text-white" : "text-gray-900";
  const bgColor = darkBg ? "#0D2340" : "#ffffff";

  return (
    <div className="flex items-center gap-3">
      <div className="flex">
        {LETTERS.map((l, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              placeItems: "center",
              width: fs * 0.65,
              height: fs * 1.05,
            }}
          >
            {SCALES.map((sc, j) => (
              <span
                key={j}
                style={{
                  gridArea: "1 / 1",
                  fontSize: fs * sc,
                  fontFamily: "'Arial Black', Impact, sans-serif",
                  fontWeight: 900,
                  WebkitTextStrokeWidth: `${sw}px`,
                  WebkitTextStrokeColor: l.color,
                  WebkitTextFillColor: bgColor,
                  color: bgColor,
                  lineHeight: 1,
                  userSelect: "none",
                  paintOrder: "stroke fill",
                }}
              >
                {l.char}
              </span>
            ))}
          </div>
        ))}
      </div>

      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          <span className={`${ts.textSize} ${textColor} font-medium uppercase tracking-widest`}>
            {"Sistema de Gestión"}
          </span>
          <span className={`${ts.boldSize} ${boldColor} font-extrabold uppercase tracking-wide`}>
            {"para Centros de Conciliación"}
          </span>
        </div>
      )}
    </div>
  );
}
