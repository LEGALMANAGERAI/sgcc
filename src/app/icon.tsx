import { ImageResponse } from "next/og";

/**
 * Favicon dinámico — símbolo SGCC (grid 2×2 sin letras, para favicons pequeños).
 */

export const size = { width: 128, height: 128 };
export const contentType = "image/png";

const INK = "#0A1628";
const FLOW = "#14B8A6";
const AMBER = "#F59E0B";
const TERRACOTTA = "#C65840";
const PAPER = "#FAF7F2";

const baseCell: React.CSSProperties = {
  flex: 1,
  border: `5px solid ${INK}`,
  borderRadius: 10,
  boxSizing: "border-box",
};

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: PAPER,
          padding: 8,
          gap: 6,
        }}
      >
        <div style={{ display: "flex", flex: 1, gap: 6 }}>
          <div style={{ ...baseCell, background: "transparent" }} />
          <div style={{ ...baseCell, background: FLOW }} />
        </div>
        <div style={{ display: "flex", flex: 1, gap: 6 }}>
          <div style={{ ...baseCell, background: AMBER }} />
          <div style={{ ...baseCell, background: TERRACOTTA }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
