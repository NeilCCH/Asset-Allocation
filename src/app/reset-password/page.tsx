"use client";

// 重設密碼 — 使用者點 Email 內的重設連結後到此設定新密碼。
// 連結帶的 code 由 supabase 瀏覽器 client(detectSessionInUrl)自動換成 recovery session。
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BackLink } from "@/components/ui/BackLink";
import { ArrowIcon } from "@/components/ui/ArrowIcon";

const inputCls =
  "mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-900";

export default function ResetPassword() {
  const [ready, setReady] = useState<boolean | null>(null); // null=確認中
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setReady((r) => (r === null ? !!data.session : r));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (password.length < 6) return setMsg("密碼至少 6 碼");
    if (password !== password2) return setMsg("兩次輸入的密碼不一致");
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg(error.message);
    setDone(true);
  };

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <BackLink href="/" label="首頁" accent="neutral" />
      <h1 className="mt-6 text-2xl font-bold">重設密碼</h1>

      {ready === null && <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">確認連結中…</p>}

      {ready === false && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          此重設連結無效或已過期。請回登入頁點「忘記密碼?」重新寄送新的連結。
        </p>
      )}

      {ready && !done && (
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">新密碼</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="至少 6 碼" autoComplete="new-password" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">再次輸入新密碼</span>
            <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} className={inputCls} placeholder="再輸入一次" autoComplete="new-password" />
          </label>
          {msg && <p className="text-sm text-red-600 dark:text-red-400">{msg}</p>}
          <button
            onClick={submit}
            disabled={busy || !password || !password2}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "更新中…" : "更新密碼"}
          </button>
        </div>
      )}

      {done && (
        <div className="mt-6 space-y-3">
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            ✓ 密碼已更新,請用新密碼重新登入。
          </p>
          <div className="flex gap-3 text-sm">
            <Link href="/advisor" className="group inline-flex items-center gap-1 font-medium text-sky-700 hover:underline dark:text-sky-400">前往顧問登入<ArrowIcon /></Link>
            <Link href="/client/account" className="group inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline dark:text-emerald-400">客戶登入<ArrowIcon /></Link>
          </div>
        </div>
      )}
    </main>
  );
}
