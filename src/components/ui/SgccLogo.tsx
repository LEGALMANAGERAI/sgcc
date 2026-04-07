interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  darkBg?: boolean;
}

const SCALE = { sm: 0.45, md: 0.6, lg: 0.8, xl: 1.05 };
const TEXT_SIZES = {
  sm: { textSize: "text-[8px]", boldSize: "text-[9px]" },
  md: { textSize: "text-[10px]", boldSize: "text-xs" },
  lg: { textSize: "text-xs", boldSize: "text-sm" },
  xl: { textSize: "text-sm", boldSize: "text-base" },
};

/*
 * Letras como paths abiertos (sin cerrar) para que las terminales
 * no tengan línea de conexión. Cada letra es un trazo libre.
 * Coordenadas diseñadas en un viewBox de 230 x 70.
 */

/* S: dos arcos invertidos formando la S */
const S_PATH =
  "M 34,12 C 34,4 8,2 8,18 C 8,30 34,30 34,44 C 34,60 8,60 8,50";

/* G: arco tipo C con barra horizontal entrando desde la derecha */
const G_PATH =
  "M 76,12 C 60,2 44,8 44,34 C 44,60 60,64 76,54 L 76,36 L 60,36";

/* C1: arco abierto */
const C1_PATH =
  "M 118,12 C 102,2 86,8 86,34 C 86,60 102,64 118,54";

/* C2: arco abierto */
const C2_PATH =
  "M 160,12 C 144,2 128,8 128,34 C 128,60 144,64 160,54";

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
  const sw = 5;

  return (
    <div className="flex items-center gap-3">
      <svg
        width={170 * sc}
        height={70 * sc}
        viewBox="0 0 170 70"
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
            strokeWidth={sw}
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
