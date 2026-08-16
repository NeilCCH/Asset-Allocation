"use client";

// 互動報告 — ⚠️ 顧問專屬。報告頁上直接調整試算參數,報告即時重算;列印時參數面板自動隱藏。
import { useMemo, useState } from "react";
import Link from "next/link";
import type { QuestionnaireData } from "@/lib/domain/types";
import { CalcParams } from "@/lib/domain/params";
import { buildReport } from "@/lib/domain/report";
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
  advisorSignature?: { name: string; licenses: string[] };
}) {
  const [params, setParams] = useState<CalcParams>(initialParams);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const setParam = (k: keyof CalcParams, v: number) => setParams((p) => ({ ...p, [k]: v }));
  const isDefault = JSON.stringify(params) === JSON.stringify(initialParams);

  const model = useMemo(
    () => buildReport(data, { params, advisorRecommendation, selectedDimensions, advisorSignature }),
    [data, params, advisorRecommendation, selectedDimensions, advisorSignature],
  );

  return (
    <div className="flex-1">
      {/* 工具列(列印時隱藏) */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-5 py-3 backdrop-blur print:hidden dark:border-neutral-800 dark:bg-neutral-950/90">
        <Link href={`/advisor/clients/${clientId}`} className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
          ← 返回客戶
        </Link>
        <PrintButton />
      </div>

      {/* 可調參數面板(列印時隱藏) */}
      <div className="mx-auto max-w-3xl px-5 pt-4 print:hidden">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-sky-900 dark:text-sky-100">試算參數(可調,報告即時重算)</span>
            {!isDefault && (
              <button onClick={() => setParams(initialParams)} className="text-xs text-sky-600 hover:underline dark:text-sky-400">
                重設
              </button>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <P label="年報酬率" suffix="%" value={params.returnRate * 100} step={0.5} onChange={(v) => setParam("returnRate", v / 100)} />
            <P label="通膨率" suffix="%" value={params.inflationRate * 100} step={0.5} onChange={(v) => setParam("inflationRate", v / 100)} />
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

      <div className="bg-neutral-100 py-6 dark:bg-neutral-900 print:bg-white print:py-0">
        <div className="mx-auto max-w-3xl rounded-xl bg-white shadow-sm print:shadow-none">
          <HealthCheckReport model={model} />
        </div>
      </div>
    </div>
  );
}

function P({ label, suffix, value, step, onChange }: { label: string; suffix: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-sky-800 dark:text-sky-200">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-sky-200 bg-white px-2 dark:border-sky-800 dark:bg-neutral-900">
        <input type="number" value={Math.round(value * 100) / 100} step={step} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className="w-full bg-transparent py-1.5 text-sm outline-none" />
        <span className="text-xs text-neutral-400">{suffix}</span>
      </div>
    </label>
  );
}
