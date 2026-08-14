// 顧問後台 — 名下客戶清單 + A/B/C 分級。⚠️ 顧問專屬頁面。
// 此區可使用 leads 評分與配置框架(客戶端絕不進入此路徑)。
import Link from "next/link";
import { MOCK_CLIENTS } from "@/lib/mock/clients";
import { scoreLead, type LeadGrade } from "@/lib/domain/leads";
import { sumAssets } from "@/lib/domain/calc";

const GRADE_STYLE: Record<LeadGrade, string> = {
  A: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  B: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  C: "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
};

function fmtWan(wan: number) {
  if (wan >= 10000) return `${(wan / 10000).toFixed(1)} 億`;
  return `${Math.round(wan).toLocaleString("zh-TW")} 萬`;
}

export default function AdvisorDashboard() {
  const rows = MOCK_CLIENTS.map((c) => ({
    ...c,
    score: scoreLead(c.data),
    total: sumAssets(c.data.core.assets),
  })).sort((a, b) => b.score.total - a.score.total);

  const counts = rows.reduce(
    (acc, r) => ({ ...acc, [r.score.grade]: (acc[r.score.grade] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
          ← 首頁
        </Link>
        <div className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
          推薦碼 <span className="font-mono font-semibold">WM-8F3K2</span>
        </div>
      </div>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">名下客戶</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            依綜合評分排序,優先跟進高分客戶。分級與評分僅供你參考。
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge grade="A" n={counts.A ?? 0} />
          <Badge grade="B" n={counts.B ?? 0} />
          <Badge grade="C" n={counts.C ?? 0} />
        </div>
      </header>

      <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">分級</th>
              <th className="px-4 py-3 font-medium">客戶</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">資產總額</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">急迫性</th>
              <th className="px-4 py-3 font-medium">評分</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                <td className="px-4 py-3">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${GRADE_STYLE[r.score.grade]}`}>
                    {r.score.grade}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {r.data.basic.surname}
                    {r.data.basic.honorific}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {r.data.core.age} 歲 · {r.data.core.income_type}
                  </div>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">{fmtWan(r.total)}</td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="text-neutral-500 dark:text-neutral-400">{r.data.core.urgency}</span>
                </td>
                <td className="px-4 py-3 font-semibold">{r.score.total}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/advisor/clients/${r.id}`} className="text-sky-600 hover:underline dark:text-sky-400">
                    檢視 →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        評分因子:資產規模、現金流健康度、需求明確度、急迫性、互動意願(取自問卷,不另加問)。
      </p>
    </main>
  );
}

function Badge({ grade, n }: { grade: LeadGrade; n: number }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${GRADE_STYLE[grade]}`}>
      {grade} <span className="opacity-70">{n}</span>
    </span>
  );
}
