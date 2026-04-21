import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
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
          background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
          color: "white",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: -1,
          borderRadius: 6,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        SGCC
      </div>
    ),
    { ...size }
  );
}
