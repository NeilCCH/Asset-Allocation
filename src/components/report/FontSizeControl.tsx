"use client";

// 報告字級調整(螢幕閱讀用;列印輸出維持一致版式,不受影響)。
// 預設客戶為 40–50 歲閱覽,可自行放大字級。
export type FontScale = "base" | "lg" | "xl";

const OPTS: { v: FontScale; label: string; size: number }[] = [
  { v: "base", label: "標準", size: 12 },
  { v: "lg", label: "大", size: 14 },
  { v: "xl", label: "特大", size: 16 },
];

export function FontSizeControl({ value, onChange }: { value: FontScale; onChange: (v: FontScale) => void }) {
  return (
    <div
      role="group"
      aria-label="調整字體大小"
      className="inline-flex items-center gap-0.5 rounded-lg border border-neutral-200 p-0.5 print:hidden dark:border-neutral-800"
    >
      <span className="px-1.5 text-xs text-neutral-400" aria-hidden>
        字級
      </span>
      {OPTS.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={`rounded-md px-2 py-1 leading-none transition-colors ${
            value === o.v
              ? "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900"
              : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
          style={{ fontSize: o.size }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
