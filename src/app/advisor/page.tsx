"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createAdvisorProfile } from "@/lib/actions/advisor";
import { LICENSE_OPTIONS, type LicenseType } from "@/lib/domain/licenses";

export default function AdvisorAuth() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [licenses, setLicenses] = useState<LicenseType[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toggleLicense = (l: LicenseType) =>
    setLicenses((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setMsg("註冊成功!請至 Email 收信完成驗證後再登入。");
          setMode("login");
          return;
        }
        const res = await createAdvisorProfile({
          displayName,
          licenses: licenses.map((type) => ({ type })),
          firmName: firmName || undefined,
        });
        if (!res.ok) throw new Error(res.error);
        router.push("/advisor/dashboard");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/advisor/dashboard");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "發生錯誤,請重試");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
        ← 返回
      </Link>
      <h1 className="mt-6 text-2xl font-bold">財富管理顧問</h1>

      {/* 切換 */}
      <div className="mt-4 inline-flex rounded-lg border border-neutral-200 p-0.5 text-sm dark:border-neutral-800">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setMsg(null); }}
            className={`rounded-md px-4 py-1.5 ${mode === m ? "bg-sky-600 text-white" : "text-neutral-500"}`}
          >
            {m === "login" ? "登入" : "註冊"}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
        </Field>
        <Field label="密碼">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="至少 6 碼" />
        </Field>

        {mode === "register" && (
          <>
            <Field label="顯示名稱">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="王大明" />
            </Field>
            <Field label="所屬事業體(選填)">
              <input value={firmName} onChange={(e) => setFirmName(e.target.value)} className={inputCls} placeholder="○○投顧 / ○○保經" />
            </Field>
            <div>
              <span className="text-sm font-medium">專業證照(佐證專家資格)</span>
              <div className="mt-2 space-y-1.5">
                {LICENSE_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-start gap-2.5 text-sm">
                    <input type="checkbox" checked={licenses.includes(o.value)} onChange={() => toggleLicense(o.value)} className="mt-0.5 h-4 w-4 accent-sky-600" />
                    <span>
                      {o.label}
                      {o.note && <span className="ml-1 text-xs text-neutral-400">{o.note}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {msg && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{msg}</p>}

        <button
          onClick={submit}
          disabled={busy || !email || !password || (mode === "register" && !displayName)}
          className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "處理中…" : mode === "login" ? "登入" : "註冊並建立檔案"}
        </button>
      </div>
    </main>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-900";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
