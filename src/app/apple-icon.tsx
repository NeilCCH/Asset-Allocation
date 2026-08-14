import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS「加入主畫面」圖示。
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#10b981",
        }}
      >
        <div style={{ width: 104, height: 104, borderRadius: "50%", border: "26px solid white", boxSizing: "border-box" }} />
      </div>
    ),
    { ...size },
  );
}
