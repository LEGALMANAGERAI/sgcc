interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { fontSize: 28, lineH: 2, lineGap: 5, textSize: "text-[8px]", boldSize: "text-[9px]", gap: 2 },
  md: { fontSize: 40, lineH: 3, lineGap: 7, textSize: "text-[10px]", boldSize: "text-xs", gap: 3 },
  lg: { fontSize: 56, lineH: 3, lineGap: 9, textSize: "text-xs", boldSize: "text-sm", gap: 4 },
  xl: { fontSize: 80, lineH: 4, lineGap: 12, textSize: "text-sm", boldSize: "text-base", gap: 5 },
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
  const cutColor = darkBg ? "#0D2340" : "#ffffff";

  return (
    <div className="flex items-center gap-3">
      {/* Letras con cortes horizontales reales */}
      <div className="flex" style={{ gap: s.gap }}>
        {LETTERS.map((l, i) => (
          <div
            key={i}
            className="relative inline-block select-none overflow-hidden"
            style={{ lineHeight: 1 }}
          >
            {/* Letra base */}
            <span
              style={{
                fontSize: s.fontSize,
                color: l.color,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                display: "block",
              }}
            >
              {l.char}
            </span>

            {/* Líneas de corte horizontales */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  to bottom,
                  transparent 0px,
                  transparent ${s.lineGap}px,
                  ${cutColor} ${s.lineGap}px,
                  ${cutColor} ${s.lineGap + s.lineH}px
                )`,
              }}
            />
          </div>
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
