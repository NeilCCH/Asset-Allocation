"use client";

// 彙整儀表板 — 客戶可見「事實層」。⚠️ 合規:不得顯示 leads 評分或配置面向建議,
// 不得 import @/lib/domain/leads。此頁只呈現客觀試算。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { QuestionnaireData } from "@/lib/domain/types";
import {
  assetBreakdown,
  computeGaps,
  liquidAssets,
  protectionVsInvestment,
  sumAssets,
  type GapResult,
} from "@/lib/domain/calc";
import { clientDefaultParams } from "@/lib/domain/params";
import { loadDraft } from "@/lib/draft";
import { createClient } from "@/lib/supabase/client";

const CATEGORY_COLOR: Record<string, string> = {
  流動: "#10b981",
  投資: "#0ea5e9",
  保障: "#8b5cf6",
  不動產: "#f59e0b",
  其他: "#94a3b8",
};

function fmt(wan: number): string {
  const v = Math.round(wan);
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)} 億`;
  return `${v.toLocaleString("zh-TW")} 萬`;
}

export default function Dashboard() {
  const [data, setData] = useState<QuestionnaireData | null | undefined>(undefined);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        setLoggedIn(true);
        const { data: rows } = await supabase
          .from("clients")
          .select("questionnaire_responses(basic, core, deep, kyc)")
          .eq("auth_user_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const qr = (rows as { questionnaire_responses?: { basic: unknown; core: unknown; deep: unknown; kyc: unknown }[] }[] | null)?.[0]
          ?.questionnaire_responses?.[0];
        if (qr?.core) {
          setData({ basic: qr.basic, core: qr.core, deep: qr.deep ?? undefined, kyc: qr.kyc ?? undefined } as QuestionnaireData);
          return;
        }
      }
      setData(loadDraft());
    })();
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const breakdown = assetBreakdown(data.core.assets).filter((a) => a.amount > 0);
    const byCategory = new Map<string, number>();
    breakdown.forEach((a) => byCategory.set(a.category, (byCategory.get(a.category) ?? 0) + a.amount));
    return {
      total: sumAssets(data.core.assets),
      liquid: liquidAssets(data.core.assets),
      pvi: protectionVsInvestment(data.core.assets),
      pie: [...byCategory.entries()].map(([category, amount]) => ({ name: category, value: amount })),
      gaps: computeGaps(data, clientDefaultParams(data.basic.honorific)),
    };
  }, [data]);

  if (data === undefined) return <Center>載入中…</Center>;
  if (data === null || !view)
    return (
      <Center>
        <p className="mb-4 text-neutral-600 dark:text-neutral-300">尚未有作答資料。</p>
        <Link href="/client/assessment" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
          開始填問卷
        </Link>
      </Center>
    );

  const { pvi } = view;
  const pviTotal = pvi.protection + pvi.investment;
  const protectionPct = pviTotal > 0 ? Math.round((pvi.protection / pviTotal) * 100) : 0;
  const liquidPct = view.total > 0 ? Math.round((view.liquid / view.total) * 100) : 0;

  // 資產分布文字敘述:最大類別 + 流動性
  const topCat = [...view.pie].sort((a, b) => b.value - a.value)[0];
  const topPct = topCat && view.total > 0 ? Math.round((topCat.value / view.total) * 100) : 0;
  const assetNarrative = topCat
    ? `你的資產以「${topCat.name}」為主,約占 ${topPct}%;流動資產占 ${liquidPct}%。` +
      (liquidPct < 10 ? "流動性偏低,建議留意短期資金調度。" : topPct > 60 ? "單一類別占比偏高,可留意分散。" : "整體分布尚屬均衡。")
    : "";

  // 現有保障總覽(各險種單位不同)
  const ins = data.deep?.insurance_detail;
  const insRows = ins
    ? [
        { label: "壽險", has: ins.life.has, text: `保額 ${ins.life.coverage} 萬` },
        { label: "重大疾病", has: ins.critical_illness.has, text: `一次金 ${ins.critical_illness.coverage} 萬` },
        { label: "意外", has: ins.accident.has, text: `保額 ${ins.accident.coverage} 萬` },
        { label: "醫療", has: ins.medical.has, text: `日額 ${ins.medical.daily} 元 · 實支 ${ins.medical.reimburse_limit} 萬` },
        { label: "失能", has: ins.disability.has, text: `每月 ${ins.disability.monthly} 萬` },
        { label: "長照", has: ins.long_term_care.has, text: `每月 ${ins.long_term_care.monthly} 萬` },
      ]
    : [];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-12">
      <div className="flex items-center justify-between">
        <Link href="/client" className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
          ← 返回
        </Link>
        <Link href="/client/assessment" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">
          重新填寫
        </Link>
      </div>

      {!loggedIn && (
        <Link
          href="/client/account"
          className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <span>建立帳號,日後可隨時登入回看此健檢</span>
          <span className="font-medium">建立帳號 →</span>
        </Link>
      )}

      <header className="mt-4">
        <h1 className="text-2xl font-bold">
          {data.basic.surname}
          {data.basic.honorific} 的資產健檢
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          以下為客觀彙整與試算,供你檢視資產現況全貌。
        </p>
      </header>

      {/* 關鍵數字 */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="資產總額" value={fmt(view.total)} />
        <Stat label="流動資產占比" value={`${liquidPct}%`} hint={fmt(view.liquid)} />
        <Stat label="保障型占比" value={`${protectionPct}%`} hint="保障 vs 投資" />
      </div>

      {/* 資產分布 */}
      <Card title="資產類別分布">
        {view.pie.length === 0 ? (
          <Empty>尚未填入任何資產金額</Empty>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={view.pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {view.pie.map((entry) => (
                    <Cell key={entry.name} fill={CATEGORY_COLOR[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {assetNarrative && (
          <p className="mt-2 rounded-lg bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
            {assetNarrative}
          </p>
        )}
      </Card>

      {/* 保障 vs 投資 */}
      <Card title="保障 vs 投資 比重">
        <Bar2 left={{ label: "保障型", value: pvi.protection, color: "#8b5cf6" }} right={{ label: "投資型", value: pvi.investment, color: "#0ea5e9" }} />
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          保單刻意區分「保障型」與「儲蓄/投資型」,幫助你看清保障與資產累積各占多少。
        </p>
      </Card>

      {/* 現有保障總覽 */}
      {insRows.length > 0 && (
        <Card title="現有保障總覽">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {insRows.map((r) => (
              <div
                key={r.label}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  r.has
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <span className="font-medium">
                  {r.has ? "✓ " : "— "}
                  {r.label}
                </span>
                <span className={r.has ? "text-emerald-700 dark:text-emerald-300" : "text-neutral-400"}>
                  {r.has ? r.text : "尚無"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            各險種單位不同:壽險/意外/重疾為保額(萬)、醫療為日額+實支實付、失能/長照為每月給付。
          </p>
        </Card>
      )}

      {/* 缺口概況 */}
      <Card title="缺口概況(客觀試算)">
        <div className="space-y-3">
          <GapRow name="退休金缺口" gap={view.gaps.retirement} />
          <GapRow name="保障缺口" gap={view.gaps.protection} />
          <GapRow name="教育金缺口" gap={view.gaps.education} />
        </div>
        <p className="mt-4 rounded-lg bg-neutral-100 p-3 text-xs leading-relaxed text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          試算採透明公式與保守假設(報酬 4% / 通膨 2% / 台灣平均餘命),僅供檢視參考,不構成投資建議。
          {(view.gaps.protection.status === "needs_deep_data" || view.gaps.education.status === "needs_deep_data") &&
            "部分缺口需補充深化問卷(負債、保障、教育金)後才能試算。"}
        </p>
      </Card>

      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        想更完整的規劃?你的財富管理顧問可依此健檢,與你討論後續配置方向。
      </div>

      <Link
        href="/client/report"
        className="mt-4 block rounded-lg border border-neutral-300 py-3 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
      >
        產出健檢報告 →
      </Link>
    </main>
  );
}

// ── 子元件 ───────────────────────────────────────────

function Center({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">{children}</main>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-lg font-bold sm:text-xl">{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      {hint && <div className="text-[11px] text-neutral-400">{hint}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-10 text-center text-sm text-neutral-400">{children}</div>;
}

function Bar2({ left, right }: { left: { label: string; value: number; color: string }; right: { label: string; value: number; color: string } }) {
  const total = left.value + right.value;
  const lp = total > 0 ? (left.value / total) * 100 : 50;
  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        {total > 0 && (
          <>
            <div style={{ width: `${lp}%`, background: left.color }} />
            <div style={{ width: `${100 - lp}%`, background: right.color }} />
          </>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: left.color }} />
          {left.label} {fmt(left.value)}
        </span>
        <span className="flex items-center gap-1.5">
          {right.label} {fmt(right.value)}
          <span className="h-2 w-2 rounded-full" style={{ background: right.color }} />
        </span>
      </div>
    </div>
  );
}

function GapRow({ name, gap }: { name: string; gap: GapResult }) {
  if (gap.status === "needs_deep_data") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed border-neutral-300 px-4 py-3 dark:border-neutral-700">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-xs text-neutral-400">補充深化問卷後可試算</span>
      </div>
    );
  }
  const shortfall = gap.gap > 0;
  return (
    <div className={`rounded-lg border px-4 py-3 ${shortfall ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{name}</span>
        <span className={`text-sm font-semibold ${shortfall ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
          {shortfall ? `不足 ${fmt(gap.gap)}` : "已足夠"}
        </span>
      </div>
    </div>
  );
}
