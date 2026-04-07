interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { w: 130, h: 42, fs: 46, sw: 2.5, innerFs: 40, textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { w: 170, h: 54, fs: 60, sw: 3, innerFs: 52, textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { w: 225, h: 72, fs: 80, sw: 3.5, innerFs: 70, textSize: "text-xs", boldSize: "text-sm" },
  xl: { w: 300, h: 96, fs: 108, sw: 4, innerFs: 96, textSize: "text-sm", boldSize: "text-base" },
};

const LETTERS = [
  { char: "S", color: "#1B4F9B", x: 2 },
  { char: "G", color: "#2A9D5C", x: 27 },
  { char: "C", color: "#E8732A", x: 53 },
  { char: "C", color: "#D42B2B", x: 77 },
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
        {LETTERS.map((l, i) => (
          <g key={i}>
            {/* Capa 1: letra con stroke de color (el contorno visible) */}
            <text
              x={`${l.x}%`}
              y="80%"
              fill={l.color}
              stroke={l.color}
              strokeWidth={s.sw}
              strokeLinejoin="round"
              fontFamily={font}
              fontSize={s.fs}
              fontWeight={900}
            >
              {l.char}
            </text>
            {/* Capa 2: letra más pequeña con fill del fondo encima,
                cubre el interior y las líneas de terminal */}
            <text
              x={`${l.x}%`}
              y="80%"
              fill={bgColor}
              stroke="none"
              fontFamily={font}
              fontSize={s.innerFs}
              fontWeight={900}
              dx={(s.fs - s.innerFs) * 0.28}
              dy={(s.fs - s.innerFs) * 0.28}
            >
              {l.char}
            </text>
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
