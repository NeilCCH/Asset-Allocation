// 健檢報告資料模型 — §8 單一來源。由問卷資料 + 可調參數組出報告所需的一切數字。
// 客戶版與顧問版共用此模型;顧問版可額外帶入建議與勾選的配置面向。
import type { QuestionnaireData, InsuranceDetail } from "./types";
import { CalcParams, DEFAULT_PARAMS } from "./params";
import {
  assetBreakdown,
  computeGaps,
  gapSolutions,
  investableAssets,
  liquidAssets,
  protectionVsInvestment,
  sumAssets,
  type GapResult,
  type GapSolution,
} from "./calc";
import { estimateEstateTax, type EstateTaxResult } from "./estateTax";
import { personalStatements, type PersonalStatements } from "./statements";

export interface FamilyModel {
  self: { label: string; age: number };
  selfIsFemale: boolean;
  spouseAge?: number;
  parents: { count: number; ages: number[] };
  siblings: { relation: string; isFemale: boolean }[];
  children: { stage: string; age?: number }[];
  grandchildren: number;
}

export interface ReportModel {
  clientName: string;
  generatedAt: string;
  params: CalcParams;
  summary: {
    total: number;
    liquid: number;
    liquidPct: number;
    investable: number;
    protection: number;
    investment: number;
    protectionPct: number;
  };
  assets: { label: string; category: string; amount: number; pct: number }[];
  gaps: { name: string; result: GapResult }[];
  /** 現有保障總覽(保單健檢,本人) */
  insurance: { label: string; has: boolean; text: string }[];
  /** 家戶保障總覽(本人 + 配偶 + 子女) */
  householdInsurance: { member: string; rows: { label: string; has: boolean; text: string }[] }[];
  /** 遺產稅預估(僅達課稅標準時有值) */
  estateTax?: EstateTaxResult;
  /** 家系關係圖資料 */
  family: FamilyModel;
  /** 缺口補足建議(解決方向) */
  solutions: GapSolution[];
  /** 家庭財務報表(資產負債 / 損益 / 現金流) */
  statements: PersonalStatements;
  profile: {
    age: number;
    retireAge: number;
    childrenCount: number;
    incomeType: string;
  };
  /** 顧問版:對客戶的規劃建議(由具資格顧問撰寫) */
  advisorRecommendation?: string;
  /** 顧問版:勾選的配置面向(類別層級) */
  selectedDimensions?: { title: string; desc: string }[];
  /** 落款:產出建議的顧問與其資格 */
  advisorSignature?: { name: string; licenses: string[] };
}

export function buildReport(
  data: QuestionnaireData,
  opts?: {
    params?: CalcParams;
    advisorRecommendation?: string;
    selectedDimensions?: { title: string; desc: string }[];
    advisorSignature?: { name: string; licenses: string[] };
  },
): ReportModel {
  const params = opts?.params ?? DEFAULT_PARAMS;
  const total = sumAssets(data.core.assets);
  const liquid = liquidAssets(data.core.assets);
  const investable = investableAssets(data.core.assets);
  const pvi = protectionVsInvestment(data.core.assets);
  const pviTotal = pvi.protection + pvi.investment;
  const gaps = computeGaps(data, params);

  return {
    clientName: `${data.basic.surname}${data.basic.honorific}`,
    generatedAt: new Date().toISOString().slice(0, 10),
    params,
    summary: {
      total,
      liquid,
      liquidPct: total > 0 ? Math.round((liquid / total) * 100) : 0,
      investable,
      protection: pvi.protection,
      investment: pvi.investment,
      protectionPct: pviTotal > 0 ? Math.round((pvi.protection / pviTotal) * 100) : 0,
    },
    assets: assetBreakdown(data.core.assets)
      .filter((a) => a.amount > 0)
      .map((a) => ({
        label: a.label,
        category: a.category,
        amount: a.amount,
        pct: total > 0 ? Math.round((a.amount / total) * 100) : 0,
      })),
    gaps: [
      { name: "退休金缺口", result: gaps.retirement },
      { name: "保障缺口", result: gaps.protection },
      { name: "教育金缺口", result: gaps.education },
    ],
    insurance: insRowsOf(data.deep?.insurance_detail),
    householdInsurance: [
      { member: "本人", rows: insRowsOf(data.deep?.insurance_detail) },
      ...(data.deep?.spouse_insurance ? [{ member: "配偶", rows: insRowsOf(data.deep.spouse_insurance) }] : []),
      ...(data.deep?.children_insurance ?? []).map((c, i) => ({ member: `子女${i + 1}`, rows: insRowsOf(c) })),
    ],
    estateTax: (() => {
      const e = estimateEstateTax(data);
      return e.taxable ? e : undefined;
    })(),
    family: {
      self: { label: `本人(${data.basic.honorific}）`, age: data.core.age },
      selfIsFemale: data.basic.honorific === "女士",
      spouseAge: data.core.planning_scope === "含配偶" ? data.core.spouse_age : undefined,
      parents: data.core.dependents.parents,
      siblings: (data.core.dependents.siblings ?? []).map((s) => ({ relation: s.relation, isFemale: s.relation === "姊" || s.relation === "妹" })),
      children: data.core.dependents.children.map((c) => ({ stage: c.stage, age: c.age })),
      grandchildren: data.core.dependents.grandchildren?.count ?? 0,
    },
    solutions: gapSolutions(data, params),
    statements: personalStatements(data),
    profile: {
      age: data.core.age,
      retireAge: data.core.retire_age,
      childrenCount: data.core.dependents.children.length,
      incomeType: data.core.income_type,
    },
    advisorRecommendation: opts?.advisorRecommendation,
    selectedDimensions: opts?.selectedDimensions,
    advisorSignature: opts?.advisorSignature,
  };
}

/** 單一成員保障列(各險種單位不同) */
function insRowsOf(ins: InsuranceDetail | undefined): { label: string; has: boolean; text: string }[] {
  if (!ins) return [];
  return [
    { label: "壽險", has: ins.life.has, text: `保額 ${ins.life.coverage} 萬` },
    { label: "重大疾病", has: ins.critical_illness.has, text: `一次金 ${ins.critical_illness.coverage} 萬` },
    { label: "癌症(單筆)", has: ins.cancer_lump.has, text: `一次金 ${ins.cancer_lump.coverage} 萬` },
    { label: "意外", has: ins.accident.has, text: `保額 ${ins.accident.coverage} 萬` },
    { label: "醫療", has: ins.medical.has, text: `日額 ${ins.medical.daily} 元 · 實支 ${ins.medical.reimburse_limit} 萬` },
    { label: "癌症住院", has: ins.cancer_hospital.has, text: `日額 ${ins.cancer_hospital.daily} 元` },
    { label: "失能", has: ins.disability.has, text: `每月 ${ins.disability.monthly} 萬` },
    { label: "長照", has: ins.long_term_care.has, text: `每月 ${ins.long_term_care.monthly} 萬` },
  ];
}

export function fmtWan(wan: number): string {
  const v = Math.round(wan);
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)} 億`;
  return `${v.toLocaleString("zh-TW")} 萬`;
}
