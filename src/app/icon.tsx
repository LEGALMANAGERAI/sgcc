import { ImageResponse } from "next/og";

export const size = { width: 128, height: 128 };
export const contentType = "image/png";

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
        <div style={cellStyle("#0D2340")}>S</div>
        <div style={cellStyle("#2563EB")}>G</div>
        <div style={cellStyle("#9333EA")}>C</div>
        <div style={cellStyle("#16A34A")}>C</div>
      </div>
    ),
    { ...size }
  );
}
