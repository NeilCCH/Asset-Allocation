"use client";

// 顧問編輯註冊資料 — 姓名 / 公司名稱 / 職稱 / 手機 / 證照。RLS 限本人。
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAdvisorProfile, type AdvisorProfile } from "@/lib/actions/advisor";
import { LICENSE_OPTIONS, LICENSE_REQUIRES_NUMBER, type LicenseType } from "@/lib/domain/licenses";

const inputCls =
  "mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-900";

export function ProfileForm({ advisor }: { advisor: AdvisorProfile }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(advisor.full_name ?? "");
  const [companyName, setCompanyName] = useState(advisor.company_name ?? "");
  const [jobTitle, setJobTitle] = useState(advisor.job_title ?? "");
  const [mobile, setMobile] = useState(advisor.mobile ?? "");
  const [licenseNos, setLicenseNos] = useState<Partial<Record<LicenseType, string>>>(() =>
    Object.fromEntries(advisor.licenses.map((l) => [l.type, l.number ?? ""])) as Partial<Record<LicenseType, string>>,
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
    licenseEntries.length > 0 && licenseEntries.every(([type, no]) => !LICENSE_REQUIRES_NUMBER[type] || no.trim() !== "");
  const canSave = fullName.trim() !== "" && mobile.trim() !== "" && licensesValid && !busy;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await updateAdvisorProfile({
      fullName: fullName.trim(),
      companyName: companyName.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      mobile: mobile.trim(),
      licenses: licenseEntries.map(([type, number]) => ({ type, number: number.trim() || undefined })),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("已儲存");
      router.push("/advisor/dashboard");
      router.refresh();
    } else {
      setMsg(res.error);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Email(不可修改)</span>
        <input value={advisor.email} readOnly className={`${inputCls} cursor-not-allowed bg-neutral-100 text-neutral-500 dark:bg-neutral-800`} />
      </label>

      <label className="block">
        <span className="text-sm font-medium">姓名</span>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="王大明" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">公司名稱</span>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} placeholder="選填" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">職稱</span>
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={inputCls} placeholder="選填" />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">手機</span>
        <input value={mobile} onChange={(e) => setMobile(e.target.value)} className={inputCls} placeholder="0912-345-678" />
      </label>

      <div>
        <span className="text-sm font-medium">專業證照</span>
        <p className="mt-0.5 text-xs text-neutral-400">勾選後請填入合格證號,至少一張。</p>
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

      {msg && (
        <p className={`text-sm ${msg === "已儲存" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{msg}</p>
      )}

      <button
        onClick={save}
        disabled={!canSave}
        className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "儲存中…" : "儲存變更"}
      </button>
    </div>
  );
}
