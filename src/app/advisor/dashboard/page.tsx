// 顧問後台 — 名下客戶清單 + 資產分層(HNW)。⚠️ 顧問專屬。
// 讀取真實登入顧問的檔案與名下客戶;未登入導回 /advisor。
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMyAdvisor } from "@/lib/actions/advisor";
import { investableAssets, sumAssets } from "@/lib/domain/calc";
import { wealthTier, type WealthTierKey } from "@/lib/domain/wealthTier";
import type { QuestionnaireData } from "@/lib/domain/types";
import { SignOutButton } from "./SignOutButton";
import { InviteLink } from "./InviteLink";
import { PlanCard } from "./PlanCard";

// 資產分層徽章配色(取代 A/B/C)
const TIER_STYLE: Record<WealthTierKey, string> = {
  uhnw: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  hnw: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  affluent: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  mass_affluent: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  mass: "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
};

function fmtWan(wan: number) {
  if (wan >= 10000) return `${(wan / 10000).toFixed(1)} 億`;
  return `${Math.round(wan).toLocaleString("zh-TW")} 萬`;
}

type QRRow = { basic: unknown; core: unknown; deep: unknown; kyc: unknown };
interface ClientRow {
  id: string;
  surname: string;
  honorific: string;
  // client_id 有 unique 約束 → PostgREST 巢狀回傳「物件」而非陣列;兩種形狀都要相容
  questionnaire_responses: QRRow | QRRow[] | null;
}
const firstQR = (q: ClientRow["questionnaire_responses"]): QRRow | undefined =>
  Array.isArray(q) ? q[0] : q ?? undefined;

export default async function AdvisorDashboard() {
  const advisor = await getMyAdvisor();
  if (!advisor) redirect("/advisor");

  const supabase = await createServerSupabase();
  const { data: clientsRaw } = await supabase
    .from("clients")
    .select("id, surname, honorific, questionnaire_responses(basic, core, deep, kyc)")
    .order("created_at", { ascending: false });

  const rows = ((clientsRaw as ClientRow[]) ?? [])
    .map((c) => {
      const qr = firstQR(c.questionnaire_responses);
      if (!qr?.core) return null;
      const data = { basic: qr.basic, core: qr.core, deep: qr.deep ?? undefined, kyc: qr.kyc ?? undefined } as QuestionnaireData;
      const investable = investableAssets(data.core.assets);
      return { id: c.id, data, tier: wealthTier(investable), total: sumAssets(data.core.assets), investable };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.investable - a.investable);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
          ← 首頁
        </Link>
        <SignOutButton />
      </div>

      {/* 顧問檔案 */}
      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{advisor.display_name ?? advisor.email}</h1>
            {advisor.licenses.length > 0 && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {advisor.licenses.map((l) => (l.number ? `${l.type}(${l.number})` : l.type)).join("、")}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-sky-50 px-4 py-2 text-center dark:bg-sky-950/40">
            <div className="text-[11px] text-sky-600 dark:text-sky-400">專屬推薦碼</div>
            <div className="font-mono text-lg font-bold text-sky-700 dark:text-sky-300">{advisor.referral_code}</div>
          </div>
        </div>
      </section>

      {/* 付費方案(未來向顧問收費入口) */}
      <PlanCard featured={advisor.featured} featuredRequested={advisor.featured_requested} />

      {/* 主要客戶取得方式:邀請連結 */}
      <InviteLink code={advisor.referral_code} />

      <h2 className="mt-6 text-lg font-bold">名下客戶</h2>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            尚無綁定客戶。把推薦碼 <span className="font-mono font-semibold">{advisor.referral_code}</span> 分享給客戶,
            <br />他們註冊後會自動出現在這裡並完成資產分層。
          </p>
          <Link href="/advisor/clients/c001" className="mt-4 inline-block text-sm text-sky-600 hover:underline dark:text-sky-400">
            先看示範客戶檔案 →
          </Link>
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">資產分層</th>
                <th className="px-4 py-3 font-medium">客戶</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">可投資資產</th>
                <th className="px-4 py-3 font-medium">資產總額</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                  <td className="px-4 py-3">
                    <span
                      title={`${r.tier.en}・${r.tier.range}`}
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TIER_STYLE[r.tier.key]}`}
                    >
                      {r.tier.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {r.data.basic.surname}
                    {r.data.basic.honorific}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{fmtWan(r.investable)}</td>
                  <td className="px-4 py-3 font-semibold">{fmtWan(r.total)}</td>
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
      )}
    </main>
  );
}
