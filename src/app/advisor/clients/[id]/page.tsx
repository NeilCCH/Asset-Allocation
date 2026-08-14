// 顧問後台 — 單一客戶完整檢視。⚠️ 顧問專屬。
// leads 評分、配置面向框架皆在此 server component 計算,只把純資料傳給互動元件。
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMockClient } from "@/lib/mock/clients";
import { createServerSupabase } from "@/lib/supabase/server";
import { scoreLead } from "@/lib/domain/leads";
import { assetBreakdown, computeGaps, liquidAssets, protectionVsInvestment, sumAssets } from "@/lib/domain/calc";
import { ALLOCATION_DIMENSIONS, dimensionHints } from "@/lib/domain/allocation";
import { AdvisorWorkbench } from "@/components/AdvisorWorkbench";
import type { QuestionnaireData } from "@/lib/domain/types";

/** 讀取客戶問卷資料:先範例、再真實(RLS 限本顧問名下) */
async function loadClientData(id: string): Promise<QuestionnaireData | null> {
  const mock = getMockClient(id);
  if (mock) return mock.data;
  // 真實客戶 id 為 uuid;非 uuid(如舊範例碼)直接視為不存在
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("clients")
    .select("questionnaire_responses(basic, core, deep, kyc)")
    .eq("id", id)
    .maybeSingle();
  const qr = (data as { questionnaire_responses?: { basic: unknown; core: unknown; deep: unknown; kyc: unknown }[] } | null)
    ?.questionnaire_responses?.[0];
  if (!qr?.core) return null;
  return { basic: qr.basic, core: qr.core, deep: qr.deep ?? undefined, kyc: qr.kyc ?? undefined } as QuestionnaireData;
}

export default async function ClientDetail({ params }: PageProps<"/advisor/clients/[id]">) {
  const { id } = await params;
  const data = await loadClientData(id);
  if (!data) notFound();
  const score = scoreLead(data);
  const gaps = computeGaps(data);
  const total = sumAssets(data.core.assets);
  const liquid = liquidAssets(data.core.assets);
  const pvi = protectionVsInvestment(data.core.assets);
  const hints = dimensionHints(data);

  const dimensions = ALLOCATION_DIMENSIONS.map((d) => {
    const h = hints.find((x) => x.key === d.key);
    return { ...d, flagged: h?.flagged ?? false, note: h?.note };
  });

  const gapList = [
    { name: "退休金缺口", gap: gaps.retirement },
    { name: "保障缺口", gap: gaps.protection },
    { name: "教育金缺口", gap: gaps.education },
  ].map((g) => ({
    name: g.name,
    status: g.gap.status,
    gap: g.gap.gap,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-10">
      <Link href="/advisor/dashboard" className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
        ← 客戶清單
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {data.basic.surname}
            {data.basic.honorific}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {data.core.age} 歲 · 預計 {data.core.retire_age} 歲退休 · {data.core.income_type} ·
            子女 {data.core.dependents.children.count} 位
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {data.basic.mobile && <span className="text-neutral-500">{data.basic.mobile}</span>}
          {data.basic.line_id && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300">LINE</span>}
        </div>
      </header>

      {/* 事實層摘要 */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="資產總額" value={fmtWan(total)} />
        <Stat label="流動資產" value={fmtWan(liquid)} />
        <Stat label="保障型" value={fmtWan(pvi.protection)} />
        <Stat label="投資型" value={fmtWan(pvi.investment)} />
      </section>

      <details className="mt-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">資產明細</summary>
        <div className="border-t border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
            {assetBreakdown(data.core.assets).filter((a) => a.amount > 0).map((a) => (
              <li key={a.key} className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">{a.label}</span>
                <span className="font-medium">{fmtWan(a.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </details>

      <AdvisorWorkbench
        surname={`${data.basic.surname}${data.basic.honorific}`}
        score={score}
        gaps={gapList}
        dimensions={dimensions}
      />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-base font-bold sm:text-lg">{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  );
}

function fmtWan(wan: number) {
  if (wan >= 10000) return `${(wan / 10000).toFixed(1)} 億`;
  return `${Math.round(wan).toLocaleString("zh-TW")} 萬`;
}
