interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { box: 44, fonts: [46, 36, 27, 19], sw: 2, textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { box: 58, fonts: [60, 47, 35, 25], sw: 2.5, textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { box: 76, fonts: [80, 62, 46, 32], sw: 3, textSize: "text-xs", boldSize: "text-sm" },
  xl: { box: 100, fonts: [106, 82, 61, 42], sw: 3.5, textSize: "text-sm", boldSize: "text-base" },
};

/* Letras anidadas: la más grande afuera, la más pequeña al centro */
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
