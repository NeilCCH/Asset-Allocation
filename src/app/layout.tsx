import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "資產配置健檢 | 財富管理顧問工具",
  description: "跨資產類別的配置檢視與缺口試算 — 檢視、試算、教育",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "資產健檢", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#10b981" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
