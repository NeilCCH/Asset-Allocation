"use client";

// 顧問 CRM 面板 — 客戶跟進狀態 / 備註 / 下次追蹤日 + 客戶預約清單。⚠️ 顧問專屬。
import { useState } from "react";
import { saveClientCrm, markContactHandled, type ClientCrm } from "@/lib/actions/crm";
import { LEAD_STATUSES, DEFAULT_LEAD_STATUS, leadStatusStyle } from "@/lib/domain/crm";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function CrmPanel({ clientId, initial }: { clientId: string; initial: ClientCrm }) {
  const [status, setStatus] = useState(initial.leadStatus ?? DEFAULT_LEAD_STATUS);
  const [notes, setNotes] = useState(initial.notes);
  const [follow, setFollow] = useState(initial.nextFollowUp ?? "");
  const [contacts, setContacts] = useState(initial.contacts);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const pendingContacts = contacts.filter((c) => c.status === "new");

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const res = await saveClientCrm({ clientId, leadStatus: status, notes, nextFollowUp: follow || null });
    setSaving(false);
    setMsg(res.ok ? "已儲存" : res.error);
  };

  const handle = async (id: string) => {
    const res = await markContactHandled(id);
    if (res.ok) setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, status: "handled" } : c)));
  };

  return (
    <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">跟進管理(CRM)</h2>
        {pendingContacts.length > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
            🔔 {pendingContacts.length} 筆待處理預約
          </span>
        )}
      </div>

      {/* 客戶預約 */}
      {contacts.length > 0 && (
        <div className="mt-3 space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className={`rounded-lg border p-3 text-sm ${
                c.status === "new"
                  ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                  : "border-neutral-200 opacity-70 dark:border-neutral-800"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {fmtDateTime(c.created_at)} 客戶預約{c.status === "new" ? "" : "(已處理)"}
                </span>
                {c.status === "new" && (
                  <button onClick={() => handle(c.id)} className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400">
                    標記已處理
                  </button>
                )}
              </div>
              {c.preferred_time && <div className="mt-1">方便時間:{c.preferred_time}</div>}
              {c.message && <div className="mt-0.5 text-neutral-600 dark:text-neutral-300">「{c.message}」</div>}
            </div>
          ))}
        </div>
      )}

      {/* 狀態 */}
      <div className="mt-4">
        <span className="text-sm font-medium">跟進狀態</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {LEAD_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 text-sm ${status === s ? leadStatusStyle(s) + " ring-2 ring-offset-1 ring-neutral-300 dark:ring-neutral-600" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 下次追蹤日 */}
      <label className="mt-4 block">
        <span className="text-sm font-medium">下次追蹤日</span>
        <input
          type="date"
          value={follow}
          onChange={(e) => setFollow(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-900 sm:w-52"
        />
      </label>

      {/* 備註 */}
      <label className="mt-4 block">
        <span className="text-sm font-medium">跟進備註</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="通話紀錄、客戶需求、下一步…"
          className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {saving ? "儲存中…" : "儲存跟進"}
        </button>
        {msg && <span className={msg === "已儲存" ? "text-sm text-emerald-600 dark:text-emerald-400" : "text-sm text-red-600 dark:text-red-400"}>{msg}</span>}
      </div>
    </section>
  );
}
