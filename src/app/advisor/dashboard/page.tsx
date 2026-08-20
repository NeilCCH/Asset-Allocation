// 顧問後台 — 名下客戶清單 + 資產分層(HNW)。⚠️ 顧問專屬。
// 讀取真實登入顧問的檔案與名下客戶;未登入導回 /advisor。
import { ForwardLink } from "@/components/ui/ForwardLink";
import { isAdminEmail } from "@/lib/admin";
import { groupLicensesByCategory } from "@/lib/domain/licenses";
import { ProBadges, CompletenessCard } from "@/components/advisor/Badges";
import { leadStatusStyle } from "@/lib/domain/crm";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMyAdvisor } from "@/lib/actions/advisor";
import { investableAssets, sumAssets } from "@/lib/domain/calc";
import { normalizeData } from "@/lib/domain/normalize";
import { wealthTier, type WealthTierKey } from "@/lib/domain/wealthTier";
import type { QuestionnaireData } from "@/lib/domain/types";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { InviteLink } from "./InviteLink";
import { PlanCard } from "./PlanCard";
import { BackLink } from "@/components/ui/BackLink";

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
type PrivRow = { lead_status: string | null };
interface ClientRow {
  id: string;
  surname: string;
  honorific: string;
  created_at: string;
  // client_id 有 unique 約束 → PostgREST 巢狀回傳「物件」而非陣列;兩種形狀都要相容
  questionnaire_responses: QRRow | QRRow[] | null;
  advisor_private: PrivRow | PrivRow[] | null;
  contact_requests: { status: string }[] | null;
}
const firstQR = (q: ClientRow["questionnaire_responses"]): QRRow | undefined =>
  Array.isArray(q) ? q[0] : q ?? undefined;
const firstPriv = (p: ClientRow["advisor_private"]): PrivRow | undefined => (Array.isArray(p) ? p[0] : p ?? undefined);

export default async function AdvisorDashboard() {
  const advisor = await getMyAdvisor();
  if (!advisor) redirect("/advisor");

  const supabase = await createServerSupabase();
  // 含 CRM 巢狀(migration 0006);未執行時 fallback 到基本查詢,避免後台空白
  const basicSel = "id, surname, honorific, created_at, questionnaire_responses(basic, core, deep, kyc)";
  const tryFull = await supabase
    .from("clients")
    .select(`${basicSel}, advisor_private(lead_status), contact_requests(status)`)
    .order("created_at", { ascending: false });
  const clientsRaw = tryFull.error
    ? (await supabase.from("clients").select(basicSel).order("created_at", { ascending: false })).data
    : tryFull.data;

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const rows = ((clientsRaw as ClientRow[]) ?? [])
    .map((c) => {
      const qr = firstQR(c.questionnaire_responses);
      if (!qr?.core) return null;
      // ⚠️ 必須正規化:新增資產欄位後,舊客戶資料缺欄,未正規化直接算 sumAssets 會崩潰
      const data = normalizeData({ basic: qr.basic, core: qr.core, deep: qr.deep ?? undefined, kyc: qr.kyc ?? undefined } as QuestionnaireData);
      const investable = investableAssets(data.core.assets);
      const leadStatus = firstPriv(c.advisor_private)?.lead_status ?? null;
      const pendingContacts = (c.contact_requests ?? []).filter((x) => x.status === "new").length;
      const isNew = new Date(c.created_at).getTime() >= monthStart;
      return { id: c.id, data, tier: wealthTier(investable), total: sumAssets(data.core.assets), investable, leadStatus, pendingContacts, isNew };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.pendingContacts - a.pendingContacts || b.investable - a.investable);

  // 總覽數字
  const summary = {
    total: rows.length,
    pending: rows.filter((r) => r.leadStatus === "洽談中" || r.leadStatus === "待聯繫" || !r.leadStatus).length,
    won: rows.filter((r) => r.leadStatus === "已成交").length,
    contacts: rows.reduce((s, r) => s + r.pendingContacts, 0),
    newThisMonth: rows.filter((r) => r.isNew).length,
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:py-10">
      <div className="flex items-center justify-between">
        <BackLink href="/" label="首頁" accent="sky" />
        <SignOutButton redirectTo="/advisor" />
      </div>

      {/* 顧問檔案 */}
      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{advisor.display_name ?? advisor.email}</h1>
            {(advisor.company_name || advisor.job_title) && (
              <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-300">
                {[advisor.company_name, advisor.job_title].filter(Boolean).join(" · ")}
              </p>
            )}
            {advisor.licenses.length > 0 && (
              <div className="mt-2">
                <ProBadges licenses={advisor.licenses} />
              </div>
            )}
            {advisor.licenses.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {groupLicensesByCategory(advisor.licenses).map((g) => (
                  <div key={g.category} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="w-full text-[11px] font-semibold tracking-wide text-neutral-400 sm:w-auto">{g.category}</span>
                    {g.items.map((l) => (
                      <span
                        key={l.type}
                        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                      >
                        <span className="font-medium text-neutral-700 dark:text-neutral-200">{l.type}</span>
                        {l.number && <span className="font-mono text-[10px] text-neutral-400">{l.number}</span>}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg bg-sky-50 px-4 py-2 text-center dark:bg-sky-950/40">
            <div className="text-[11px] text-sky-600 dark:text-sky-400">專屬推薦碼</div>
            <div className="font-mono text-lg font-bold text-sky-700 dark:text-sky-300">{advisor.referral_code}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <ForwardLink href="/advisor/profile" label="編輯個人資料" accent="sky" />
          {isAdminEmail(advisor.email) && <ForwardLink href="/admin/advisors" label="管理後台" accent="sky" />}
        </div>
      </section>

      {/* 檔案完成度(鼓勵補齊專業資料) */}
      <CompletenessCard advisor={advisor} />

      {/* 付費方案(未來向顧問收費入口) */}
      <PlanCard featured={advisor.featured} featuredUntil={advisor.featured_until} featuredRequested={advisor.featured_requested} />

      {/* 主要客戶取得方式:邀請連結 */}
      <InviteLink code={advisor.referral_code} />

      {rows.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <SummaryStat label="客戶總數" value={summary.total} />
          <SummaryStat label="待跟進" value={summary.pending} accent="sky" />
          <SummaryStat label="已成交" value={summary.won} accent="emerald" />
          <SummaryStat label="待處理預約" value={summary.contacts} accent={summary.contacts > 0 ? "red" : undefined} />
          <SummaryStat label="本月新增" value={summary.newThisMonth} />
        </div>
      )}

      <h2 className="mt-6 text-lg font-bold">名下客戶</h2>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            尚無綁定客戶。把推薦碼 <span className="font-mono font-semibold">{advisor.referral_code}</span> 分享給客戶,
            <br />他們註冊後會自動出現在這裡並完成資產分層。
          </p>
          <ForwardLink href="/advisor/clients/c001" label="先看示範客戶檔案" accent="sky" className="mt-4" />
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
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">
                        {r.data.basic.surname}
                        {r.data.basic.honorific}
                      </span>
                      {r.leadStatus && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${leadStatusStyle(r.leadStatus)}`}>{r.leadStatus}</span>
                      )}
                      {r.pendingContacts > 0 && (
                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          🔔 {r.pendingContacts}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{fmtWan(r.investable)}</td>
                  <td className="px-4 py-3 font-semibold">{fmtWan(r.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <ForwardLink href={`/advisor/clients/${r.id}`} label="檢視" accent="sky" />
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

function SummaryStat({ label, value, accent }: { label: string; value: number; accent?: "sky" | "emerald" | "red" }) {
  const color =
    accent === "sky"
      ? "text-sky-700 dark:text-sky-300"
      : accent === "emerald"
        ? "text-emerald-700 dark:text-emerald-300"
        : accent === "red"
          ? "text-red-600 dark:text-red-400"
          : "text-neutral-800 dark:text-neutral-100";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-950">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  );
}
