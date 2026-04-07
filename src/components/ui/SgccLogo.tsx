interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { w: 135, h: 44, fs: 48, inner: 40, textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { w: 178, h: 56, fs: 62, inner: 52, textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { w: 232, h: 74, fs: 82, inner: 69, textSize: "text-xs", boldSize: "text-sm" },
  xl: { w: 310, h: 98, fs: 110, inner: 93, textSize: "text-sm", boldSize: "text-base" },
};

const LETTERS = [
  { char: "S", color: "#1B4F9B", cx: 14 },
  { char: "G", color: "#2A9D5C", cx: 36 },
  { char: "C", color: "#E8732A", cx: 61 },
  { char: "C", color: "#D42B2B", cx: 84 },
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
          const x = (l.cx / 100) * s.w;
          const y = s.h * 0.52;

          return (
            <g key={i}>
              {/* Letra grande con color (crea el borde) */}
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
              {/* Letra más pequeña con color de fondo (vacía el interior) */}
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={bgColor}
                stroke="none"
                fontFamily={font}
                fontSize={s.inner}
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
