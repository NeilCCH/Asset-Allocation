"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { linkClientAccount } from "@/lib/actions/clientAccount";
import { loadClientId } from "@/lib/clientSession";

export default function ClientAccount() {
  const router = useRouter();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setMsg("註冊成功!請至 Email 收信完成驗證,回來後『登入』即可綁定你的健檢資料。");
          setMode("login");
          return;
        }
        const clientId = loadClientId();
        if (clientId) await linkClientAccount(clientId);
        router.push("/client/dashboard");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // 登入時也補做綁定(涵蓋開啟 Email 驗證、註冊當下未取得 session 的情況)
        const clientId = loadClientId();
        if (clientId) await linkClientAccount(clientId);
        router.push("/client/dashboard");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "發生錯誤,請重試");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <Link href="/client/dashboard" className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
        ← 返回
      </Link>
      <h1 className="mt-6 text-2xl font-bold">{mode === "register" ? "建立帳號" : "登入"}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
        {mode === "register" ? "建立帳號後,日後可隨時登入回看你的資產健檢。" : "登入以查看你先前的資產健檢。"}
      </p>

      <div className="mt-4 inline-flex rounded-lg border border-neutral-200 p-0.5 text-sm dark:border-neutral-800">
        {(["register", "login"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setMsg(null); }} className={`rounded-md px-4 py-1.5 ${mode === m ? "bg-emerald-600 text-white" : "text-neutral-500"}`}>
            {m === "register" ? "註冊" : "登入"}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">密碼</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="至少 6 碼" />
        </label>
        {msg && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{msg}</p>}
        <button
          onClick={submit}
          disabled={busy || !email || !password}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "處理中…" : mode === "register" ? "建立帳號" : "登入"}
        </button>
      </div>
    </main>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900";
