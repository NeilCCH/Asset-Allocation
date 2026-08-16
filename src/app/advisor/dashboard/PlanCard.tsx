"use client";

// 顧問方案卡 — 付費推薦(featured)的狀態與升級申請入口。
// 顧問只能「申請」;實際開通由平台方核准(featured 由 service_role/SQL 設定)。
import { useState } from "react";
import { requestFeatured } from "@/lib/actions/advisor";

export function PlanCard({
  featured,
  featuredUntil,
  featuredRequested,
}: {
  featured: boolean;
  featuredUntil?: string | null;
  featuredRequested: boolean;
}) {
  const [requested, setRequested] = useState(featuredRequested);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const active = featured && !!featuredUntil && new Date(featuredUntil).getTime() > Date.now();
  const expired = featured && !!featuredUntil && !active;
  const untilStr = featuredUntil ? new Date(featuredUntil).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }) : "";

  const apply = async () => {
    setBusy(true);
    setMsg(null);
    const res = await requestFeatured();
    setBusy(false);
    if (res.ok) setRequested(true);
    else setMsg(res.error);
  };

  // 已開通且未過期
  if (active) {
    return (
      <section className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/30">
        <div className="flex items-center gap-2">
          <span className="text-lg">⭐</span>
          <h2 className="text-base font-semibold text-amber-900 dark:text-amber-100">付費推薦方案(已開通)</h2>
        </div>
        <p className="mt-1.5 text-sm text-amber-800 dark:text-amber-200">
          你已在「未綁定客戶」的顧問推薦名單中<strong>優先曝光</strong>,能觸及更多潛在客戶。
        </p>
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">方案到期日:{untilStr}</p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">💠</span>
            <h2 className="text-base font-semibold">{expired ? "付費推薦已到期" : "目前方案:免費"}</h2>
          </div>
          {expired && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">到期日 {untilStr},續約後恢復優先曝光。</p>}
          <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-300">
            升級<strong>付費推薦</strong>後,系統會把你排在未綁定客戶的顧問推薦名單<strong>前列</strong>,
            優先取得主動上門的潛在客戶(名片驗證通過者更佳)。
          </p>
        </div>
        {requested ? (
          <span className="shrink-0 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            升級申請已送出,待開通
          </span>
        ) : (
          <button
            onClick={apply}
            disabled={busy}
            className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {busy ? "送出中…" : "申請付費推薦"}
          </button>
        )}
      </div>
      {msg && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{msg}</p>}
    </section>
  );
}
