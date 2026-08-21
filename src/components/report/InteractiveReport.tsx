"use client";

// 互動報告 — ⚠️ 顧問專屬。報告頁上直接調整試算參數,報告即時重算;列印時參數面板自動隱藏。
import { useEffect, useMemo, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import type { QuestionnaireData } from "@/lib/domain/types";
import { CalcParams } from "@/lib/domain/params";
import { retirementReserve } from "@/lib/domain/calc";
import { buildReport } from "@/lib/domain/report";
import { riskAllocationAnalysis } from "@/lib/domain/risk";
import { HealthCheckReport } from "./HealthCheckReport";
import { PrintButton } from "./PrintButton";

export function InteractiveReport({
  clientId,
  data,
  initialParams,
  advisorRecommendation,
  selectedDimensions,
  advisorSignature,
}: {
  clientId: string;
  data: QuestionnaireData;
  initialParams: CalcParams;
  advisorRecommendation?: string;
  selectedDimensions?: { title: string; desc: string }[];
  advisorSignature?: { name: string; company?: string; title?: string; licenses: { type: string; number?: string }[] };
}) {
  const [params, setParams] = useState<CalcParams>(initialParams);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetMonthly, setTargetMonthly] = useState("");
  const setParam = (k: keyof CalcParams, v: number) => setParams((p) => ({ ...p, [k]: v }));
  const isDefault = JSON.stringify(params) === JSON.stringify(initialParams);

  // 退休金回推試算(與客戶即時互動;採上方可調參數)
  const reserve = useMemo(
    () => (targetMonthly ? retirementReserve(data, params, Number(targetMonthly)) : null),
    [data, params, targetMonthly],
  );

  const riskAllocation = useMemo(() => riskAllocationAnalysis(data) ?? undefined, [data]);
  const model = useMemo(
    () => buildReport(data, { params, advisorRecommendation, selectedDimensions, advisorSignature, riskAllocation }),
    [data, params, advisorRecommendation, selectedDimensions, advisorSignature, riskAllocation],
  );
  // 現況主動收入(萬/年)— 作為「預估退休前薪資」輸入的預設起點
  const currentActive = model.statements.incomeStatement.activeIncome;
  const retireSalary = params.estRetireSalaryAnnual && params.estRetireSalaryAnnual > 0 ? params.estRetireSalaryAnnual : currentActive;

  return (
    <div className="flex-1">
      {/* 工具列(列印時隱藏) */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-5 py-3 backdrop-blur print:hidden dark:border-neutral-800 dark:bg-neutral-950/90">
        <BackLink href={`/advisor/clients/${clientId}`} label="返回客戶" accent="sky" />
        <PrintButton />
      </div>

      {/* 可調參數面板(⚠️ 列印時不呈現) */}
      <div className="mx-auto max-w-4xl px-4 pt-4 print:hidden">
        <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm dark:border-sky-900 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                <span aria-hidden>⚙</span> 互動試算
              </span>
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">試算參數(可調,報告即時重算)</span>
            </div>
            {!isDefault && (
              <button onClick={() => setParams(initialParams)} className="rounded-lg border border-sky-200 px-2.5 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-950/40">
                重設為預設
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <P label="年報酬率" suffix="%" value={params.returnRate * 100} step={0.5} onChange={(v) => setParam("returnRate", v / 100)} />
            <P label="通膨率" suffix="%" value={params.inflationRate * 100} step={0.5} onChange={(v) => setParam("inflationRate", v / 100)} />
            <P label="預估退休前薪資" suffix="萬/年" value={retireSalary} step={10} onChange={(v) => setParam("estRetireSalaryAnnual", v)} />
            <P label="預估餘命" suffix="歲" value={params.lifeExpectancy} step={1} onChange={(v) => setParam("lifeExpectancy", v)} />
            <P label="所得替代率" suffix="%" value={params.defaultRetireLifestylePct} step={5} onChange={(v) => setParam("defaultRetireLifestylePct", v)} />
          </div>
          <button onClick={() => setShowAdvanced((s) => !s)} className="mt-2 text-xs text-sky-600 hover:underline dark:text-sky-400">
            {showAdvanced ? "收合進階參數 ▴" : "進階參數(教育金 / 扶養)▾"}
          </button>
          {showAdvanced && (
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <P label="教育金·國內" suffix="萬" value={params.eduCostDomestic} step={10} onChange={(v) => setParam("eduCostDomestic", v)} />
              <P label="教育金·海外" suffix="萬" value={params.eduCostOverseas} step={10} onChange={(v) => setParam("eduCostOverseas", v)} />
              <P label="扶養·每人每年" suffix="萬" value={params.dependentSupportAnnual} step={1} onChange={(v) => setParam("dependentSupportAnnual", v)} />
              <P label="子女獨立年齡" suffix="歲" value={params.childIndependentAge} step={1} onChange={(v) => setParam("childIndependentAge", v)} />
              <P label="奉養父母總額" suffix="萬" value={params.parentSupportTotal} step={50} onChange={(v) => setParam("parentSupportTotal", v)} />
            </div>
          )}
        </div>
      </div>

      {/* 退休金回推試算(⚠️ 列印時不呈現;與客戶即時互動) */}
      <div className="mx-auto max-w-4xl px-4 pt-3 print:hidden">
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-neutral-950">
          <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">退休金回推試算</h3>
          <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-300/80">輸入退休後每月想固定領取的金額,即時回推需準備多少(採上方試算參數)。</p>
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
              <ReserveCard label="從現在起每月需存" value={reserve.requiredMonthlySaving} highlight={!reserve.sufficient} note={reserve.sufficient ? "現有資產已足夠" : undefined} />
            </div>
          )}
        </div>
      </div>

      <div className="bg-neutral-100 px-3 py-6 dark:bg-neutral-900 sm:px-4 print:bg-white print:p-0">
        {/* 螢幕上呈現為文件頁面(較寬,易讀);列印時強制 A4 直式 */}
        <div className="mx-auto w-full max-w-4xl rounded-lg bg-white shadow-md ring-1 ring-black/5 print:max-w-none print:rounded-none print:shadow-none print:ring-0">
          <HealthCheckReport model={model} />
        </div>
      </div>
    </div>
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

function P({ label, suffix, value, step, onChange }: { label: string; suffix: string; value: number; step: number; onChange: (v: number) => void }) {
  const rounded = Math.round(value * 100) / 100;
  const [text, setText] = useState(String(rounded));
  useEffect(() => {
    if (Number(text) !== rounded) setText(String(rounded));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounded]);
  return (
    <label className="block">
      <span className="text-xs text-sky-800 dark:text-sky-200">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-sky-200 bg-white px-2 dark:border-sky-800 dark:bg-neutral-900">
        <input
          type="number"
          value={text}
          step={step}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            if (v !== "" && !Number.isNaN(Number(v))) onChange(Number(v));
          }}
          onBlur={() => { if (text === "" || Number.isNaN(Number(text))) setText(String(rounded)); }}
          className="w-full bg-transparent py-1.5 text-sm outline-none"
        />
        <span className="text-xs text-neutral-400">{suffix}</span>
      </div>
    </label>
  );
}
