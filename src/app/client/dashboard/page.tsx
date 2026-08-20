"use client";

// 彙整儀表板 — 客戶可見「事實層」。⚠️ 合規:不得顯示 leads 評分或配置面向建議,
// 不得 import @/lib/domain/leads。此頁只呈現客觀試算。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { ContactAdvisorCard } from "@/components/client/ContactAdvisorCard";
import { ProBadges } from "@/components/advisor/Badges";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { QuestionnaireData } from "@/lib/domain/types";
import {
  assetClassBreakdown,
  computeGaps,
  riskAssetBreakdown,
  type GapResult,
} from "@/lib/domain/calc";
import { clientDefaultParams } from "@/lib/domain/params";
import { estimateEstateTax } from "@/lib/domain/estateTax";
import { loadDraft } from "@/lib/draft";
import { normalizeData } from "@/lib/domain/normalize";
import { loadReferral, saveReferral, savePendingAdvisor, loadPendingAdvisor, clearPendingAdvisor } from "@/lib/referral";
import { saveClientId } from "@/lib/clientSession";
import { submitClientQuestionnaire } from "@/lib/actions/client";
import { linkClientAccount } from "@/lib/actions/clientAccount";
import { listRecommendedAdvisors, type RecommendedAdvisor } from "@/lib/actions/advisorDirectory";
import { createClient } from "@/lib/supabase/client";

// 資產三分類配色
const CLASS_COLOR: Record<string, string> = {
  流動: "#0ea5e9", // 天藍
  固定: "#f59e0b", // 琥珀
  風險: "#8b5cf6", // 紫
};
// 風險資產:穩定收益 vs 高風險
const RISK_COLOR: Record<string, string> = {
  穩定: "#10b981", // 綠
  風險: "#f43f5e", // 玫紅
};

function fmt(wan: number): string {
  const v = Math.round(wan);
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)} 億`;
  return `${v.toLocaleString("zh-TW")} 萬`;
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<QuestionnaireData | null | undefined>(undefined);
  const [loggedIn, setLoggedIn] = useState(false);
  const [bound, setBound] = useState(false); // 是否已綁定顧問(綁定後解鎖完整分析)

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        setLoggedIn(true);
        const { data: rows } = await supabase
          .from("clients")
          .select("questionnaire_responses(basic, core, deep, kyc)")
          .eq("auth_user_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        type QRRow = { basic: unknown; core: unknown; deep: unknown; kyc: unknown };
        // client_id 有 unique 約束 → 巢狀回傳「物件」而非陣列;兩種形狀都相容
        const q = (rows as { questionnaire_responses?: QRRow | QRRow[] }[] | null)?.[0]?.questionnaire_responses;
        const qr = Array.isArray(q) ? q[0] : q;
        if (qr?.core) {
          // 已登入且在資料庫有記錄 → 必已綁定顧問
          setBound(true);
          setData(normalizeData({ basic: qr.basic, core: qr.core, deep: qr.deep ?? undefined, kyc: qr.kyc ?? undefined } as QuestionnaireData));
          return;
        }
      }
      // 未登入 / 無 DB 記錄:憑本機推薦碼判斷是否已綁定顧問
      if (loadReferral()) setBound(true);
      const draft = loadDraft();
      setData(draft ? normalizeData(draft) : null);
    })();
  }, []);

  // 未綁定顧問 → 載入推薦顧問名錄
  const [advisors, setAdvisors] = useState<RecommendedAdvisor[] | null>(null);
  const [binding, setBinding] = useState<string | null>(null);
  useEffect(() => {
    if (!bound) listRecommendedAdvisors().then(setAdvisors).catch(() => setAdvisors([]));
  }, [bound]);

  // 實際綁定(已登入才執行):建立客戶記錄 + 綁定帳號 → 解鎖完整分析與報告
  const bindAdvisor = async (code: string, busyKey: string) => {
    if (!data) return;
    setBinding(busyKey);
    try {
      saveReferral(code);
      const res = await submitClientQuestionnaire({ referralCode: code, data });
      if (res.ok) {
        saveClientId(res.clientId);
        await linkClientAccount(res.clientId);
        clearPendingAdvisor();
        setBound(true);
      }
    } catch {
      /* 綁定失敗:靜默,使用者可再試 */
    } finally {
      setBinding(null);
    }
  };

  const chooseAdvisor = async (a: RecommendedAdvisor) => {
    if (!data || binding) return;
    // 無推薦碼客戶:連結顧問(並解鎖產出報告)前,先要求註冊/登入;登入後自動完成綁定
    if (!loggedIn) {
      savePendingAdvisor(a.referralCode);
      router.push("/client/account?next=/client/dashboard");
      return;
    }
    await bindAdvisor(a.referralCode, a.id);
  };

  // 註冊/登入回來後,若有待綁定顧問則自動完成綁定
  useEffect(() => {
    if (!loggedIn || bound || !data || binding) return;
    const pending = loadPendingAdvisor();
    if (pending) bindAdvisor(pending, "pending");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, bound, data]);

  const view = useMemo(() => {
    if (!data) return null;
    const cls = assetClassBreakdown(data.core.assets);
    const risk = riskAssetBreakdown(data.core.assets);
    return {
      total: cls.total,
      liquid: cls.slices.find((s) => s.assetClass === "流動")?.amount ?? 0,
      protection: cls.protection,
      classSlices: cls.slices,
      pie: cls.slices.map((s) => ({ name: s.assetClass, value: s.amount })),
      risk,
      riskPct: cls.total > 0 ? Math.round((risk.total / cls.total) * 100) : 0,
      gaps: computeGaps(data, clientDefaultParams(data.basic.honorific)),
    };
  }, [data]);

  if (data === undefined) return <Center>載入中…</Center>;
  if (data === null || !view)
    return (
      <Center>
        <p className="mb-4 text-neutral-600 dark:text-neutral-300">尚未有作答資料。</p>
        <Link href="/client/assessment" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
          開始填問卷
        </Link>
      </Center>
    );

  const liquidPct = view.total > 0 ? Math.round((view.liquid / view.total) * 100) : 0;

  // 資產分布文字敘述(客觀事實):最大類別 + 流動/風險占比 + 保障獨立
  const topCat = [...view.classSlices].sort((a, b) => b.amount - a.amount)[0];
  const assetNarrative = topCat
    ? `資產以「${topCat.assetClass}資產」為主,約占 ${topCat.pct}%;流動資產占 ${liquidPct}%、風險資產占 ${view.riskPct}%。` +
      (view.protection > 0 ? `另有保障型保單 ${fmt(view.protection)}(獨立於資產,不計入總額)。` : "")
    : "";

  // 遺產稅預估(僅達課稅標準時顯示)
  const estate = estimateEstateTax(data);

  // 現有保障總覽(各險種單位不同)
  const ins = data.deep?.insurance_detail;
  const insRows = ins
    ? [
        { label: "壽險", has: ins.life.has, text: `保額 ${ins.life.coverage} 萬` },
        { label: "重大疾病", has: ins.critical_illness.has, text: `一次金 ${ins.critical_illness.coverage} 萬` },
        { label: "癌症(單筆)", has: ins.cancer_lump.has, text: `一次金 ${ins.cancer_lump.coverage} 萬` },
        { label: "意外", has: ins.accident.has, text: `保額 ${ins.accident.coverage} 萬` },
        { label: "醫療", has: ins.medical.has, text: `日額 ${ins.medical.daily} 元 · 實支 ${ins.medical.reimburse_limit} 萬` },
        { label: "癌症住院", has: ins.cancer_hospital.has, text: `日額 ${ins.cancer_hospital.daily} 元` },
        { label: "失能", has: ins.disability.has, text: `每月 ${ins.disability.monthly} 萬` },
        { label: "長照", has: ins.long_term_care.has, text: `每月 ${ins.long_term_care.monthly} 萬` },
      ]
    : [];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-12">
      <div className="flex items-center justify-between">
        <BackLink href="/client" label="返回" accent="emerald" />
        <div className="flex items-center gap-4">
          <Link href="/client/assessment" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">
            重新填寫
          </Link>
          {loggedIn && (
            <Link href="/client/account" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">
              個人資料
            </Link>
          )}
          {loggedIn && <SignOutButton redirectTo="/client" />}
        </div>
      </div>

      {!loggedIn && (
        <Link
          href="/client/account"
          className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <span>建立帳號,日後可隨時登入回看此健檢</span>
          <span className="font-medium">建立帳號 →</span>
        </Link>
      )}

      <header className="mt-4">
        <h1 className="text-2xl font-bold">
          {data.basic.surname}
          {data.basic.honorific} 的資產健檢
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          以下為客觀彙整與試算,供你檢視資產現況全貌。
        </p>
      </header>

      {/* 關鍵數字(資產總額不含保障型保單) */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="資產總額" value={fmt(view.total)} hint="不含保障型保單" />
        <Stat label="流動資產占比" value={`${liquidPct}%`} hint={fmt(view.liquid)} />
        <Stat label="風險資產占比" value={`${view.riskPct}%`} hint={fmt(view.risk.total)} />
      </div>

      {/* 資產分布(固定 / 流動 / 風險 三類;保障獨立) */}
      <Card title="資產類別分布">
        {view.pie.length === 0 ? (
          <Empty>尚未填入任何資產金額</Empty>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={view.pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {view.pie.map((entry) => (
                    <Cell key={entry.name} fill={CLASS_COLOR[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend formatter={(v) => `${v}資產`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {assetNarrative && (
          <p className="mt-2 rounded-lg bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
            {assetNarrative}
          </p>
        )}
        {view.protection > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm dark:border-violet-900 dark:bg-violet-950/30">
            <span className="font-medium text-violet-800 dark:text-violet-200">保障型保單(獨立顯示)</span>
            <span className="font-semibold text-violet-800 dark:text-violet-200">{fmt(view.protection)}</span>
          </div>
        )}
      </Card>

      {/* 風險資產配置:穩定收益 vs 高風險 */}
      {view.risk.total > 0 && (
        <Card title="風險資產配置">
          <Bar2
            left={{ label: "穩定收益", value: view.risk.stable.total, color: RISK_COLOR.穩定 }}
            right={{ label: "高風險", value: view.risk.risky.total, color: RISK_COLOR.風險 }}
          />
          <div className="mt-4 space-y-3">
            {view.risk.stable.items.length > 0 && (
              <div>
                <p className="mb-0.5 text-xs font-semibold" style={{ color: RISK_COLOR.穩定 }}>穩定收益型(收租 / 配息)</p>
                {view.risk.stable.items.map((it) => (
                  <RiskRow key={it.key} label={it.label} amount={it.amount} pct={Math.round((it.amount / view.risk.total) * 100)} color={RISK_COLOR.穩定} />
                ))}
              </div>
            )}
            {view.risk.risky.items.length > 0 && (
              <div>
                <p className="mb-0.5 text-xs font-semibold" style={{ color: RISK_COLOR.風險 }}>高風險型(股票 / 基金 / 其他)</p>
                {view.risk.risky.items.map((it) => (
                  <RiskRow key={it.key} label={it.label} amount={it.amount} pct={Math.round((it.amount / view.risk.total) * 100)} color={RISK_COLOR.風險} />
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-neutral-100 pt-2 text-sm dark:border-neutral-800">
            <span className="font-semibold">風險資產合計</span>
            <span className="font-semibold">{fmt(view.risk.total)}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            穩定收益型=收租不動產、投資型/儲蓄保單(以帳戶價值計);高風險型=股票、基金/ETF、外幣黃金加密等。身故保額不列入。
          </p>
        </Card>
      )}

      {/* 未綁定顧問:解鎖提示 + 顧問推薦 */}
      {!bound && (
        <UnlockCard advisors={advisors} binding={binding} onChoose={chooseAdvisor} loggedIn={loggedIn} />
      )}

      {/* 以下為深入分析(缺口 / 遺產稅 / 保障總覽 / 完整報告)— 綁定顧問後解鎖 */}
      {bound && (
        <>
      {/* 現有保障總覽 */}
      {insRows.length > 0 && (
        <Card title="現有保障總覽">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {insRows.map((r) => (
              <div
                key={r.label}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  r.has
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <span className="font-medium">
                  {r.has ? "✓ " : "— "}
                  {r.label}
                </span>
                <span className={r.has ? "text-emerald-700 dark:text-emerald-300" : "text-neutral-400"}>
                  {r.has ? r.text : "尚無"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            各險種單位不同:壽險/意外/重疾為保額(萬)、醫療為日額+實支實付、失能/長照為每月給付。
          </p>
        </Card>
      )}

      {/* 缺口概況 */}
      <Card title="缺口概況(客觀試算)">
        <div className="space-y-3">
          <GapRow name="退休金缺口" gap={view.gaps.retirement} />
          <GapRow name="保障缺口" gap={view.gaps.protection} />
          <GapRow name="教育金缺口" gap={view.gaps.education} />
        </div>
        <p className="mt-4 rounded-lg bg-neutral-100 p-3 text-xs leading-relaxed text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          試算採透明公式與保守假設(報酬 4% / 通膨 2% / 台灣平均餘命),僅供檢視參考,不構成投資建議。
          {(view.gaps.protection.status === "needs_deep_data" || view.gaps.education.status === "needs_deep_data") &&
            "部分缺口需補充深化問卷(負債、保障、教育金)後才能試算。"}
        </p>
      </Card>

      {/* 遺產稅預估(達課稅標準才顯示) */}
      {estate.taxable && (
        <Card title="遺產稅預估">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="遺產總額" value={fmt(estate.grossEstate)} />
            <Stat label="課稅遺產淨額" value={fmt(estate.netTaxable)} hint={`扣除額 ${fmt(estate.totalDeductions)}`} />
            <Stat label="預估遺產稅" value={fmt(estate.tax)} hint={`稅率 ${Math.round(estate.rate * 100)}%`} />
          </div>
          <details className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <summary className="cursor-pointer px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">扣除額明細</summary>
            <ul className="border-t border-neutral-100 px-3 py-2 text-xs dark:border-neutral-800">
              {estate.deductions.map((d) => (
                <li key={d.label} className="flex justify-between py-0.5">
                  <span className="text-neutral-500 dark:text-neutral-400">{d.label}</span>
                  <span>{fmt(d.amount)}</span>
                </li>
              ))}
            </ul>
          </details>
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            依台灣現行遺產稅概數試算(免稅額 1,333 萬、配偶 493 萬、每位子女 56 萬、每位父母 138 萬、喪葬 138 萬等),
            未計入保單指定受益人等規劃;實際以國稅局核定為準。
          </p>
        </Card>
      )}

      <ContactAdvisorCard />

      <Link
        href="/client/report"
        className="mt-4 block rounded-lg border border-neutral-300 py-3 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
      >
        產出健檢報告 →
      </Link>
        </>
      )}

    </main>
  );
}

// 未綁定顧問:上鎖提示 + 系統顧問推薦(付費優先→已驗證→其他)
function UnlockCard({
  advisors,
  binding,
  onChoose,
  loggedIn,
}: {
  advisors: RecommendedAdvisor[] | null;
  binding: string | null;
  onChoose: (a: RecommendedAdvisor) => void;
  loggedIn: boolean;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔒</span>
        <div>
          <h2 className="text-base font-semibold text-amber-900 dark:text-amber-100">解鎖完整規劃分析</h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            退休 / 保障 / 教育金缺口、遺產稅試算與完整健檢報告,需由<strong>專業財富管理顧問</strong>依你的健檢結果協助規劃。
            選擇一位顧問即可解鎖,並由其與你討論後續方向。
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {advisors === null ? (
          <p className="py-4 text-center text-sm text-amber-700 dark:text-amber-300">載入顧問名單…</p>
        ) : advisors.length === 0 ? (
          <p className="py-4 text-center text-sm text-amber-700 dark:text-amber-300">目前尚無可推薦的顧問,請稍後再試。</p>
        ) : (
          advisors.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-neutral-950"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{a.name}</span>
                  {a.featured && (
                    <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-800 dark:text-amber-100">
                      推薦
                    </span>
                  )}
                  {a.verified && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      ✓ 已驗證
                    </span>
                  )}
                </div>
                {a.licenses.length > 0 && (
                  <div className="mt-1">
                    <ProBadges licenses={a.licenses} size="xs" />
                    <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {a.licenses.map((l) => l.type).join("、")}
                    </p>
                  </div>
                )}
                {a.website && (
                  <a
                    href={/^https?:\/\//i.test(a.website) ? a.website : `https://${a.website}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50"
                  >
                    認識我 →
                  </a>
                )}
              </div>
              <button
                onClick={() => onChoose(a)}
                disabled={binding !== null}
                className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {binding === a.id ? "綁定中…" : "選擇此顧問"}
              </button>
            </div>
          ))
        )}
      </div>

      {!loggedIn && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          連結顧問並解鎖完整分析 / 產出報告前,需先建立帳號或登入,顧問才能收到你的資料並與你聯繫。
        </p>
      )}
    </section>
  );
}

// ── 子元件 ───────────────────────────────────────────

function Center({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">{children}</main>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-lg font-bold sm:text-xl">{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      {hint && <div className="text-[11px] text-neutral-400">{hint}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-10 text-center text-sm text-neutral-400">{children}</div>;
}

function Bar2({ left, right }: { left: { label: string; value: number; color: string }; right: { label: string; value: number; color: string } }) {
  const total = left.value + right.value;
  const lp = total > 0 ? (left.value / total) * 100 : 50;
  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        {total > 0 && (
          <>
            <div style={{ width: `${lp}%`, background: left.color }} />
            <div style={{ width: `${100 - lp}%`, background: right.color }} />
          </>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: left.color }} />
          {left.label} {fmt(left.value)}
        </span>
        <span className="flex items-center gap-1.5">
          {right.label} {fmt(right.value)}
          <span className="h-2 w-2 rounded-full" style={{ background: right.color }} />
        </span>
      </div>
    </div>
  );
}

function RiskRow({ label, amount, pct, color }: { label: string; amount: number; pct: number; color: string }) {
  return (
    <div className="mt-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-neutral-600 dark:text-neutral-300">
          {fmt(amount)}
          <span className="ml-1.5 text-xs text-neutral-400">{pct}%</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function GapRow({ name, gap }: { name: string; gap: GapResult }) {
  if (gap.status === "needs_deep_data") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed border-neutral-300 px-4 py-3 dark:border-neutral-700">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-xs text-neutral-400">補充深化問卷後可試算</span>
      </div>
    );
  }
  const shortfall = gap.gap > 0;
  return (
    <div className={`rounded-lg border px-4 py-3 ${shortfall ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{name}</span>
        <span className={`text-sm font-semibold ${shortfall ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
          {shortfall ? `不足 ${fmt(gap.gap)}` : "已足夠"}
        </span>
      </div>
    </div>
  );
}
