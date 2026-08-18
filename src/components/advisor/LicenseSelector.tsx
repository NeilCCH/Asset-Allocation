"use client";

// 證照選擇器 — 依分類分組呈現(保險 / 理財規劃認證 / 信託・投信投顧),供顧問註冊與編輯共用。
import { LICENSE_OPTIONS, type LicenseType, type LicenseCategory } from "@/lib/domain/licenses";

const CATEGORY_META: Record<LicenseCategory, { badge: string; ring: string }> = {
  保險: { badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", ring: "border-violet-200 dark:border-violet-900/60" },
  理財規劃認證: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", ring: "border-emerald-200 dark:border-emerald-900/60" },
  "信託・投信投顧": { badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300", ring: "border-sky-200 dark:border-sky-900/60" },
};

const CATEGORY_ORDER: LicenseCategory[] = ["保險", "理財規劃認證", "信託・投信投顧"];

const groups = CATEGORY_ORDER.map((category) => ({
  category,
  options: LICENSE_OPTIONS.filter((o) => o.category === category),
}));

export function LicenseSelector({
  value,
  onToggle,
  onSetNo,
  accent = "sky",
}: {
  value: Partial<Record<LicenseType, string>>;
  onToggle: (l: LicenseType) => void;
  onSetNo: (l: LicenseType, no: string) => void;
  accent?: "sky" | "emerald";
}) {
  const accentCheckbox = accent === "emerald" ? "accent-emerald-600" : "accent-sky-600";
  const accentFocus = accent === "emerald" ? "focus:border-emerald-500" : "focus:border-sky-500";
  const accentActive =
    accent === "emerald"
      ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
      : "border-sky-400 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/30";

  return (
    <div className="space-y-3">
      {groups.map(({ category, options }) => {
        const meta = CATEGORY_META[category];
        const count = options.filter((o) => o.value in value).length;
        return (
          <div key={category} className={`rounded-xl border ${meta.ring} p-3`}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>{category}</span>
              {count > 0 && <span className="text-xs text-neutral-400">已選 {count}</span>}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {options.map((o) => {
                const checked = o.value in value;
                return (
                  <div
                    key={o.value}
                    className={`rounded-lg border p-2.5 transition-colors ${
                      checked ? accentActive : "border-neutral-200 dark:border-neutral-800"
                    }`}
                  >
                    <label className="flex items-start gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(o.value)}
                        className={`mt-0.5 h-4 w-4 ${accentCheckbox}`}
                      />
                      <span className="leading-snug">
                        {o.label}
                        {o.note && <span className="mt-0.5 block text-xs font-normal text-neutral-400">{o.note}</span>}
                      </span>
                    </label>
                    {checked && o.requiresNumber && (
                      <input
                        value={value[o.value] ?? ""}
                        onChange={(e) => onSetNo(o.value, e.target.value)}
                        placeholder="合格證號"
                        className={`mt-2 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none ${accentFocus} dark:border-neutral-700 dark:bg-neutral-900`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
