"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createAdvisorProfile, getMyAdvisor } from "@/lib/actions/advisor";
import { LICENSE_OPTIONS, LICENSE_REQUIRES_NUMBER, type LicenseType } from "@/lib/domain/licenses";

export default function AdvisorAuth() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [licenseNos, setLicenseNos] = useState<Partial<Record<LicenseType, string>>>({});
  const [cardFront, setCardFront] = useState<File | null>(null);
  const [cardBack, setCardBack] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 已登入:有顧問檔案→進後台;無檔案(如 Email 驗證回來後)→留在本頁補完,避免無限跳轉。
  useEffect(() => {
    (async () => {
      const { data } = await createClient().auth.getUser();
      if (!data.user) return;
      const adv = await getMyAdvisor();
      if (adv) {
        router.replace("/advisor/dashboard");
        return;
      }
      setMode("register");
      setEmail(data.user.email ?? "");
      setMsg("此帳號尚未建立顧問檔案,請填寫下方資料完成啟用。");
    })();
  }, [router]);

  const toggleLicense = (l: LicenseType) =>
    setLicenseNos((p) => {
      const next = { ...p };
      if (l in next) delete next[l];
      else next[l] = "";
      return next;
    });
  const setLicenseNo = (l: LicenseType, no: string) => setLicenseNos((p) => ({ ...p, [l]: no }));

  const licenseEntries = Object.entries(licenseNos) as [LicenseType, string][];
  const licensesValid =
    licenseEntries.length > 0 &&
    licenseEntries.every(([type, no]) => !LICENSE_REQUIRES_NUMBER[type] || no.trim() !== "");
  const registerValid = fullName.trim() && mobile.trim() && licensesValid && cardFront && cardBack;

  const uploadCard = async (
    supabase: ReturnType<typeof createClient>,
    uid: string,
    file: File,
    side: "front" | "back",
  ): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${uid}/${side}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("advisor-cards").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // 登入後確認是否已建顧問檔案;沒有則留在本頁補完(常見於開啟 Email 驗證時)
        const adv = await getMyAdvisor();
        if (!adv) {
          setMode("register");
          setMsg("登入成功,但此帳號尚未建立顧問檔案,請填寫下方資料完成啟用。");
          return;
        }
        router.push("/advisor/dashboard");
        return;
      }

      // 註冊 / 補完檔案:若已有 session(驗證信回來後登入)則略過 signUp
      let user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session || !data.user) {
          setMsg("註冊成功!請至 Email 收信完成驗證,回到本頁『登入』即可補完顧問檔案。");
          setMode("login");
          return;
        }
        user = data.user;
      }
      const uid = user.id;
      const cardFrontPath = await uploadCard(supabase, uid, cardFront!, "front");
      const cardBackPath = await uploadCard(supabase, uid, cardBack!, "back");
      const res = await createAdvisorProfile({
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        licenses: licenseEntries.map(([type, number]) => ({ type, number: number.trim() || undefined })),
        cardFrontPath,
        cardBackPath,
      });
      if (!res.ok) throw new Error(res.error);
      router.push("/advisor/dashboard");
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
            <Field label="姓名">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="王大明" />
            </Field>
            <Field label="手機">
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} className={inputCls} placeholder="0912-345-678" />
            </Field>

            {/* 名片上傳(帳號驗證參考) */}
            <div>
              <span className="text-sm font-medium">名片(正反面)</span>
              <p className="mt-0.5 text-xs text-neutral-400">作為帳號驗證參考,兩面皆需上傳。</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <CardUpload label="名片正面" file={cardFront} onChange={setCardFront} />
                <CardUpload label="名片反面" file={cardBack} onChange={setCardBack} />
              </div>
            </div>

            {/* 證照 */}
            <div>
              <span className="text-sm font-medium">專業證照(佐證專家資格)</span>
              <p className="mt-0.5 text-xs text-neutral-400">勾選後請填入合格證號以茲確認,至少一張。</p>
              <div className="mt-2 space-y-1.5">
                {LICENSE_OPTIONS.map((o) => {
                  const checked = o.value in licenseNos;
                  return (
                    <div key={o.value} className="rounded-lg border border-neutral-200 p-2.5 dark:border-neutral-800">
                      <label className="flex items-start gap-2.5 text-sm">
                        <input type="checkbox" checked={checked} onChange={() => toggleLicense(o.value)} className="mt-0.5 h-4 w-4 accent-sky-600" />
                        <span>
                          {o.label}
                          {o.note && <span className="ml-1 text-xs text-neutral-400">{o.note}</span>}
                        </span>
                      </label>
                      {checked && o.requiresNumber && (
                        <input
                          value={licenseNos[o.value] ?? ""}
                          onChange={(e) => setLicenseNo(o.value, e.target.value)}
                          placeholder="合格證號"
                          className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-900"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {msg && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{msg}</p>}

        <button
          onClick={submit}
          disabled={busy || !email || !password || (mode === "register" && !registerValid)}
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

function CardUpload({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  const url = file ? URL.createObjectURL(file) : null;
  return (
    <label className="flex aspect-[7/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-center text-xs text-neutral-500 hover:border-sky-400 dark:border-neutral-700 dark:bg-neutral-900">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="h-full w-full object-cover" />
      ) : (
        <span className="px-2">
          📇<br />
          {label}<br />
          <span className="text-neutral-400">點擊上傳</span>
        </span>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
