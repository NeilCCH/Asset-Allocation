"use client";

// 修改密碼 — 已登入使用者變更密碼(以現有 session 授權,無需舊密碼)。可收合。
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputCls =
  "mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-900";

export function ChangePassword({ accent = "sky" }: { accent?: "sky" | "emerald" }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const btn = accent === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-sky-600 hover:bg-sky-700";

  const submit = async () => {
    setMsg(null);
    setOkMsg(null);
    if (pw.length < 6) return setMsg("密碼至少 6 碼");
    if (pw !== pw2) return setMsg("兩次輸入的密碼不一致");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg(error.message);
    setPw("");
    setPw2("");
    setOkMsg("✓ 密碼已更新");
  };

  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-semibold">修改密碼</span>
        <span className="text-xs text-neutral-400">{open ? "收合 ▲" : "展開 ▼"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">新密碼</span>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} placeholder="至少 6 碼" autoComplete="new-password" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">再次輸入新密碼</span>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputCls} placeholder="再輸入一次" autoComplete="new-password" />
          </label>
          {msg && <p className="text-sm text-red-600 dark:text-red-400">{msg}</p>}
          {okMsg && <p className="text-sm text-emerald-600 dark:text-emerald-400">{okMsg}</p>}
          <button
            onClick={submit}
            disabled={busy || !pw || !pw2}
            className={`w-full rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${btn}`}
          >
            {busy ? "更新中…" : "更新密碼"}
          </button>
        </div>
      )}
    </div>
  );
}
