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
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/logo-180.png",
  },
};

export const viewport: Viewport = { themeColor: "#1e6fd9" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="mt-auto border-t border-neutral-200 px-5 py-3 text-center text-[11px] leading-relaxed text-neutral-400 print:hidden dark:border-neutral-800">
          本工具之試算與資訊僅供參考，不構成投資、稅務或法律建議；實際情形以個案狀況及主管機關/國稅局核定為準。
        </footer>
      </body>
    </html>
  );
}
