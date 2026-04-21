import { ImageResponse } from "next/og";

export const size = { width: 128, height: 128 };
export const contentType = "image/png";

const NAVY = "#0D2340";
const BLUE = "#1B4F9B";

const cellStyle = (bg: string): React.CSSProperties => ({
  width: "50%",
  height: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: bg,
  color: "white",
  fontSize: 56,
  fontWeight: 900,
  fontFamily: "system-ui, -apple-system, sans-serif",
  letterSpacing: -2,
});

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: "100%",
          height: "100%",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div style={cellStyle(NAVY)}>S</div>
        <div style={cellStyle(BLUE)}>G</div>
        <div style={cellStyle(BLUE)}>C</div>
        <div style={cellStyle(NAVY)}>C</div>
      </div>
    ),
    { ...size }
  );
}
