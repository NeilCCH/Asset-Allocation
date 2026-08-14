import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// 應用圖示:翠綠底 + 白色甜甜圈環(呼應資產分布圖)。以幾何形狀繪製,免依賴 CJK 字型。
export default function Icon() {
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
        <div style={{ width: 300, height: 300, borderRadius: "50%", border: "72px solid white", boxSizing: "border-box" }} />
      </div>
    ),
    { ...size },
  );
}
