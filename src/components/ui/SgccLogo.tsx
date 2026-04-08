interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { box: 48, fonts: [52, 40, 30, 21], sw: 5, textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { box: 62, fonts: [66, 51, 38, 27], sw: 6, textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { box: 82, fonts: [88, 68, 50, 36], sw: 7, textSize: "text-xs", boldSize: "text-sm" },
  xl: { box: 108, fonts: [116, 90, 66, 47], sw: 9, textSize: "text-sm", boldSize: "text-base" },
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
  const font = "'Arial Black', 'Impact', system-ui, sans-serif";
  const cx = s.box / 2;
  const cy = s.box / 2;

  return (
    <div className="flex items-center gap-3">
      <svg
        width={s.box}
        height={s.box}
        viewBox={`0 0 ${s.box} ${s.box}`}
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
        aria-label="SGCC"
        role="img"
      >
        {LETTERS.map((l, i) => (
          <text
            key={i}
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill={bgColor}
            stroke={l.color}
            strokeWidth={s.sw}
            strokeLinejoin="round"
            strokeLinecap="round"
            paintOrder="stroke fill"
            fontFamily={font}
            fontSize={s.fonts[i]}
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
