"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Assets,
  EduStage,
  Honorific,
  Horizon,
  IncomeBand,
  IncomeType,
  InsuranceDetail,
  LossReaction,
  PlanningScope,
  QuestionnaireData,
  SiblingRelation,
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

// 現有保障明細 — 各險種用對應單位(醫療:日額+實支實付;失能/長照:月給付)
type InsKey = "life" | "critical_illness" | "cancer_lump" | "accident" | "medical" | "cancer_hospital" | "disability" | "long_term_care";
const INS_CONFIG: { key: InsKey; label: string; fields: { name: string; label: string; unit: string }[] }[] = [
  { key: "life", label: "壽險", fields: [{ name: "coverage", label: "保額", unit: "萬" }] },
  { key: "critical_illness", label: "重大疾病", fields: [{ name: "coverage", label: "一次給付", unit: "萬" }] },
  { key: "cancer_lump", label: "癌症(單筆)", fields: [{ name: "coverage", label: "一次給付", unit: "萬" }] },
  { key: "accident", label: "意外", fields: [{ name: "coverage", label: "保額", unit: "萬" }] },
  { key: "medical", label: "醫療", fields: [{ name: "daily", label: "住院日額", unit: "元" }, { name: "reimburse_limit", label: "實支實付限額", unit: "萬" }] },
  { key: "cancer_hospital", label: "癌症住院", fields: [{ name: "daily", label: "住院日額", unit: "元" }] },
  { key: "disability", label: "失能", fields: [{ name: "monthly", label: "每月失能金", unit: "萬" }] },
  { key: "long_term_care", label: "長照", fields: [{ name: "monthly", label: "每月給付", unit: "萬" }] },
];
type InsForm = Record<InsKey, { has: boolean; values: Record<string, string> }>;
const emptyInsurance: InsForm = INS_CONFIG.reduce((acc, c) => {
  acc[c.key] = { has: false, values: {} };
  return acc;
}, {} as InsForm);

const EDU_STAGE_OPTIONS: { value: EduStage; label: string }[] = [
  { value: "學前", label: "學前(未就學)" },
  { value: "幼兒園", label: "幼兒園" },
  { value: "國小", label: "國小" },
  { value: "國中", label: "國中" },
  { value: "高中", label: "高中" },
  { value: "大專以上", label: "大專以上" },
  { value: "已完成", label: "已完成學業" },
];

const num = (s: string) => Number(s) || 0;

function insFormToDetail(ins: InsForm): InsuranceDetail {
  return {
    life: { has: ins.life.has, coverage: num(ins.life.values.coverage ?? "") },
    critical_illness: { has: ins.critical_illness.has, coverage: num(ins.critical_illness.values.coverage ?? "") },
    cancer_lump: { has: ins.cancer_lump.has, coverage: num(ins.cancer_lump.values.coverage ?? "") },
    accident: { has: ins.accident.has, coverage: num(ins.accident.values.coverage ?? "") },
    medical: { has: ins.medical.has, daily: num(ins.medical.values.daily ?? ""), reimburse_limit: num(ins.medical.values.reimburse_limit ?? "") },
    cancer_hospital: { has: ins.cancer_hospital.has, daily: num(ins.cancer_hospital.values.daily ?? "") },
    disability: { has: ins.disability.has, monthly: num(ins.disability.values.monthly ?? "") },
    long_term_care: { has: ins.long_term_care.has, monthly: num(ins.long_term_care.values.monthly ?? "") },
  };
}

interface Form {
  surname: string;
  honorific: Honorific;
  line_id: string;
  mobile: string;
  email: string;
  pdpa: boolean;
  age: string;
  retire_age: string;
  planning_scope: PlanningScope;
  spouse_age: string;
  children: { stage: EduStage; age: string; years_until_school: string }[];
  parentsCount: string;
  parentsAges: string[];
  siblings: { relation: string }[];
  grandchildrenCount: string;
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
  liabRate: string;
  liabYears: string;
  // 深化:退休後需求 / 緊急金 / 大額支出
  retireLifestylePct: string;
  retireMonthlyExpense: string;
  retirePensionMonthly: string;
  emergencyMonths: string;
  majorExpenseAmount: string;
  majorExpenseYears: string;
  // 深化:收入來源拆解(含被動收入,年/萬)
  incomeSources: { salary: string; bonus: string; rental: string; dividend: string; business: string; other: string };
  // 深化:現有保障明細(家戶:依成員 self / spouse / child0...)
  insByMember: Record<string, InsForm>;
  // 深化:子女高階教育規劃(每位子女一筆)
  eduGoals: { overseas: boolean; annual_edu_budget: string; annual_living_budget: string }[];
  // KYC 風險屬性
  kycExpYears: string;
  kycFamiliar: string[];
  kycLossReaction: LossReaction | "";
  kycInvestableRatio: string;
  kycInvestGoal: string;
  kycMaxLoss: string;
  kycExpectedReturn: string;
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
  planning_scope: "個人",
  spouse_age: "",
  children: [],
  parentsCount: "0",
  siblings: [],
  grandchildrenCount: "0",
  parentsAges: [],
  income_type: "固定薪",
  income_band: "",
  surplus_band: "",
  horizon: "",
  urgency: "",
  assets: emptyAssets,
  mortgageBalance: "",
  loanBalance: "",
  liabMonthly: "",
  liabRate: "",
  liabYears: "",
  retireLifestylePct: "70",
  retireMonthlyExpense: "",
  retirePensionMonthly: "",
  emergencyMonths: "",
  majorExpenseAmount: "",
  majorExpenseYears: "",
  incomeSources: { salary: "", bonus: "", rental: "", dividend: "", business: "", other: "" },
  insByMember: { self: emptyInsurance },
  eduGoals: [],
  kycExpYears: "",
  kycFamiliar: [],
  kycLossReaction: "",
  kycInvestableRatio: "",
  kycInvestGoal: "",
  kycMaxLoss: "",
  kycExpectedReturn: "",
};

const STEPS = ["個資同意", "基本 · 家庭", "收支 · 時間", "資產盤點", "負債 · 退休", "保障 · 教育", "風險屬性"];
const FAMILIAR_OPTIONS = ["存款", "保險", "股票", "基金/ETF", "債券", "外幣", "期貨/選擇權", "不動產"];
const LOSS_OPTIONS: LossReaction[] = ["加碼", "續抱", "部分贖回", "全部出場"];
const INVEST_GOALS = ["保本", "穩健", "增值", "積極"];

// 問卷填寫進度快取(重新整理 / 離開不丟資料)
const PROGRESS_KEY = "aa_assessment_progress";
function loadProgress(): { f: Form; step: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Assessment() {
  const router = useRouter();
  const [step, setStep] = useState(() => loadProgress()?.step ?? 0);
  const [f, setF] = useState<Form>(() => {
    const p = loadProgress();
    return p ? { ...initialForm, ...p.f } : initialForm;
  });

  // 自動存檔進度
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ f, step }));
    }
  }, [f, step]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  // 保險家戶成員(本人 / 配偶 / 各子女)
  const [insMember, setInsMember] = useState("self");
  const setIncome = (name: keyof Form["incomeSources"], v: string) =>
    setF((p) => ({ ...p, incomeSources: { ...p.incomeSources, [name]: v } }));
  const insMembers = [
    { id: "self", label: "本人" },
    ...(f.planning_scope === "含配偶" ? [{ id: "spouse", label: "配偶" }] : []),
    ...f.children.map((_, i) => ({ id: `child${i}`, label: `子女${i + 1}` })),
  ];
  const activeMember = insMembers.some((m) => m.id === insMember) ? insMember : "self";

  const setChildrenCount = (n: number) => {
    const count = Math.max(0, Math.min(10, n));
    setF((p) => {
      const children = [...p.children];
      children.length = count;
      for (let i = 0; i < count; i++) if (children[i] == null) children[i] = { stage: "國小", age: "", years_until_school: "" };
      const eduGoals = [...p.eduGoals];
      eduGoals.length = count;
      for (let i = 0; i < count; i++) if (eduGoals[i] == null) eduGoals[i] = { overseas: false, annual_edu_budget: "", annual_living_budget: "" };
      return { ...p, children, eduGoals };
    });
  };
  const setChild = (i: number, patch: Partial<{ stage: EduStage; age: string; years_until_school: string }>) =>
    setF((p) => {
      const children = [...p.children];
      children[i] = { ...children[i], ...patch };
      return { ...p, children };
    });

  const setParentsCount = (n: number) => {
    const count = Math.max(0, Math.min(4, n));
    setF((p) => {
      const ages = [...p.parentsAges];
      ages.length = count;
      for (let i = 0; i < count; i++) if (ages[i] == null) ages[i] = "";
      return { ...p, parentsCount: String(count), parentsAges: ages };
    });
  };
  const setParentAge = (i: number, v: string) =>
    setF((p) => {
      const ages = [...p.parentsAges];
      ages[i] = v;
      return { ...p, parentsAges: ages };
    });
  const setSiblingsCount = (n: number) =>
    setF((p) => {
      const count = Math.max(0, Math.min(12, n || 0));
      const siblings = [...p.siblings];
      siblings.length = count;
      for (let i = 0; i < count; i++) if (siblings[i] == null) siblings[i] = { relation: "弟" };
      return { ...p, siblings };
    });
  const setSiblingRelation = (i: number, relation: string) =>
    setF((p) => {
      const siblings = [...p.siblings];
      siblings[i] = { relation };
      return { ...p, siblings };
    });

  const setAsset = (key: keyof Assets, patch: Partial<{ has: boolean; amount: string }>) =>
    setF((p) => ({ ...p, assets: { ...p.assets, [key]: { ...p.assets[key], ...patch } } }));

  const memberIns = (m: string): InsForm => f.insByMember[m] ?? emptyInsurance;
  const setInsHas = (key: InsKey, has: boolean) =>
    setF((p) => {
      const cur = p.insByMember[activeMember] ?? emptyInsurance;
      return { ...p, insByMember: { ...p.insByMember, [activeMember]: { ...cur, [key]: { ...cur[key], has } } } };
    });
  const setInsValue = (key: InsKey, name: string, v: string) =>
    setF((p) => {
      const cur = p.insByMember[activeMember] ?? emptyInsurance;
      return { ...p, insByMember: { ...p.insByMember, [activeMember]: { ...cur, [key]: { ...cur[key], values: { ...cur[key].values, [name]: v } } } } };
    });

  const setEduGoal = (i: number, patch: Partial<{ overseas: boolean; annual_edu_budget: string; annual_living_budget: string }>) =>
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
        planning_scope: f.planning_scope,
        spouse_age: f.planning_scope === "含配偶" && f.spouse_age ? Number(f.spouse_age) : undefined,
        dependents: {
          children: f.children.map((c) => ({
            stage: c.stage,
            age: c.age ? Number(c.age) : undefined,
            years_until_school: c.stage === "學前" && c.years_until_school ? Number(c.years_until_school) : undefined,
          })),
          parents: {
            count: Number(f.parentsCount) || 0,
            ages: f.parentsAges.filter((a) => a !== "").map((a) => Number(a) || 0),
          },
          siblings: f.siblings.map((s) => ({ relation: (s.relation || "弟") as SiblingRelation })),
          grandchildren: { count: Number(f.grandchildrenCount) || 0 },
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
        retire_monthly_expense: f.retireMonthlyExpense ? Number(f.retireMonthlyExpense) : undefined,
        retire_pension_monthly: f.retirePensionMonthly ? Number(f.retirePensionMonthly) : undefined,
        liabilities: {
          mortgage_balance: Number(f.mortgageBalance) || 0,
          loan_balance: Number(f.loanBalance) || 0,
          monthly_payment: Number(f.liabMonthly) || 0,
          interest_rate: f.liabRate ? Number(f.liabRate) : undefined,
          remaining_years: f.liabYears ? Number(f.liabYears) : undefined,
        },
        emergency_months: f.emergencyMonths ? Number(f.emergencyMonths) : undefined,
        major_expense: f.majorExpenseAmount
          ? { amount: Number(f.majorExpenseAmount) || 0, years_until: 0 }
          : undefined,
        income_sources: (() => {
          const s = f.incomeSources;
          const vals = [s.salary, s.bonus, s.rental, s.dividend, s.business, s.other].map(num);
          return vals.some((v) => v > 0)
            ? { salary: vals[0], bonus: vals[1], rental: vals[2], dividend: vals[3], business: vals[4], other: vals[5] }
            : undefined;
        })(),
        insurance_detail: insFormToDetail(f.insByMember.self ?? emptyInsurance),
        spouse_insurance: f.planning_scope === "含配偶" && f.insByMember.spouse ? insFormToDetail(f.insByMember.spouse) : undefined,
        children_insurance: f.children.length > 0 ? f.children.map((_, i) => insFormToDetail(f.insByMember[`child${i}`] ?? emptyInsurance)) : undefined,
        edu_goals: f.children.map((_, i) => {
          const g = f.eduGoals[i] ?? { overseas: false, annual_edu_budget: "", annual_living_budget: "" };
          return {
            overseas: g.overseas,
            annual_edu_budget: num(g.annual_edu_budget),
            annual_living_budget: num(g.annual_living_budget),
          };
        }),
      },
      kyc: {
        exp_years: f.kycExpYears ? Number(f.kycExpYears) : undefined,
        familiar_products: f.kycFamiliar.length ? f.kycFamiliar : undefined,
        loss_reaction: f.kycLossReaction || undefined,
        investable_ratio: f.kycInvestableRatio ? Number(f.kycInvestableRatio) : undefined,
        invest_goal: f.kycInvestGoal || undefined,
        max_loss_tolerance: f.kycMaxLoss ? Number(f.kycMaxLoss) : undefined,
        expected_return: f.kycExpectedReturn ? Number(f.kycExpectedReturn) : undefined,
      },
    };
    saveDraft(data);
    if (typeof window !== "undefined") window.localStorage.removeItem(PROGRESS_KEY);
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
              <Field label="姓氏" required className="col-span-2">
                <Input value={f.surname} onChange={(v) => set("surname", v)} placeholder="王" />
              </Field>
              <Field label="稱謂">
                <Select value={f.honorific} onChange={(v) => set("honorific", v as Honorific)} options={HONORIFIC_OPTIONS.map((h) => ({ value: h, label: h }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="目前年齡" required>
                <Input value={f.age} onChange={(v) => set("age", v)} type="number" placeholder="40" />
              </Field>
              <Field label="預計退休年齡" required>
                <Input value={f.retire_age} onChange={(v) => set("retire_age", v)} type="number" placeholder="65" />
              </Field>
            </div>
            {/* 規劃範圍 */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="規劃範圍">
                <Select value={f.planning_scope} onChange={(v) => set("planning_scope", v as PlanningScope)} options={[{ value: "個人", label: "個人規劃" }, { value: "含配偶", label: "含配偶(家庭)" }]} />
              </Field>
              {f.planning_scope === "含配偶" && (
                <Field label="配偶年齡">
                  <Input value={f.spouse_age} onChange={(v) => set("spouse_age", v)} type="number" placeholder="38" />
                </Field>
              )}
            </div>

            {/* 子女 + 就學身份 */}
            <Field label="子女人數">
              <Input value={String(f.children.length)} onChange={(v) => setChildrenCount(Number(v))} type="number" placeholder="0" />
            </Field>
            {f.children.length > 0 && (
              <div className="space-y-2">
                {f.children.map((c, i) => (
                  <div key={i} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                    <div className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">第 {i + 1} 位子女</div>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="就學身份" className="col-span-2">
                        <Select value={c.stage} onChange={(v) => setChild(i, { stage: v as EduStage })} options={EDU_STAGE_OPTIONS} />
                      </Field>
                      <Field label="年齡">
                        <Input value={c.age} onChange={(v) => setChild(i, { age: v })} type="number" placeholder="8" />
                      </Field>
                    </div>
                    {c.stage === "學前" && (
                      <div className="mt-2">
                        <Field label="預計幾年後就學">
                          <Input value={c.years_until_school} onChange={(v) => setChild(i, { years_until_school: v })} type="number" placeholder="3" />
                        </Field>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 扶養父母 */}
            <Field label="扶養父母人數">
              <Input value={f.parentsCount} onChange={(v) => setParentsCount(Number(v))} type="number" placeholder="0" />
            </Field>
            {f.parentsAges.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {f.parentsAges.map((age, i) => (
                  <Field key={i} label={`父母 ${i + 1} 年齡`}>
                    <Input value={age} onChange={(v) => setParentAge(i, v)} type="number" placeholder="70" />
                  </Field>
                ))}
              </div>
            )}

            {/* 遺產繼承順位相關成員 */}
            <div>
              <span className="text-sm font-medium">其他家庭成員(遺產規劃用)</span>
              <p className="text-xs text-neutral-400">影響遺產繼承順位與傳承規劃。兄弟姊妹請逐位註明關係。</p>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <Field label="兄弟姊妹人數">
                  <Input value={String(f.siblings.length)} onChange={(v) => setSiblingsCount(Number(v))} type="number" placeholder="0" />
                </Field>
                <Field label="孫子女人數">
                  <Input value={f.grandchildrenCount} onChange={(v) => set("grandchildrenCount", v)} type="number" placeholder="0" />
                </Field>
              </div>
              {f.siblings.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {f.siblings.map((s, i) => (
                    <Field key={i} label={`第 ${i + 1} 位`}>
                      <Select
                        value={s.relation}
                        onChange={(v) => setSiblingRelation(i, v)}
                        options={[
                          { value: "兄", label: "兄(哥哥)" },
                          { value: "弟", label: "弟(弟弟)" },
                          { value: "姊", label: "姊(姊姊)" },
                          { value: "妹", label: "妹(妹妹)" },
                        ]}
                      />
                    </Field>
                  ))}
                </div>
              )}
            </div>

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
            <Field label="家庭年收入(稅前)" required>
              <Select value={f.income_band} onChange={(v) => set("income_band", v as IncomeBand)} options={INCOME_BAND_OPTIONS} placeholder="請選擇" />
            </Field>
            <Field label="每月結餘(收入減支出)" required>
              <Select value={f.surplus_band} onChange={(v) => set("surplus_band", v as SurplusBand)} options={SURPLUS_BAND_OPTIONS} placeholder="請選擇" />
            </Field>
            <Field label="這筆資金多久內用不到" required>
              <Select value={f.horizon} onChange={(v) => set("horizon", v as Horizon)} options={HORIZON_OPTIONS} placeholder="請選擇" />
            </Field>
            <Field label="規劃急迫性" required>
              <Select value={f.urgency} onChange={(v) => set("urgency", v as Urgency)} options={URGENCY_OPTIONS} placeholder="請選擇" />
            </Field>

            {/* 收入來源拆解(含被動收入)— 選填深化 */}
            <div>
              <span className="text-sm font-medium">收入來源拆解(選填,年/萬)</span>
              <p className="text-xs text-neutral-400">拆出主動與被動收入,利於現金流與退休試算。</p>
              <div className="mt-1.5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="薪資"><Input value={f.incomeSources.salary} onChange={(v) => setIncome("salary", v)} type="number" placeholder="0" /></Field>
                <Field label="獎金/佣金"><Input value={f.incomeSources.bonus} onChange={(v) => setIncome("bonus", v)} type="number" placeholder="0" /></Field>
                <Field label="租金(被動)"><Input value={f.incomeSources.rental} onChange={(v) => setIncome("rental", v)} type="number" placeholder="0" /></Field>
                <Field label="股利/利息(被動)"><Input value={f.incomeSources.dividend} onChange={(v) => setIncome("dividend", v)} type="number" placeholder="0" /></Field>
                <Field label="事業盈餘"><Input value={f.incomeSources.business} onChange={(v) => setIncome("business", v)} type="number" placeholder="0" /></Field>
                <Field label="其他"><Input value={f.incomeSources.other} onChange={(v) => setIncome("other", v)} type="number" placeholder="0" /></Field>
              </div>
            </div>
          </Section>
        )}

        {step === 3 && (
          <Section title="資產快速盤點">
            <DeepHint />
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
            <DeepHint />
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
            <div className="grid grid-cols-3 gap-3">
              <Field label="每月還款(萬)">
                <Input value={f.liabMonthly} onChange={(v) => set("liabMonthly", v)} type="number" placeholder="0" />
              </Field>
              <Field label="平均利率(%)">
                <Input value={f.liabRate} onChange={(v) => set("liabRate", v)} type="number" placeholder="選填" />
              </Field>
              <Field label="剩餘年限">
                <Input value={f.liabYears} onChange={(v) => set("liabYears", v)} type="number" placeholder="選填" />
              </Field>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
              <span className="text-sm font-medium">退休後需求</span>
              <div className="mt-1.5 grid grid-cols-3 gap-3">
                <Field label="所得替代率(%)">
                  <Input value={f.retireLifestylePct} onChange={(v) => set("retireLifestylePct", v)} type="number" placeholder="70" />
                </Field>
                <Field label="退休後每月支出(萬)">
                  <Input value={f.retireMonthlyExpense} onChange={(v) => set("retireMonthlyExpense", v)} type="number" placeholder="選填,優先" />
                </Field>
                <Field label="退休金月領(萬)">
                  <Input value={f.retirePensionMonthly} onChange={(v) => set("retirePensionMonthly", v)} type="number" placeholder="勞退/月退" />
                </Field>
              </div>
              <p className="mt-1 text-xs text-neutral-400">有填「每月支出」則以此為準;「退休金月領」會抵減退休需求。</p>
            </div>
            <Field label="緊急預備金(幾個月生活費)">
              <Input value={f.emergencyMonths} onChange={(v) => set("emergencyMonths", v)} type="number" placeholder="6" />
            </Field>
            <div>
              <span className="text-sm font-medium">近期大額支出計畫(選填)</span>
              <p className="text-xs text-neutral-400">如購屋、換車、進修等一次性大筆支出。</p>
              <div className="mt-1.5">
                <Field label="預計發生金額(萬)">
                  <Input value={f.majorExpenseAmount} onChange={(v) => set("majorExpenseAmount", v)} type="number" placeholder="例如 300" />
                </Field>
              </div>
            </div>
          </Section>
        )}

        {step === 5 && (
          <Section title="現有保障 · 教育金">
            <DeepHint />
            <p className="-mt-2 mb-1 text-sm text-neutral-500 dark:text-neutral-400">
              勾選<strong>各家庭成員</strong>已有的保障並填入金額(家戶保障計算)。各險種單位不同。
            </p>
            {/* 家戶成員分頁 */}
            {insMembers.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {insMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setInsMember(m.id)}
                    className={`rounded-full px-3 py-1 text-sm ${activeMember === m.id ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {INS_CONFIG.map((c) => {
                const v = memberIns(activeMember)[c.key];
                return (
                  <div key={c.key} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={v.has} onChange={(e) => setInsHas(c.key, e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                      <span className="flex-1 text-sm font-medium">{c.label}</span>
                    </label>
                    {v.has && (
                      <div className="mt-2 flex flex-wrap gap-3 pl-7">
                        {c.fields.map((fld) => (
                          <span key={fld.name} className="flex items-center gap-1.5">
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">{fld.label}</span>
                            <input
                              type="number"
                              value={v.values[fld.name] ?? ""}
                              onChange={(e) => setInsValue(c.key, fld.name, e.target.value)}
                              className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 text-right text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900"
                            />
                            <span className="text-xs text-neutral-400">{fld.unit}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {f.children.length > 0 && (
              <div className="mt-4">
                <span className="text-sm font-medium">子女高階教育規劃</span>
                <p className="text-xs text-neutral-400">就學時程由第一頁子女年齡自動推算;此處填大專以上的規劃與預算。</p>
                <div className="mt-2 space-y-2">
                  {f.children.map((_, i) => {
                    const g = f.eduGoals[i] ?? { overseas: false, annual_edu_budget: "", annual_living_budget: "" };
                    return (
                      <div key={i} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">第 {i + 1} 位子女</span>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={g.overseas} onChange={(e) => setEduGoal(i, { overseas: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                            出國深造規劃
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="每年教育預算(萬)">
                            <Input value={g.annual_edu_budget} onChange={(v) => setEduGoal(i, { annual_edu_budget: v })} type="number" placeholder="30" />
                          </Field>
                          <Field label="每年生活預算(萬)">
                            <Input value={g.annual_living_budget} onChange={(v) => setEduGoal(i, { annual_living_budget: v })} type="number" placeholder="20" />
                          </Field>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Section>
        )}

        {step === 6 && (
          <Section title="風險屬性(KYC)">
            <DeepHint />
            <p className="-mt-2 mb-1 text-sm text-neutral-500 dark:text-neutral-400">
              以行為題了解你的風險承受度,協助顧問做合適的規劃。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="投資經驗(年)">
                <Input value={f.kycExpYears} onChange={(v) => set("kycExpYears", v)} type="number" placeholder="選填" />
              </Field>
              <Field label="可投資金額占總資產(%)">
                <Input value={f.kycInvestableRatio} onChange={(v) => set("kycInvestableRatio", v)} type="number" placeholder="選填" />
              </Field>
            </div>
            <div>
              <span className="text-sm font-medium">熟悉的商品(可複選)</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {FAMILIAR_OPTIONS.map((p) => {
                  const on = f.kycFamiliar.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => set("kycFamiliar", on ? f.kycFamiliar.filter((x) => x !== p) : [...f.kycFamiliar, p])}
                      className={`rounded-full px-3 py-1 text-sm ${on ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span className="text-sm font-medium">若這筆錢一年內帳面虧 20%,你會:</span>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {LOSS_OPTIONS.map((o) => (
                  <button
                    key={o}
                    onClick={() => set("kycLossReaction", o)}
                    className={`rounded-lg border px-3 py-2 text-sm ${f.kycLossReaction === o ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-neutral-200 dark:border-neutral-800"}`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <Field label="主要投資目標">
              <Select value={f.kycInvestGoal} onChange={(v) => set("kycInvestGoal", v)} options={INVEST_GOALS.map((g) => ({ value: g, label: g }))} placeholder="請選擇" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="可承受最大帳面虧損(%)">
                <Input value={f.kycMaxLoss} onChange={(v) => set("kycMaxLoss", v)} type="number" placeholder="選填" />
              </Field>
              <Field label="期望年報酬(%)">
                <Input value={f.kycExpectedReturn} onChange={(v) => set("kycExpectedReturn", v)} type="number" placeholder="選填" />
              </Field>
            </div>
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

function Field({ label, children, className = "", required = false }: { label: string; children: React.ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

// 深化步驟頂部的紅字附註
function DeepHint() {
  return (
    <p className="-mt-1 mb-1 text-xs text-red-500">建議填寫,可提供更精準的分析與建議。</p>
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
