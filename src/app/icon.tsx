import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "white",
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: -2,
          borderRadius: 12,
          fontFamily: "system-ui, -apple-system, sans-serif",
          border: "2px solid #E5E7EB",
        }}
      >
        <span style={{ color: "#0D2340" }}>S</span>
        <span style={{ color: "#2563EB" }}>G</span>
        <span style={{ color: "#9333EA" }}>C</span>
        <span style={{ color: "#16A34A" }}>C</span>
      </div>
    ),
    { ...size }
  );
}
