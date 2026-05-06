/**
 * SgccLogo — identidad visual oficial (rebrand SIGECC).
 *
 * Grid 2×2 de cuatro carpetas sin letras; cada carpeta mantiene su
 * acento de color (turquesa / ámbar / terracotta) sobre outline ink.
 * El wordmark "SIGECC" + descriptor vive en el lockup debajo del símbolo.
 *
 * Props:
 *   variant        — 'light' (default) para fondos claros, 'dark' para fondos oscuros
 *   size           — 'sm' | 'md' | 'lg' | 'xl'  (default 'md')
 *   showDescriptor — muestra wordmark + "Sistema de Gestión…" debajo del símbolo (default true)
 *   symbolOnly     — solo símbolo, sin descriptor ni espacio extra
 *   className      — clases adicionales del contenedor
 */

type Variant = "light" | "dark";
type Size = "sm" | "md" | "lg" | "xl";

export interface SgccLogoProps {
  variant?: Variant;
  size?: Size;
  showDescriptor?: boolean;
  symbolOnly?: boolean;
  className?: string;
}

type SizeTokens = { symbol: number; descriptor: number };

const SIZES: Record<Size, SizeTokens> = {
  sm: { symbol: 40, descriptor: 8 },
  md: { symbol: 60, descriptor: 10 },
  lg: { symbol: 90, descriptor: 12 },
  xl: { symbol: 132, descriptor: 14 },
};

export function SgccLogo({
  variant = "light",
  size = "md",
  showDescriptor = true,
  symbolOnly = false,
  className,
}: SgccLogoProps) {
  const ink = variant === "dark" ? "#FFFFFF" : "#0A1628";
  const descriptorColor =
    variant === "dark" ? "rgba(255,255,255,0.75)" : "rgba(10,22,40,0.75)";
  const wordmarkColor = variant === "dark" ? "#FFFFFF" : "#0A1628";
  const s = SIZES[size];

  const symbol = (
    <svg
      className="sgcc-symbol"
      viewBox="22 28 125 100"
      style={{ width: s.symbol, height: s.symbol }}
      fill="none"
      aria-label="SIGECC"
      role="img"
    >
      {/* Top-left (outline) */}
      <rect x="30" y="35" width="50" height="38" rx="3" stroke={ink} strokeWidth="4" />
      <path
        d="M30 35 L43 35 L48 41 L80 41"
        stroke={ink}
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* Top-right (turquoise) */}
      <rect x="85" y="35" width="50" height="38" rx="3" fill="#14B8A6" stroke={ink} strokeWidth="4" />
      <path
        d="M85 35 L98 35 L103 41 L135 41"
        stroke={ink}
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* Bottom-left (amber) */}
      <rect x="30" y="85" width="50" height="38" rx="3" fill="#F59E0B" stroke={ink} strokeWidth="4" />
      <path
        d="M30 85 L43 85 L48 91 L80 91"
        stroke={ink}
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* Bottom-right (terracotta) */}
      <rect x="85" y="85" width="50" height="38" rx="3" fill="#C65840" stroke={ink} strokeWidth="4" />
      <path
        d="M85 85 L98 85 L103 91 L135 91"
        stroke={ink}
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (symbolOnly) {
    return (
      <span
        className={className}
        style={{ display: "inline-block", color: ink, lineHeight: 0 }}
      >
        {symbol}
      </span>
    );
  }

  return (
    <div
      className={`sgcc-lockup ${className ?? ""}`.trim()}
      style={{
        color: ink,
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
      }}
    >
      {symbol}
      {showDescriptor && (
        <>
          <div
            style={{
              fontFamily: "var(--font-archivo), Archivo, system-ui, sans-serif",
              fontWeight: 900,
              fontSize: `${Math.round(s.symbol * 0.28)}px`,
              letterSpacing: "0.02em",
              lineHeight: 1,
              color: wordmarkColor,
              marginTop: 10,
            }}
          >
            SIGECC
          </div>
          <div
            style={{
              fontFamily: "var(--font-display), 'Space Grotesk', sans-serif",
              fontWeight: 500,
              fontSize: `${s.descriptor}px`,
              letterSpacing: "0.15em",
              lineHeight: 1.1,
              color: descriptorColor,
              textTransform: "uppercase",
              textAlign: "center",
              marginTop: 6,
              maxWidth: s.symbol * 2.4,
            }}
          >
            Sistema de Gestión para Centros de Conciliación
          </div>
        </>
      )}
    </div>
  );
}
