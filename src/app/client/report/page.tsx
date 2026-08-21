"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/ui/BackLink";
import type { QuestionnaireData } from "@/lib/domain/types";
import { buildReport, type ReportModel } from "@/lib/domain/report";
import { clientDefaultParams } from "@/lib/domain/params";
import { HealthCheckReport } from "@/components/report/HealthCheckReport";
import { loadDraft } from "@/lib/draft";
import { normalizeData } from "@/lib/domain/normalize";

export default function ClientReport() {
  const [model, setModel] = useState<ReportModel | null | undefined>(undefined);

  useEffect(() => {
    const raw = loadDraft() as QuestionnaireData | null;
    const data = raw ? normalizeData(raw) : null;
    setModel(data ? buildReport(data, { params: clientDefaultParams(data.basic.honorific) }) : null);
  }, []);

  if (model === undefined) return <div className="p-10 text-center text-neutral-400">載入中…</div>;
  if (model === null)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
        <p className="text-neutral-600 dark:text-neutral-300">尚未有作答資料。</p>
        <Link href="/client/assessment" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white">
          開始填問卷
        </Link>
      </div>
    );

  return (
    <div className="flex-1">
      {/* 工具列(列印時隱藏) */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-5 py-3 backdrop-blur print:hidden dark:border-neutral-800 dark:bg-neutral-950/90">
        <BackLink href="/client/dashboard" label="返回儀表板" accent="emerald" />
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          列印 / 儲存為 PDF
        </button>
      </div>

      <div className="bg-neutral-100 px-3 py-6 dark:bg-neutral-900 sm:px-4 print:bg-white print:p-0">
        {/* 螢幕上呈現為 A4 直式頁面(與列印一致) */}
        <div className="mx-auto w-full max-w-[210mm] rounded-lg bg-white shadow-md ring-1 ring-black/5 print:max-w-none print:rounded-none print:shadow-none print:ring-0">
          <HealthCheckReport model={model} variant="simple" />
        </div>
      </div>
    </div>
  );
}
