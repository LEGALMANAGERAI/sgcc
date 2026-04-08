interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { w: 145, h: 46, fs: 50, sw: 5, textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { w: 190, h: 60, fs: 66, sw: 6, textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { w: 250, h: 78, fs: 86, sw: 7, textSize: "text-xs", boldSize: "text-sm" },
  xl: { w: 330, h: 104, fs: 114, sw: 9, textSize: "text-sm", boldSize: "text-base" },
};

const LETTERS = [
  { char: "S", color: "#1B4F9B", x: 1 },
  { char: "G", color: "#2A9D5C", x: 24 },
  { char: "C", color: "#E8732A", x: 51 },
  { char: "C", color: "#D42B2B", x: 76 },
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
          <text
            key={i}
            x={`${l.x}%`}
            y="80%"
            fill={bgColor}
            stroke={l.color}
            strokeWidth={s.sw}
            strokeLinejoin="round"
            strokeLinecap="round"
            paintOrder="stroke fill"
            fontFamily={font}
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
