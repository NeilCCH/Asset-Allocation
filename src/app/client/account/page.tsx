"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
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
  // 讀「實際 DOM 值」以相容自動填入(autofill 常不觸發 React onChange)
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    // 讀實際 DOM 值以相容自動填入(不以 disabled 鎖欄位,避免 autofill 未觸發 onChange 時卡住按鈕)
    const em = (emailRef.current?.value ?? email).trim();
    const pw = passwordRef.current?.value ?? password;
    if (!em || !pw) {
      setMsg("請輸入 Email 與密碼");
      return;
    }
    setEmail(em);
    setPassword(pw);
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email: em, password: pw });
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
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
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

  const forgotPassword = async () => {
    const em = (emailRef.current?.value ?? email).trim();
    if (!em) return setMsg("請先輸入 Email,再點忘記密碼");
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().auth.resetPasswordForEmail(em, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    setMsg(error ? error.message : "已寄出密碼重設連結,請至 Email 收信點擊連結重設。");
  };

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <BackLink href="/client/dashboard" label="返回" accent="emerald" />
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
          <input ref={emailRef} type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">密碼</span>
          <input ref={passwordRef} type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="至少 6 碼" />
        </label>
        {msg && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{msg}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "處理中…" : mode === "register" ? "建立帳號" : "登入"}
        </button>

        {mode === "login" && (
          <button onClick={forgotPassword} disabled={busy} className="w-full text-center text-xs text-neutral-500 hover:text-emerald-700 disabled:opacity-50 dark:hover:text-emerald-400">
            忘記密碼?
          </button>
        )}
      </div>
    </main>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900";
