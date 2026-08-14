"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Assets,
  Honorific,
  Horizon,
  IncomeBand,
  IncomeType,
  QuestionnaireData,
  SurplusBand,
  Urgency,
} from "@/lib/domain/types";
import {
  ASSET_FIELDS,
  HONORIFIC_OPTIONS,
  HORIZON_OPTIONS,
  INCOME_BAND_OPTIONS,
  INCOME_TYPE_OPTIONS,
  SURPLUS_BAND_OPTIONS,
  URGENCY_OPTIONS,
} from "@/lib/domain/options";
import { saveDraft } from "@/lib/draft";
import { loadReferral } from "@/lib/referral";
import { saveClientId } from "@/lib/clientSession";
import { submitClientQuestionnaire } from "@/lib/actions/client";
import { PDPA_CONSENT_STATEMENT, PDPA_SECTIONS } from "@/lib/domain/pdpa";

type AssetForm = Record<keyof Assets, { has: boolean; amount: string }>;

const emptyAssets: AssetForm = ASSET_FIELDS.reduce((acc, f) => {
  acc[f.key] = { has: false, amount: "" };
  return acc;
}, {} as AssetForm);

// 現有保障明細欄位
type InsKey = "medical" | "critical_illness" | "accident" | "life" | "long_term_care";
const INS_FIELDS: { key: InsKey; label: string }[] = [
  { key: "medical", label: "醫療" },
  { key: "critical_illness", label: "重大疾病" },
  { key: "accident", label: "意外" },
  { key: "life", label: "壽險" },
  { key: "long_term_care", label: "長照" },
];
type InsForm = Record<InsKey, { has: boolean; coverage: string }>;
const emptyInsurance: InsForm = INS_FIELDS.reduce((acc, f) => {
  acc[f.key] = { has: false, coverage: "" };
  return acc;
}, {} as InsForm);

const mkIns = (v: { has: boolean; coverage: string }) => ({
  has: v.has,
  coverage: v.has ? Number(v.coverage) || 0 : 0,
});

interface Form {
  surname: string;
  honorific: Honorific;
  line_id: string;
  mobile: string;
  email: string;
  pdpa: boolean;
  age: string;
  retire_age: string;
  childrenCount: string;
  childrenAges: string[];
  support_parents: boolean;
  income_type: IncomeType;
  income_band: IncomeBand | "";
  surplus_band: SurplusBand | "";
  horizon: Horizon | "";
  urgency: Urgency | "";
  assets: AssetForm;
  // 深化:負債
  mortgageBalance: string;
  loanBalance: string;
  liabMonthly: string;
  // 深化:退休後需求 / 緊急金 / 大額支出
  retireLifestylePct: string;
  emergencyMonths: string;
  majorExpenseAmount: string;
  majorExpenseYears: string;
  // 深化:現有保障明細
  insurance: InsForm;
  // 深化:子女教育金(每位子女一筆)
  eduGoals: { years_until: string; location: "國內" | "海外" }[];
}

const initialForm: Form = {
  surname: "",
  honorific: "先生",
  line_id: "",
  mobile: "",
  email: "",
  pdpa: false,
  age: "",
  retire_age: "",
  childrenCount: "0",
  childrenAges: [],
  support_parents: false,
  income_type: "固定薪",
  income_band: "",
  surplus_band: "",
  horizon: "",
  urgency: "",
  assets: emptyAssets,
  mortgageBalance: "",
  loanBalance: "",
  liabMonthly: "",
  retireLifestylePct: "70",
  emergencyMonths: "",
  majorExpenseAmount: "",
  majorExpenseYears: "",
  insurance: emptyInsurance,
  eduGoals: [],
};

const STEPS = ["個資同意", "基本 · 家庭", "收支 · 時間", "資產盤點", "負債 · 退休", "保障 · 教育"];

export default function Assessment() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(initialForm);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const setChildrenCount = (n: number) => {
    const count = Math.max(0, Math.min(10, n));
    setF((p) => {
      const ages = [...p.childrenAges];
      ages.length = count;
      for (let i = 0; i < count; i++) if (ages[i] == null) ages[i] = "";
      const eduGoals = [...p.eduGoals];
      eduGoals.length = count;
      for (let i = 0; i < count; i++) if (eduGoals[i] == null) eduGoals[i] = { years_until: "", location: "國內" };
      return { ...p, childrenCount: String(count), childrenAges: ages, eduGoals };
    });
  };

  const setAsset = (key: keyof Assets, patch: Partial<{ has: boolean; amount: string }>) =>
    setF((p) => ({ ...p, assets: { ...p.assets, [key]: { ...p.assets[key], ...patch } } }));

  const setIns = (key: InsKey, patch: Partial<{ has: boolean; coverage: string }>) =>
    setF((p) => ({ ...p, insurance: { ...p.insurance, [key]: { ...p.insurance[key], ...patch } } }));

  const setEduGoal = (i: number, patch: Partial<{ years_until: string; location: "國內" | "海外" }>) =>
    setF((p) => {
      const eduGoals = [...p.eduGoals];
      eduGoals[i] = { ...eduGoals[i], ...patch };
      return { ...p, eduGoals };
    });

  const canNext = useMemo(() => {
    if (step === 0) return f.pdpa;
    if (step === 1) return f.surname.trim() !== "" && f.age !== "" && f.retire_age !== "";
    if (step === 2) return f.income_band && f.surplus_band && f.horizon && f.urgency;
    return true;
  }, [step, f]);

  const submit = async () => {
    const assets = ASSET_FIELDS.reduce((acc, field) => {
      const a = f.assets[field.key];
      acc[field.key] = { has: a.has, amount: a.has ? Number(a.amount) || 0 : 0 };
      return acc;
    }, {} as Assets);

    const data: QuestionnaireData = {
      basic: {
        surname: f.surname.trim(),
        honorific: f.honorific,
        line_id: f.line_id || undefined,
        mobile: f.mobile || undefined,
        email: f.email || undefined,
      },
      core: {
        age: Number(f.age),
        retire_age: Number(f.retire_age),
        dependents: {
          children: {
            count: Number(f.childrenCount) || 0,
            ages: f.childrenAges.map((a) => Number(a) || 0),
          },
          support_parents: f.support_parents,
        },
        income_type: f.income_type,
        income_band: f.income_band as IncomeBand,
        surplus_band: f.surplus_band as SurplusBand,
        assets,
        horizon: f.horizon as Horizon,
        urgency: f.urgency as Urgency,
      },
      deep: {
        retire_lifestyle_pct: f.retireLifestylePct ? Number(f.retireLifestylePct) : undefined,
        liabilities: {
          mortgage_balance: Number(f.mortgageBalance) || 0,
          loan_balance: Number(f.loanBalance) || 0,
          monthly_payment: Number(f.liabMonthly) || 0,
        },
        emergency_months: f.emergencyMonths ? Number(f.emergencyMonths) : undefined,
        major_expense: f.majorExpenseAmount
          ? { amount: Number(f.majorExpenseAmount) || 0, years_until: Number(f.majorExpenseYears) || 0 }
          : undefined,
        insurance_detail: {
          medical: mkIns(f.insurance.medical),
          critical_illness: mkIns(f.insurance.critical_illness),
          accident: mkIns(f.insurance.accident),
          life: mkIns(f.insurance.life),
          long_term_care: mkIns(f.insurance.long_term_care),
        },
        edu_goals: f.eduGoals
          .filter((g) => g.years_until !== "")
          .map((g) => ({ years_until: Number(g.years_until) || 0, location: g.location })),
      },
    };
    saveDraft(data);
    // 有綁定顧問(邀請連結)則存進 Supabase;失敗不擋客戶看自己的儀表板
    const ref = loadReferral();
    if (ref) {
      try {
        const res = await submitClientQuestionnaire({ referralCode: ref, data });
        if (res.ok) saveClientId(res.clientId);
      } catch {
        /* 靜默失敗:客戶仍可由 localStorage 檢視事實層 */
      }
    }
    router.push("/client/dashboard");
  };

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8 sm:py-12">
      <Link href="/client" className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
        ← 返回
      </Link>

      {/* 進度 */}
      <div className="mt-5 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`h-1.5 w-full rounded-full ${
                i <= step ? "bg-emerald-500" : "bg-neutral-200 dark:bg-neutral-700"
              }`}
            />
            <span className={`text-[11px] ${i === step ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-neutral-400"}`}>
              {s}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-7">
        {step === 0 && <PdpaStep checked={f.pdpa} onChange={(v) => set("pdpa", v)} />}

        {step === 1 && (
          <Section title="基本資料與家庭結構">
            <div className="grid grid-cols-3 gap-3">
              <Field label="姓氏" className="col-span-2">
                <Input value={f.surname} onChange={(v) => set("surname", v)} placeholder="王" />
              </Field>
              <Field label="稱謂">
                <Select value={f.honorific} onChange={(v) => set("honorific", v as Honorific)} options={HONORIFIC_OPTIONS.map((h) => ({ value: h, label: h }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="目前年齡">
                <Input value={f.age} onChange={(v) => set("age", v)} type="number" placeholder="40" />
              </Field>
              <Field label="預計退休年齡">
                <Input value={f.retire_age} onChange={(v) => set("retire_age", v)} type="number" placeholder="65" />
              </Field>
            </div>
            <Field label="子女人數">
              <Input value={f.childrenCount} onChange={(v) => setChildrenCount(Number(v))} type="number" placeholder="0" />
            </Field>
            {f.childrenAges.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {f.childrenAges.map((age, i) => (
                  <Field key={i} label={`第 ${i + 1} 位年齡`}>
                    <Input
                      value={age}
                      onChange={(v) =>
                        setF((p) => {
                          const ages = [...p.childrenAges];
                          ages[i] = v;
                          return { ...p, childrenAges: ages };
                        })
                      }
                      type="number"
                      placeholder="8"
                    />
                  </Field>
                ))}
              </div>
            )}
            <Toggle label="需奉養父母" checked={f.support_parents} onChange={(v) => set("support_parents", v)} />
            <ContactHint />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="LINE ID">
                <Input value={f.line_id} onChange={(v) => set("line_id", v)} placeholder="選填" />
              </Field>
              <Field label="手機">
                <Input value={f.mobile} onChange={(v) => set("mobile", v)} placeholder="選填" />
              </Field>
              <Field label="Email">
                <Input value={f.email} onChange={(v) => set("email", v)} placeholder="選填" />
              </Field>
            </div>
          </Section>
        )}

        {step === 2 && (
          <Section title="收支狀況與資金時間軸">
            <Field label="主要收入型態">
              <Select value={f.income_type} onChange={(v) => set("income_type", v as IncomeType)} options={INCOME_TYPE_OPTIONS} />
            </Field>
            <Field label="家庭年收入(稅前)">
              <Select value={f.income_band} onChange={(v) => set("income_band", v as IncomeBand)} options={INCOME_BAND_OPTIONS} placeholder="請選擇" />
            </Field>
            <Field label="每月結餘(收入減支出)">
              <Select value={f.surplus_band} onChange={(v) => set("surplus_band", v as SurplusBand)} options={SURPLUS_BAND_OPTIONS} placeholder="請選擇" />
            </Field>
            <Field label="這筆資金多久內用不到">
              <Select value={f.horizon} onChange={(v) => set("horizon", v as Horizon)} options={HORIZON_OPTIONS} placeholder="請選擇" />
            </Field>
            <Field label="規劃急迫性">
              <Select value={f.urgency} onChange={(v) => set("urgency", v as Urgency)} options={URGENCY_OPTIONS} placeholder="請選擇" />
            </Field>
          </Section>
        )}

        {step === 3 && (
          <Section title="資產快速盤點">
            <p className="-mt-2 mb-1 text-sm text-neutral-500 dark:text-neutral-400">
              勾選你持有的類別並填入概略金額(萬元),不確定填大概即可。
            </p>
            <div className="space-y-2">
              {ASSET_FIELDS.map((field) => {
                const a = f.assets[field.key];
                return (
                  <div key={field.key} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={a.has}
                        onChange={(e) => setAsset(field.key, { has: e.target.checked })}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span className="flex-1 text-sm font-medium">
                        {field.label}
                        {field.hint && <span className="ml-1 text-xs font-normal text-neutral-400">{field.hint}</span>}
                      </span>
                      {a.has && (
                        <span className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={a.amount}
                            onChange={(e) => setAsset(field.key, { amount: e.target.value })}
                            placeholder="0"
                            className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 text-right text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900"
                          />
                          <span className="text-xs text-neutral-400">萬</span>
                        </span>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {step === 4 && (
          <Section title="負債 · 退休 · 緊急金">
            <p className="-mt-2 mb-1 text-sm text-neutral-500 dark:text-neutral-400">
              填寫以下資訊才能完整試算「保障缺口」與退休準備。沒有的項目留白即可。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="房貸餘額(萬)">
                <Input value={f.mortgageBalance} onChange={(v) => set("mortgageBalance", v)} type="number" placeholder="0" />
              </Field>
              <Field label="其他貸款餘額(萬)">
                <Input value={f.loanBalance} onChange={(v) => set("loanBalance", v)} type="number" placeholder="0" />
              </Field>
            </div>
            <Field label="每月還款總額(萬)">
              <Input value={f.liabMonthly} onChange={(v) => set("liabMonthly", v)} type="number" placeholder="0" />
            </Field>
            <Field label="退休後想維持目前開銷的幾成(%)">
              <Input value={f.retireLifestylePct} onChange={(v) => set("retireLifestylePct", v)} type="number" placeholder="70" />
            </Field>
            <Field label="緊急預備金(幾個月生活費)">
              <Input value={f.emergencyMonths} onChange={(v) => set("emergencyMonths", v)} type="number" placeholder="6" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="近期大額支出(萬,選填)">
                <Input value={f.majorExpenseAmount} onChange={(v) => set("majorExpenseAmount", v)} type="number" placeholder="選填" />
              </Field>
              <Field label="預計幾年後">
                <Input value={f.majorExpenseYears} onChange={(v) => set("majorExpenseYears", v)} type="number" placeholder="選填" />
              </Field>
            </div>
          </Section>
        )}

        {step === 5 && (
          <Section title="現有保障 · 教育金">
            <p className="-mt-2 mb-1 text-sm text-neutral-500 dark:text-neutral-400">
              勾選已有的保障並填入保額(萬),用於試算保障缺口。
            </p>
            <div className="space-y-2">
              {INS_FIELDS.map((ff) => {
                const v = f.insurance[ff.key];
                return (
                  <div key={ff.key} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={v.has} onChange={(e) => setIns(ff.key, { has: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                      <span className="flex-1 text-sm font-medium">{ff.label}</span>
                      {v.has && (
                        <span className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={v.coverage}
                            onChange={(e) => setIns(ff.key, { coverage: e.target.value })}
                            placeholder="保額"
                            className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 text-right text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900"
                          />
                          <span className="text-xs text-neutral-400">萬</span>
                        </span>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>

            {f.eduGoals.length > 0 && (
              <div className="mt-4">
                <span className="text-sm font-medium">子女教育金規劃</span>
                <p className="text-xs text-neutral-400">填了才能試算教育金缺口。</p>
                <div className="mt-2 space-y-2">
                  {f.eduGoals.map((g, i) => (
                    <div key={i} className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <Field label={`第 ${i + 1} 位:幾年後就學`}>
                        <Input value={g.years_until} onChange={(v) => setEduGoal(i, { years_until: v })} type="number" placeholder="10" />
                      </Field>
                      <Field label="國內 / 海外">
                        <Select value={g.location} onChange={(v) => setEduGoal(i, { location: v as "國內" | "海外" })} options={[{ value: "國內", label: "國內" }, { value: "海外", label: "海外" }]} />
                      </Field>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}
      </div>

      {/* 導覽按鈕 */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-lg px-4 py-2.5 text-sm text-neutral-600 disabled:opacity-0 dark:text-neutral-300"
        >
          上一步
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            下一步
          </button>
        ) : (
          <button
            onClick={submit}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            看我的資產健檢 →
          </button>
        )}
      </div>
    </main>
  );
}

// ── 子元件 ───────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">{title}</h1>
      {children}
    </section>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900";

function Input({ value, onChange, type = "text", placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />;
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function ContactHint() {
  return (
    <p className="rounded-lg bg-neutral-100 p-3 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
      聯絡方式為選填,留下越完整,顧問越能主動提供後續規劃服務。
    </p>
  );
}

function PdpaStep({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">個人資料蒐集、處理及利用告知暨同意</h1>
      <p className="-mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        依《個人資料保護法》第 8 條告知事項。請詳閱後勾選同意。
      </p>
      <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        {PDPA_SECTIONS.map((s) => (
          <div key={s.no}>
            <p className="mb-1 font-medium text-neutral-800 dark:text-neutral-100">
              {s.no}、{s.title}
            </p>
            <p className="whitespace-pre-line">{s.body}</p>
          </div>
        ))}
      </div>
      <label className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
        <span className="text-sm text-neutral-700 dark:text-neutral-200">{PDPA_CONSENT_STATEMENT}</span>
      </label>
    </section>
  );
}
