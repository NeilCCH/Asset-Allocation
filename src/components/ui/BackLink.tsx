// 返回連結 — 膠囊外框 + SVG 箭頭,hover 時箭頭左移並帶主題色。取代單純「← 文字」。
import Link from "next/link";

type Accent = "neutral" | "sky" | "emerald";

const ACCENT: Record<Accent, string> = {
  neutral: "hover:border-neutral-300 hover:text-neutral-800 dark:hover:border-neutral-600 dark:hover:text-neutral-100",
  sky: "hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-sky-700 dark:hover:bg-sky-950/40 dark:hover:text-sky-300",
  emerald:
    "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300",
};

export function BackLink({
  href,
  label,
  accent = "neutral",
  className = "",
}: {
  href: string;
  label: string;
  accent?: Accent;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/70 py-1.5 pl-2.5 pr-3.5 text-sm font-medium text-neutral-500 shadow-sm backdrop-blur transition-colors dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-400 ${ACCENT[accent]} ${className}`}
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.5 5 7.5 10l5 5" />
      </svg>
      {label}
    </Link>
  );
}
