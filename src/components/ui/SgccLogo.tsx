"use client";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: {
    w: 140, h: 44, fs: 48, sw: 1.8,
    scales: [1, 0.78, 0.56, 0.34],
    offsets: [{ x: 3, y: 36 }, { x: 33, y: 36 }, { x: 66, y: 36 }, { x: 96, y: 36 }],
    centers: [{ x: 17, y: 22 }, { x: 50, y: 22 }, { x: 80, y: 22 }, { x: 113, y: 22 }],
    textSize: "text-[8px]", boldSize: "text-[9px]",
  },
  md: {
    w: 185, h: 58, fs: 64, sw: 2.2,
    scales: [1, 0.8, 0.6, 0.4],
    offsets: [{ x: 4, y: 48 }, { x: 44, y: 48 }, { x: 88, y: 48 }, { x: 128, y: 48 }],
    centers: [{ x: 23, y: 29 }, { x: 67, y: 29 }, { x: 107, y: 29 }, { x: 150, y: 29 }],
    textSize: "text-[10px]", boldSize: "text-xs",
  },
  lg: {
    w: 245, h: 76, fs: 84, sw: 2.5,
    scales: [1, 0.82, 0.64, 0.46, 0.28],
    offsets: [{ x: 5, y: 63 }, { x: 58, y: 63 }, { x: 116, y: 63 }, { x: 169, y: 63 }],
    centers: [{ x: 30, y: 38 }, { x: 88, y: 38 }, { x: 141, y: 38 }, { x: 199, y: 38 }],
    textSize: "text-xs", boldSize: "text-sm",
  },
  xl: {
    w: 330, h: 100, fs: 112, sw: 3,
    scales: [1, 0.83, 0.66, 0.49, 0.32],
    offsets: [{ x: 6, y: 83 }, { x: 78, y: 83 }, { x: 155, y: 83 }, { x: 227, y: 83 }],
    centers: [{ x: 40, y: 50 }, { x: 117, y: 50 }, { x: 189, y: 50 }, { x: 266, y: 50 }],
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
        {LETTERS.map((l, li) => {
          const o = s.offsets[li];
          const c = s.centers[li];

          return s.scales.map((sc, ri) => (
            <text
              key={`${li}-${ri}`}
              x={o.x}
              y={o.y}
              fill="none"
              stroke={l.color}
              strokeWidth={s.sw / sc}
              strokeLinecap="butt"
              strokeLinejoin="miter"
              fontFamily="'Arial Black', 'Impact', system-ui, sans-serif"
              fontSize={s.fs}
              fontWeight={900}
              transform={`translate(${c.x * (1 - sc)}, ${c.y * (1 - sc)}) scale(${sc})`}
            >
              {l.char}
            </text>
          ));
        })}
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
