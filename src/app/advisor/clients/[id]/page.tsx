// 顧問後台 — 單一客戶完整檢視。⚠️ 顧問專屬。
// leads 評分、配置面向框架皆在此 server component 計算,只把純資料傳給互動元件。
import { BackLink } from "@/components/ui/BackLink";
import { notFound } from "next/navigation";
import { getAdvisorWorkbench } from "@/lib/actions/advisor";
import { loadClientData, isRealClientId } from "@/lib/clientData";
import { scoreLead } from "@/lib/domain/leads";
import { assetBreakdown, investableAssets, liquidAssets, protectionVsInvestment, sumAssets } from "@/lib/domain/calc";
import { wealthTier, type WealthTierKey } from "@/lib/domain/wealthTier";
import { ALLOCATION_DIMENSIONS, dimensionHints } from "@/lib/domain/allocation";
import { AdvisorWorkbench } from "@/components/AdvisorWorkbench";
import { CrmPanel } from "@/components/CrmPanel";
import { getClientCrm } from "@/lib/actions/crm";

const TIER_BADGE: Record<WealthTierKey, string> = {
  uhnw: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  hnw: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  affluent: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  mass_affluent: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  mass: "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
};

export default async function ClientDetail({ params }: PageProps<"/advisor/clients/[id]">) {
  const { id } = await params;
  const data = await loadClientData(id);
  if (!data) notFound();
  const isReal = isRealClientId(id);
  const saved = isReal ? await getAdvisorWorkbench(id) : null;
  const crm = isReal ? await getClientCrm(id) : null;
  const score = scoreLead(data);
  const total = sumAssets(data.core.assets);
  const liquid = liquidAssets(data.core.assets);
  const tier = wealthTier(investableAssets(data.core.assets));
  const pvi = protectionVsInvestment(data.core.assets);
  const hints = dimensionHints(data);

  const dimensions = ALLOCATION_DIMENSIONS.map((d) => {
    const h = hints.find((x) => x.key === d.key);
    return { ...d, flagged: h?.flagged ?? false, note: h?.note };
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-10">
      <BackLink href="/advisor/dashboard" label="客戶清單" accent="sky" />

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              {data.basic.surname}
              {data.basic.honorific}
            </h1>
            <span
              title={`${tier.en}・可投資資產 ${tier.range}`}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TIER_BADGE[tier.key]}`}
            >
              {tier.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {data.core.age} 歲 · 預計 {data.core.retire_age} 歲退休 · {data.core.income_type} ·
            子女 {data.core.dependents.children.length} 位
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

      {crm && <CrmPanel clientId={id} initial={crm} />}

      <AdvisorWorkbench
        clientId={id}
        canSave={isReal}
        surname={`${data.basic.surname}${data.basic.honorific}`}
        score={score}
        data={data}
        dimensions={dimensions}
        savedRecommendation={saved?.recommendation ?? ""}
        savedDimensionKeys={saved?.dimensionKeys ?? []}
        savedParams={saved?.paramsOverride ?? {}}
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
