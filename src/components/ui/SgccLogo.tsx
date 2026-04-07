interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SIZES = {
  sm: { letterSize: "text-xl", gap: "gap-0.5", textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { letterSize: "text-3xl", gap: "gap-1", textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { letterSize: "text-5xl", gap: "gap-1.5", textSize: "text-xs", boldSize: "text-sm" },
  xl: { letterSize: "text-7xl", gap: "gap-2", textSize: "text-sm", boldSize: "text-base" },
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
      {/* Letras con estilo bloque entrecortado */}
      <div className={`flex ${s.gap}`}>
        {LETTERS.map((l, i) => (
          <span
            key={i}
            className={`${s.letterSize} font-black leading-none tracking-tight select-none`}
            style={{
              color: l.color,
              WebkitTextStroke: "0.5px currentColor",
              backgroundImage: darkBg
                ? "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(13,35,64,0.5) 3px, rgba(13,35,64,0.5) 5px)"
                : "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.6) 3px, rgba(255,255,255,0.6) 5px)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
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
