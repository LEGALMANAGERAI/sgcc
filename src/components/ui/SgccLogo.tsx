interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { fontSize: 32, stripeH: 3, gapH: 2, textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { fontSize: 46, stripeH: 4, gapH: 2.5, textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { fontSize: 62, stripeH: 5, gapH: 3, textSize: "text-xs", boldSize: "text-sm" },
  xl: { fontSize: 88, stripeH: 7, gapH: 4, textSize: "text-sm", boldSize: "text-base" },
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
  const total = s.stripeH + s.gapH;

  return (
    <div className="flex items-center gap-3">
      {/* Letras formadas por franjas horizontales de color */}
      <div className="flex" style={{ gap: 2 }}>
        {LETTERS.map((l, i) => (
          <span
            key={i}
            className="select-none"
            style={{
              fontSize: s.fontSize,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: "transparent",
              background: `repeating-linear-gradient(to bottom, ${l.color} 0px, ${l.color} ${s.stripeH}px, ${bgColor} ${s.stripeH}px, ${bgColor} ${total}px)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {l.char}
          </span>
        ))}
      </div>

      {/* Texto descriptivo */}
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
