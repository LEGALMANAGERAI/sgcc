interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { w: 120, h: 36, fs: 38, stripeH: 3, gapH: 2, textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { w: 160, h: 48, fs: 52, stripeH: 4, gapH: 3, textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { w: 220, h: 66, fs: 72, stripeH: 5, gapH: 3, textSize: "text-xs", boldSize: "text-sm" },
  xl: { w: 300, h: 90, fs: 98, stripeH: 7, gapH: 4, textSize: "text-sm", boldSize: "text-base" },
};

const LETTERS: { char: string; color: string; xPct: number }[] = [
  { char: "S", color: "#1B4F9B", xPct: 5 },
  { char: "G", color: "#2A9D5C", xPct: 30 },
  { char: "C", color: "#E8732A", xPct: 57 },
  { char: "C", color: "#D42B2B", xPct: 80 },
];

export function SgccLogo({ size = "md", showText = true, darkBg = false }: Props) {
  const s = SIZES[size];
  const textColor = darkBg ? "text-white/80" : "text-gray-500";
  const boldColor = darkBg ? "text-white" : "text-gray-900";
  const patternH = s.stripeH + s.gapH;
  const uid = `sgcc-${size}`;

  return (
    <div className="flex items-center gap-3">
      <svg
        width={s.w}
        height={s.h}
        viewBox={`0 0 ${s.w} ${s.h}`}
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <defs>
          {LETTERS.map((l, i) => (
            <pattern
              key={i}
              id={`${uid}-p${i}`}
              patternUnits="userSpaceOnUse"
              width={s.w}
              height={patternH}
            >
              <rect width={s.w} height={s.stripeH} fill={l.color} />
            </pattern>
          ))}
        </defs>
        {LETTERS.map((l, i) => (
          <text
            key={i}
            x={`${l.xPct}%`}
            y="82%"
            fill={`url(#${uid}-p${i})`}
            fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
            fontSize={s.fs}
            fontWeight={900}
            letterSpacing="-1"
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
