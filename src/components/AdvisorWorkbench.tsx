"use client";

// 顧問工作台 — ⚠️ 顧問專屬,此區內容不會、也不得呈現給客戶。
// 配置面向採「顧問手動勾選」;缺口試算參數可由顧問覆寫(§7 可調參數)。
import { useMemo, useState } from "react";
import Link from "next/link";
import type { LeadScore } from "@/lib/domain/leads";
import type { QuestionnaireData } from "@/lib/domain/types";
import { CalcParams, clientDefaultParams } from "@/lib/domain/params";
import { computeGaps, gapSolutions, retirementReserve, type GapResult } from "@/lib/domain/calc";
import { saveAdvisorWorkbench } from "@/lib/actions/advisor";

interface Dimension {
  key: string;
  title: string;
  desc: string;
  flagged: boolean;
  note?: string;
}

export function AdvisorWorkbench({
  clientId,
  canSave,
  surname,
  score,
  data,
  dimensions,
  savedRecommendation,
  savedDimensionKeys,
  savedParams,
}: {
  clientId: string;
  canSave: boolean;
  surname: string;
  score: LeadScore;
  data: QuestionnaireData;
  dimensions: Dimension[];
  savedRecommendation: string;
  savedDimensionKeys: string[];
  savedParams: Partial<CalcParams>;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(savedDimensionKeys.map((k) => [k, true])),
  );
  const [reco, setReco] = useState(savedRecommendation);
  const clientDefaults = useMemo(() => clientDefaultParams(data.basic.honorific), [data.basic.honorific]);
  const [params, setParams] = useState<CalcParams>({ ...clientDefaults, ...savedParams });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetMonthly, setTargetMonthly] = useState("");

  const gaps = useMemo(() => computeGaps(data, params), [data, params]);
  const reserve = useMemo(
    () => (targetMonthly ? retirementReserve(data, params, Number(targetMonthly)) : null),
    [data, params, targetMonthly],
  );
  const solutions = useMemo(() => gapSolutions(data, params), [data, params]);
  const isDefault = JSON.stringify(params) === JSON.stringify(clientDefaults);

  const toggle = (k: string) => setChecked((p) => ({ ...p, [k]: !p[k] }));
  const setParam = (k: keyof CalcParams, v: number) => setParams((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    setSavedMsg(null);
    const dimensionKeys = Object.entries(checked).filter(([, v]) => v).map(([k]) => k);
    const res = await saveAdvisorWorkbench({ clientId, recommendation: reco, dimensionKeys, paramsOverride: params });
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

      {/* 試算參數 + 缺口 */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">缺口試算</h2>
          {!isDefault && (
            <button onClick={() => setParams(clientDefaults)} className="text-xs text-sky-600 hover:underline dark:text-sky-400">
              重設為預設
            </button>
          )}
        </div>

        {/* 可調參數 */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ParamInput label="年報酬率" suffix="%" value={params.returnRate * 100} onChange={(v) => setParam("returnRate", v / 100)} step={0.5} />
          <ParamInput label="通膨率" suffix="%" value={params.inflationRate * 100} onChange={(v) => setParam("inflationRate", v / 100)} step={0.5} />
          <ParamInput label="預估餘命" suffix="歲" value={params.lifeExpectancy} onChange={(v) => setParam("lifeExpectancy", v)} step={1} />
          <ParamInput label="所得替代率" suffix="%" value={params.defaultRetireLifestylePct} onChange={(v) => setParam("defaultRetireLifestylePct", v)} step={5} />
        </div>

        {/* 進階參數(影響保障 / 教育缺口) */}
        <button onClick={() => setShowAdvanced((v) => !v)} className="mt-3 text-xs text-sky-600 hover:underline dark:text-sky-400">
          {showAdvanced ? "收合進階參數 ▴" : "進階參數(教育金 / 扶養)▾"}
        </button>
        {showAdvanced && (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ParamInput label="教育金·國內" suffix="萬" value={params.eduCostDomestic} onChange={(v) => setParam("eduCostDomestic", v)} step={10} />
            <ParamInput label="教育金·海外" suffix="萬" value={params.eduCostOverseas} onChange={(v) => setParam("eduCostOverseas", v)} step={10} />
            <ParamInput label="扶養·每人每年" suffix="萬" value={params.dependentSupportAnnual} onChange={(v) => setParam("dependentSupportAnnual", v)} step={1} />
            <ParamInput label="子女獨立年齡" suffix="歲" value={params.childIndependentAge} onChange={(v) => setParam("childIndependentAge", v)} step={1} />
            <ParamInput label="奉養父母總額" suffix="萬" value={params.parentSupportTotal} onChange={(v) => setParam("parentSupportTotal", v)} step={50} />
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3">
          <GapCard name="退休金缺口" gap={gaps.retirement} />
          <GapCard name="保障缺口" gap={gaps.protection} />
          <GapCard name="教育金缺口" gap={gaps.education} />
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          調整上方參數,缺口會即時重算。此為透明公式試算,非投資建議。
        </p>
      </section>

      {/* 退休金回推試算(解決建議) */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
        <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">退休金回推試算</h2>
        <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
          輸入退休後每月想固定領取的金額,回推現在需準備多少(採上方試算參數)。
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm">退休後每月想領</span>
          <input
            type="number"
            value={targetMonthly}
            onChange={(e) => setTargetMonthly(e.target.value)}
            placeholder="例如 5"
            className="w-24 rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-neutral-900"
          />
          <span className="text-sm">萬 / 月</span>
        </div>
        {reserve && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ReserveCard label="退休時所需準備金" value={reserve.capitalAtRetirement} />
            <ReserveCard label="今日一次準備(現值)" value={reserve.lumpSumToday} />
            <ReserveCard label="現有資產成長至退休" value={reserve.currentAssetsGrown} />
            <ReserveCard
              label="從現在起每月需存"
              value={reserve.requiredMonthlySaving}
              highlight={!reserve.sufficient}
              note={reserve.sufficient ? "現有資產已足夠" : undefined}
            />
          </div>
        )}
      </section>

      {/* 缺口補足建議 */}
      {solutions.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="text-base font-semibold text-amber-900 dark:text-amber-100">缺口補足建議</h2>
          <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">依現有缺口的補足方向與每月儲蓄估計(採上方參數,屬客觀試算)。</p>
          <div className="mt-3 space-y-2">
            {solutions.map((s) => (
              <div key={s.name} className="flex items-center justify-between rounded-lg bg-white/70 px-4 py-3 text-sm dark:bg-neutral-900/60">
                <div>
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">缺 {Math.round(s.gap).toLocaleString("zh-TW")} 萬 · {s.action}</span>
                </div>
                <span className="font-semibold text-amber-700 dark:text-amber-300">
                  {s.monthly != null ? `每月 ${s.monthly.toLocaleString("zh-TW")} 萬` : s.lump != null ? `補足 ${Math.round(s.lump).toLocaleString("zh-TW")} 萬` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 配置面向參考框架 */}
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

// ── 子元件 ───────────────────────────────────────────

function ParamInput({ label, suffix, value, onChange, step }: { label: string; suffix: string; value: number; onChange: (v: number) => void; step: number }) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900">
        <input
          type="number"
          value={Math.round(value * 100) / 100}
          step={step}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className="w-full bg-transparent py-1.5 text-sm outline-none"
        />
        <span className="text-xs text-neutral-400">{suffix}</span>
      </div>
    </label>
  );
}

function ReserveCard({ label, value, highlight, note }: { label: string; value: number; highlight?: boolean; note?: string }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${highlight ? "border-emerald-400 bg-white dark:border-emerald-600 dark:bg-neutral-900" : "border-emerald-200 bg-white/70 dark:border-emerald-900 dark:bg-neutral-900/60"}`}>
      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className={`mt-1 text-sm font-bold ${highlight ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
        {note ?? `${Math.round(value).toLocaleString("zh-TW")} 萬`}
      </div>
    </div>
  );
}

function GapCard({ name, gap }: { name: string; gap: GapResult }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 text-center dark:border-neutral-800">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{name}</div>
      <div className="mt-1 text-sm font-semibold">
        {gap.status === "needs_deep_data" ? (
          <span className="text-neutral-400">待深化</span>
        ) : gap.gap > 0 ? (
          <span className="text-amber-600 dark:text-amber-400">缺 {Math.round(gap.gap).toLocaleString("zh-TW")} 萬</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400">足夠</span>
        )}
      </div>
    </div>
  );
}
