interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { w: 160, h: 50, fs: 54, innerFs: 43, textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { w: 210, h: 64, fs: 70, innerFs: 56, textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { w: 275, h: 84, fs: 92, innerFs: 74, textSize: "text-xs", boldSize: "text-sm" },
  xl: { w: 365, h: 112, fs: 122, innerFs: 98, textSize: "text-sm", boldSize: "text-base" },
};

const LETTERS = [
  { char: "S", color: "#1B4F9B", xPct: 12 },
  { char: "G", color: "#2A9D5C", xPct: 34 },
  { char: "C", color: "#E8732A", xPct: 59 },
  { char: "C", color: "#D42B2B", xPct: 82 },
];

export function SgccLogo({ size = "md", showText = true, darkBg = false }: Props) {
  const s = SIZES[size];
  const textColor = darkBg ? "text-white/80" : "text-gray-500";
  const boldColor = darkBg ? "text-white" : "text-gray-900";
  const bgColor = darkBg ? "#0D2340" : "#ffffff";
  const font = "'Arial Black', 'Impact', system-ui, sans-serif";

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
        {LETTERS.map((l, i) => {
          const x = (l.xPct / 100) * s.w;
          const y = s.h * 0.55;
          return (
            <g key={i}>
              {/* Letra grande rellena con el color */}
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={l.color}
                stroke="none"
                fontFamily={font}
                fontSize={s.fs}
                fontWeight={900}
              >
                {l.char}
              </text>
              {/* Letra más pequeña rellena con fondo, centrada encima */}
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={bgColor}
                stroke="none"
                fontFamily={font}
                fontSize={s.innerFs}
                fontWeight={900}
              >
                {l.char}
              </text>
            </g>
          );
        })}
      </svg>

      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          <span className={`${s.textSize} ${textColor} font-medium uppercase tracking-widest`}>
            {"Sistema de Gestión"}
          </span>
          <span className={`${s.boldSize} ${boldColor} font-extrabold uppercase tracking-wide`}>
            {"para Centros de Conciliación"}
          </span>
        </div>
      )}
    </div>
  );
}
