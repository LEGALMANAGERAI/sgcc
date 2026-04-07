interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SCALE = { sm: 0.5, md: 0.65, lg: 0.85, xl: 1.1 };
const TEXT_SIZES = {
  sm: { textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { textSize: "text-xs", boldSize: "text-sm" },
  xl: { textSize: "text-sm", boldSize: "text-base" },
};

/*
 * Letras construidas con arcos SVG geométricos (A command).
 * Paths abiertos = terminales sin línea de conexión.
 * ViewBox: 0 0 200 72
 */

/* S: dos arcos elípticos conectados formando la S */
const S_PATH = "M 36,12 A 18,16 0 1,0 10,36 A 18,16 0 1,1 36,60";

/* G: arco grande (como C) + barra horizontal entrando */
const G_PATH = "M 90,12 A 22,26 0 1,0 90,60 L 90,38 L 68,38";

/* C: arco abierto limpio */
const C1_PATH = "M 140,12 A 22,26 0 1,0 140,60";

/* C: arco abierto limpio */
const C2_PATH = "M 190,12 A 22,26 0 1,0 190,60";

const LETTERS = [
  { path: S_PATH, color: "#1B4F9B" },
  { path: G_PATH, color: "#2A9D5C" },
  { path: C1_PATH, color: "#E8732A" },
  { path: C2_PATH, color: "#D42B2B" },
];

export function SgccLogo({ size = "md", showText = true, darkBg = false }: Props) {
  const sc = SCALE[size];
  const ts = TEXT_SIZES[size];
  const textColor = darkBg ? "text-white/80" : "text-gray-500";
  const boldColor = darkBg ? "text-white" : "text-gray-900";

  return (
    <div className="flex items-center gap-3">
      <svg
        width={200 * sc}
        height={72 * sc}
        viewBox="0 0 200 72"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
        aria-label="SGCC"
        role="img"
      >
        {LETTERS.map((l, i) => (
          <path
            key={i}
            d={l.path}
            fill="none"
            stroke={l.color}
            strokeWidth={5.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>

      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          <span className={`${ts.textSize} ${textColor} font-medium uppercase tracking-widest`}>
            Sistema de Gesti&oacute;n
          </span>
          <span className={`${ts.boldSize} ${boldColor} font-extrabold uppercase tracking-wide`}>
            para Centros de Conciliaci&oacute;n
          </span>
        </div>
      )}
    </div>
  );
}
