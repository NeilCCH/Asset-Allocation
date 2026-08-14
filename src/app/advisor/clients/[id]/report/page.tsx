// 顧問版健檢報告 — 含顧問建議、勾選的配置面向與落款(姓名+證照)。⚠️ 顧問專屬。
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdvisorWorkbench, getMyAdvisor } from "@/lib/actions/advisor";
import { loadClientData, isRealClientId } from "@/lib/clientData";
import { ALLOCATION_DIMENSIONS } from "@/lib/domain/allocation";
import { DEFAULT_PARAMS } from "@/lib/domain/params";
import { buildReport } from "@/lib/domain/report";
import { HealthCheckReport } from "@/components/report/HealthCheckReport";
import { PrintButton } from "@/components/report/PrintButton";

export default async function AdvisorReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadClientData(id);
  if (!data) notFound();

  const saved = isRealClientId(id) ? await getAdvisorWorkbench(id) : null;
  const advisor = await getMyAdvisor();

  const selectedDimensions = (saved?.dimensionKeys ?? [])
    .map((k) => ALLOCATION_DIMENSIONS.find((d) => d.key === k))
    .filter((d): d is NonNullable<typeof d> => !!d)
    .map((d) => ({ title: d.title, desc: d.desc }));

  const model = buildReport(data, {
    params: { ...DEFAULT_PARAMS, ...(saved?.paramsOverride ?? {}) },
    advisorRecommendation: saved?.recommendation || undefined,
    selectedDimensions: selectedDimensions.length ? selectedDimensions : undefined,
    advisorSignature: advisor
      ? { name: advisor.full_name ?? advisor.display_name ?? advisor.email, licenses: advisor.licenses.map((l) => l.type) }
      : undefined,
  });

  return (
    <div className="flex-1">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-5 py-3 backdrop-blur print:hidden dark:border-neutral-800 dark:bg-neutral-950/90">
        <Link href={`/advisor/clients/${id}`} className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
          ← 返回客戶
        </Link>
        <PrintButton />
      </div>
      <div className="bg-neutral-100 py-6 dark:bg-neutral-900 print:bg-white print:py-0">
        <div className="mx-auto max-w-3xl rounded-xl bg-white shadow-sm print:shadow-none">
          <HealthCheckReport model={model} />
        </div>
      </div>
    </div>
  );
}
