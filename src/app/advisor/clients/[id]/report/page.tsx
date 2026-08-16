// 顧問版健檢報告 — 含顧問建議、勾選的配置面向與落款(姓名+證照)。⚠️ 顧問專屬。
// 報告頁提供可調試算參數,即時重算(見 InteractiveReport)。
import { notFound } from "next/navigation";
import { getAdvisorWorkbench, getMyAdvisor } from "@/lib/actions/advisor";
import { loadClientData, isRealClientId } from "@/lib/clientData";
import { ALLOCATION_DIMENSIONS } from "@/lib/domain/allocation";
import { clientDefaultParams } from "@/lib/domain/params";
import { InteractiveReport } from "@/components/report/InteractiveReport";

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

  return (
    <InteractiveReport
      clientId={id}
      data={data}
      initialParams={{ ...clientDefaultParams(data.basic.honorific), ...(saved?.paramsOverride ?? {}) }}
      advisorRecommendation={saved?.recommendation || undefined}
      selectedDimensions={selectedDimensions.length ? selectedDimensions : undefined}
      advisorSignature={
        advisor
          ? {
              name: advisor.full_name ?? advisor.display_name ?? advisor.email,
              company: advisor.company_name ?? undefined,
              title: advisor.job_title ?? undefined,
              licenses: advisor.licenses.map((l) => l.type),
            }
          : undefined
      }
    />
  );
}
