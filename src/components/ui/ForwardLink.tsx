// 前往連結 — 膠囊外框 + SVG 右箭頭,hover 時箭頭右移並帶主題色。取代單純「文字 →」。
// 與 BackLink 對稱。variant: ghost(外框,適合清單重複使用)/ solid(填色,主要動作)。
import Link from "next/link";

type Accent = "sky" | "emerald";
type Variant = "ghost" | "solid";

const GHOST: Record<Accent, string> = {
  sky: "border border-sky-200 bg-white/70 text-sky-700 shadow-sm backdrop-blur hover:border-sky-300 hover:bg-sky-50 dark:border-sky-800 dark:bg-neutral-900/70 dark:text-sky-300 dark:hover:bg-sky-950/40",
  emerald:
    "border border-emerald-200 bg-white/70 text-emerald-700 shadow-sm backdrop-blur hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-neutral-900/70 dark:text-emerald-300 dark:hover:bg-emerald-950/40",
};

const SOLID: Record<Accent, string> = {
  sky: "bg-sky-600 text-white shadow-sm hover:bg-sky-700",
  emerald: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
};

export function ForwardLink({
  href,
  label,
  accent = "sky",
  variant = "ghost",
  className = "",
}: {
  href: string;
  label: string;
  accent?: Accent;
  variant?: Variant;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-2.5 text-sm font-medium transition-colors ${
        variant === "solid" ? SOLID[accent] : GHOST[accent]
      } ${className}`}
    >
      {label}
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7.5 5 12.5 10l-5 5" />
      </svg>
    </Link>
  );
}
