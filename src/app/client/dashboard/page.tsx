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
import { loadDraft } from "@/lib/draft";

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
  useEffect(() => setData(loadDraft()), []);

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
      gaps: computeGaps(data),
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
      </Card>

      {/* 保障 vs 投資 */}
      <Card title="保障 vs 投資 比重">
        <Bar2 left={{ label: "保障型", value: pvi.protection, color: "#8b5cf6" }} right={{ label: "投資型", value: pvi.investment, color: "#0ea5e9" }} />
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          保單刻意區分「保障型」與「儲蓄/投資型」,幫助你看清保障與資產累積各占多少。
        </p>
      </Card>

      {/* 缺口概況 */}
      <Card title="缺口概況(客觀試算)">
        <div className="space-y-3">
          <GapRow name="退休金缺口" gap={view.gaps.retirement} />
          <GapRow name="保障缺口" gap={view.gaps.protection} />
          <GapRow name="教育金缺口" gap={view.gaps.education} />
        </div>
        <p className="mt-4 rounded-lg bg-neutral-100 p-3 text-xs leading-relaxed text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          試算採透明公式與保守假設(報酬 4% / 通膨 2% / 餘命 85 歲),僅供檢視參考,不構成投資建議。
          完整的保障與教育金缺口需補充「深化問卷」後試算。
        </p>
      </Card>

      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        想更完整的規劃?你的財富管理顧問可依此健檢,與你討論後續配置方向。
      </div>
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
