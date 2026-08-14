"use client";

// 顧問工作台 — ⚠️ 顧問專屬,此區內容不會、也不得呈現給客戶。
// 配置面向採「顧問手動勾選」;系統僅提供中性提示(flagged)作參考,不代為決定。
import { useState } from "react";
import Link from "next/link";
import type { LeadScore } from "@/lib/domain/leads";
import { saveAdvisorWorkbench } from "@/lib/actions/advisor";

interface Dimension {
  key: string;
  title: string;
  desc: string;
  flagged: boolean;
  note?: string;
}

interface GapItem {
  name: string;
  status: "computed" | "needs_deep_data";
  gap: number;
}

export function AdvisorWorkbench({
  clientId,
  canSave,
  surname,
  score,
  gaps,
  dimensions,
  savedRecommendation,
  savedDimensionKeys,
}: {
  clientId: string;
  canSave: boolean;
  surname: string;
  score: LeadScore;
  gaps: GapItem[];
  dimensions: Dimension[];
  savedRecommendation: string;
  savedDimensionKeys: string[];
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(savedDimensionKeys.map((k) => [k, true])),
  );
  const [reco, setReco] = useState(savedRecommendation);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const toggle = (k: string) => setChecked((p) => ({ ...p, [k]: !p[k] }));

  const save = async () => {
    setSaving(true);
    setSavedMsg(null);
    const dimensionKeys = Object.entries(checked).filter(([, v]) => v).map(([k]) => k);
    const res = await saveAdvisorWorkbench({ clientId, recommendation: reco, dimensionKeys });
    setSaving(false);
    setSavedMsg(res.ok ? "已儲存 ✓" : `儲存失敗:${res.error}`);
  };

  const factorLabels: { key: keyof LeadScore["factors"]; label: string; max: number }[] = [
    { key: "assetScale", label: "資產規模", max: 30 },
    { key: "cashFlow", label: "現金流健康", max: 20 },
    { key: "needClarity", label: "需求明確度", max: 20 },
    { key: "urgency", label: "急迫性", max: 20 },
    { key: "engagement", label: "互動意願", max: 10 },
  ];

  return (
    <div className="mt-6 space-y-5">
      <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        🔒 以下為顧問決策輔助區,僅你可見,系統不會呈現給客戶。
      </div>

      {/* Leads 評分 */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">有效客戶評分</h2>
          <span className="flex items-center gap-2">
            <span className="text-2xl font-bold">{score.total}</span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-sm font-bold dark:bg-neutral-800">{score.grade} 級</span>
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {factorLabels.map((f) => {
            const v = score.factors[f.key];
            return (
              <div key={f.key} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-neutral-500 dark:text-neutral-400">{f.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${(v / f.max) * 100}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right tabular-nums text-neutral-500 dark:text-neutral-400">
                  {v}/{f.max}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 缺口 */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="mb-3 text-base font-semibold">缺口試算</h2>
        <div className="grid grid-cols-3 gap-3">
          {gaps.map((g) => (
            <div key={g.name} className="rounded-lg border border-neutral-200 p-3 text-center dark:border-neutral-800">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{g.name}</div>
              <div className="mt-1 text-sm font-semibold">
                {g.status === "needs_deep_data" ? (
                  <span className="text-neutral-400">待深化</span>
                ) : g.gap > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">缺 {Math.round(g.gap)} 萬</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">足夠</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 配置面向參考框架(手動勾選) */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-base font-semibold">配置面向參考框架</h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          由你依專業判斷勾選要與客戶討論的面向。系統的
          <span className="mx-1 rounded bg-amber-100 px-1 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">提示</span>
          僅為事實觀察,不代表建議。面向皆為類別層級,不含個別商品。
        </p>
        <div className="mt-4 space-y-2">
          {dimensions.map((d) => (
            <label
              key={d.key}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                checked[d.key]
                  ? "border-sky-400 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/30"
                  : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/50"
              }`}
            >
              <input type="checkbox" checked={!!checked[d.key]} onChange={() => toggle(d.key)} className="mt-0.5 h-4 w-4 accent-sky-600" />
              <span className="flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {d.title}
                  {d.flagged && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-normal text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      提示{d.note ? ` · ${d.note}` : ""}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">{d.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* 顧問建議草稿 */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-base font-semibold">對客戶的規劃建議(顧問撰寫)</h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          由你本人(具專業資格)消化上述資訊後撰寫,將納入健檢報告。
        </p>
        <textarea
          value={reco}
          onChange={(e) => setReco(e.target.value)}
          rows={5}
          placeholder={`針對 ${surname} 的現況,建議討論的規劃方向…`}
          className="mt-3 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-neutral-400">
            已勾選 {Object.values(checked).filter(Boolean).length} 個面向
          </span>
          <div className="flex items-center gap-3">
            {savedMsg && (
              <span className={savedMsg.startsWith("已儲存") ? "text-xs text-emerald-600 dark:text-emerald-400" : "text-xs text-red-600 dark:text-red-400"}>
                {savedMsg}
              </span>
            )}
            <button
              onClick={save}
              disabled={!canSave || saving}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
              title={canSave ? "" : "示範客戶不儲存"}
            >
              {saving ? "儲存中…" : "儲存"}
            </button>
            <Link
              href={`/advisor/clients/${clientId}/report`}
              className="rounded-lg border border-sky-600 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40"
            >
              產出報告 →
            </Link>
          </div>
        </div>
        {!canSave && (
          <p className="mt-2 text-xs text-neutral-400">示範客戶不寫入資料庫;真實客戶可儲存建議並產出報告。</p>
        )}
      </section>
    </div>
  );
}
