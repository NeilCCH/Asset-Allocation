"use client";

// 管理員 — 顧問付費推薦(年費)開通/停用清單。
import { useState } from "react";
import { grantFeatured, revokeFeatured, type AdminAdvisorRow } from "@/lib/actions/admin";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
}
function isActive(a: AdminAdvisorRow): boolean {
  return a.featured && !!a.featured_until && new Date(a.featured_until).getTime() > Date.now();
}

export function AdminAdvisorTable({ initial }: { initial: AdminAdvisorRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refreshRow = (id: string, patch: Partial<AdminAdvisorRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const grant = async (a: AdminAdvisorRow) => {
    setBusy(a.id);
    setMsg(null);
    const res = await grantFeatured(a.id, 12);
    setBusy(null);
    if (res.ok) {
      const until = new Date();
      until.setMonth(until.getMonth() + 12);
      refreshRow(a.id, { featured: true, featured_until: until.toISOString(), featured_requested: false });
      setMsg(`已開通 ${a.name} 的付費推薦(一年)`);
    } else setMsg(res.error);
  };

  const revoke = async (a: AdminAdvisorRow) => {
    setBusy(a.id);
    setMsg(null);
    const res = await revokeFeatured(a.id);
    setBusy(null);
    if (res.ok) {
      refreshRow(a.id, { featured: false, featured_until: null });
      setMsg(`已停用 ${a.name} 的付費推薦`);
    } else setMsg(res.error);
  };

  return (
    <div className="mt-4">
      {msg && <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">{msg}</p>}
      <div className="space-y-3">
        {rows.map((a) => {
          const active = isActive(a);
          const expired = a.featured && !!a.featured_until && !active;
          return (
            <div key={a.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{a.name}</span>
                    <span className="font-mono text-xs text-neutral-500">{a.referral_code}</span>
                    {a.verified && <Badge color="emerald">已驗證</Badge>}
                    {a.featured_requested && !active && <Badge color="amber">申請中</Badge>}
                    {active && <Badge color="sky">付費中</Badge>}
                    {expired && <Badge color="neutral">已過期</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {[a.company_name, a.job_title].filter(Boolean).join(" · ") || "（未填公司/職稱）"} · {a.email}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    付費到期日:<span className={active ? "text-sky-700 dark:text-sky-300" : expired ? "text-amber-700 dark:text-amber-400" : ""}>{fmtDate(a.featured_until)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => grant(a)}
                    disabled={busy === a.id}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {busy === a.id ? "…" : active ? "續約一年" : "開通一年"}
                  </button>
                  {(active || expired) && (
                    <button
                      onClick={() => revoke(a)}
                      disabled={busy === a.id}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                    >
                      停用
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="py-8 text-center text-sm text-neutral-400">尚無顧問。</p>}
      </div>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: "emerald" | "amber" | "sky" | "neutral" }) {
  const cls = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    neutral: "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
  }[color];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}
