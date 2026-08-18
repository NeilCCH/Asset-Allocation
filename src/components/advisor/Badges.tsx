// 顧問徽章呈現元件 — 專業徽章(證照)與檔案完成度。供顧問儀表板與客戶推薦卡共用。
import type { AdvisorLicense } from "@/lib/domain/licenses";
import { professionalBadges, profileCompleteness, type Badge, type BadgeTone, type CompletenessInput } from "@/lib/domain/advisorBadges";

const TONE: Record<BadgeTone, string> = {
  gold: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700",
  emerald: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
  sky: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
  violet: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800",
  amber: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  neutral: "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
};

export function BadgeChip({ badge, size = "sm" }: { badge: Badge; size?: "sm" | "xs" }) {
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${pad} ${TONE[badge.tone]}`}>
      {badge.tone === "gold" && <span aria-hidden>★</span>}
      {badge.label}
    </span>
  );
}

/** 專業徽章列(依證照分類)。無證照則不顯示。 */
export function ProBadges({ licenses, size = "sm" }: { licenses: AdvisorLicense[]; size?: "sm" | "xs" }) {
  const badges = professionalBadges(licenses);
  if (badges.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {badges.map((b) => (
        <BadgeChip key={b.label} badge={b} size={size} />
      ))}
    </span>
  );
}

/** 檔案完成度卡片(顧問自己看)— 進度條 + 尚缺項目提示。 */
export function CompletenessCard({ advisor }: { advisor: CompletenessInput }) {
  const c = profileCompleteness(advisor);
  const tone = c.tier === "完整" ? "bg-emerald-500" : c.tier === "進階" ? "bg-sky-500" : "bg-amber-500";
  const tierChip =
    c.tier === "完整"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : c.tier === "進階"
        ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return (
    <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">檔案完成度</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierChip}`}>{c.tier} · {c.pct}%</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${c.pct}%` }} />
      </div>
      {c.missing.length > 0 ? (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          補齊以下項目可提升專業形象與客戶信任:
          <span className="font-medium text-neutral-700 dark:text-neutral-200">{c.missing.join("、")}</span>
        </p>
      ) : (
        <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">✓ 檔案已完整,專業形象滿分!</p>
      )}
    </section>
  );
}
