import type { MetadataRoute } from "next";

// PWA manifest —「加入主畫面」時的 App 名稱、圖示、主題色。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "資產配置健檢",
    short_name: "資產健檢",
    description: "跨資產類別的配置檢視與缺口試算",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#10b981",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
