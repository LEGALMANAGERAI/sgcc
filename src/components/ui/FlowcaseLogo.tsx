/**
 * FlowcaseLogo — identidad visual oficial.
 * Spec: docs/flowcase-brand-brief.md §2.1–2.4
 *
 * Variants:
 *   full     → symbol + wordmark + descriptor (lockup completo)
 *   lockup   → symbol + wordmark (sin descriptor)
 *   symbol   → solo el grid 2×2 de carpetas
 *   wordmark → solo "Flowcase"
 */

type Size = "sm" | "md" | "lg" | "xl";
type Variant = "full" | "lockup" | "symbol" | "wordmark";

interface Props {
  size?: Size;
  variant?: Variant;
  darkBg?: boolean;
  className?: string;
}

type SizeTokens = {
  symbolH: number;
  wordmarkFs: number;
  stroke: number;
  descriptorFs: number;
};

const SIZES: Record<Size, SizeTokens> = {
  sm: { symbolH: 40, wordmarkFs: 30, stroke: 4, descriptorFs: 9 },
  md: { symbolH: 60, wordmarkFs: 45, stroke: 5, descriptorFs: 11 },
  lg: { symbolH: 88, wordmarkFs: 66, stroke: 6, descriptorFs: 13 },
  xl: { symbolH: 132, wordmarkFs: 100, stroke: 7, descriptorFs: 16 },
};

const INK = "#0A1628";
const PAPER = "#FAF7F2";

type Folder = {
  x: number;
  y: number;
  letter: string;
  fill: string | "none";
  letterCx: number;
  letterCy: number;
};

const FOLDERS: Folder[] = [
  { x: 30, y: 39, letter: "S", fill: "none", letterCx: 55, letterCy: 64 },
  { x: 85, y: 39, letter: "G", fill: "#14B8A6", letterCx: 110, letterCy: 64 },
  { x: 30, y: 89, letter: "C", fill: "#F59E0B", letterCx: 55, letterCy: 114 },
  { x: 85, y: 89, letter: "C", fill: "#C65840", letterCx: 110, letterCy: 114 },
];

function folderPath(x: number, y: number, rx = 3): string {
  const w = 50;
  const hBody = 38;
  const tabH = 6;
  const tabW = 13;
  const tabRampX = 18;
  const xR = x + w;
  const yTabBottom = y + tabH;
  const yBodyBottom = y + tabH + hBody;
  return [
    `M ${x} ${y}`,
    `L ${x + tabW} ${y}`,
    `L ${x + tabRampX} ${yTabBottom}`,
    `L ${xR - rx} ${yTabBottom}`,
    `Q ${xR} ${yTabBottom} ${xR} ${yTabBottom + rx}`,
    `L ${xR} ${yBodyBottom - rx}`,
    `Q ${xR} ${yBodyBottom} ${xR - rx} ${yBodyBottom}`,
    `L ${x + rx} ${yBodyBottom}`,
    `Q ${x} ${yBodyBottom} ${x} ${yBodyBottom - rx}`,
    `L ${x} ${y}`,
    "Z",
  ].join(" ");
}

function Symbol({ stroke, darkBg }: { stroke: number; darkBg?: boolean }) {
  return (
    <svg
      viewBox="22 28 125 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="FlowCase"
      role="img"
      style={{ overflow: "visible", height: "100%", width: "auto" }}
    >
      {FOLDERS.map((f, i) => {
        const isOutlined = f.fill === "none";
        const strokeColor = isOutlined && darkBg ? PAPER : INK;
        const letterColor = isOutlined && darkBg ? PAPER : INK;
        return (
          <g key={i}>
            <path
              d={folderPath(f.x, f.y)}
              fill={f.fill}
              stroke={strokeColor}
              strokeWidth={stroke}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <text
              x={f.letterCx}
              y={f.letterCy}
              fill={letterColor}
              fontFamily="var(--font-archivo), 'Archivo', system-ui, sans-serif"
              fontSize={22}
              fontWeight={900}
              letterSpacing="-0.05em"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {f.letter}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Wordmark({ fontSize, darkBg }: { fontSize: number; darkBg?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-display), system-ui, sans-serif",
        fontSize: `${fontSize}px`,
        letterSpacing: "-0.055em",
        lineHeight: 0.88,
        color: darkBg ? PAPER : INK,
        display: "inline-flex",
        alignItems: "center",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontWeight: 700 }}>Flow</span>
      <span style={{ fontWeight: 300 }}>case</span>
    </span>
  );
}

function Descriptor({ fontSize, darkBg }: { fontSize: number; darkBg?: boolean }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-display), system-ui, sans-serif",
        fontWeight: 500,
        fontSize: `${fontSize}px`,
        letterSpacing: "0.15em",
        lineHeight: 1.1,
        color: darkBg ? "rgba(250, 247, 242, 0.75)" : "rgba(10, 22, 40, 0.75)",
        textTransform: "uppercase",
        textAlign: "center",
        marginTop: 0,
      }}
    >
      Sistema de Gestión para Centros
      <br />
      de Conciliación
    </div>
  );
}

export function FlowcaseLogo({
  size = "md",
  variant = "lockup",
  darkBg,
  className,
}: Props) {
  const s = SIZES[size];

  if (variant === "symbol") {
    return (
      <div
        className={className}
        style={{ display: "inline-block", height: s.symbolH }}
      >
        <Symbol stroke={s.stroke} darkBg={darkBg} />
      </div>
    );
  }

  if (variant === "wordmark") {
    return (
      <span
        className={className}
        style={{ display: "inline-block" }}
      >
        <Wordmark fontSize={s.wordmarkFs} darkBg={darkBg} />
      </span>
    );
  }

  const lockupRow = (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0,
        height: s.symbolH,
      }}
    >
      <div style={{ height: s.symbolH }}>
        <Symbol stroke={s.stroke} darkBg={darkBg} />
      </div>
      <Wordmark fontSize={s.wordmarkFs} darkBg={darkBg} />
    </div>
  );

  if (variant === "lockup") {
    return (
      <div className={className} style={{ display: "inline-flex" }}>
        {lockupRow}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {lockupRow}
      <Descriptor fontSize={s.descriptorFs} darkBg={darkBg} />
    </div>
  );
}
