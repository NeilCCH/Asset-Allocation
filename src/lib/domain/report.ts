// 健檢報告資料模型 — §8 單一來源。由問卷資料 + 可調參數組出報告所需的一切數字。
// 客戶版與顧問版共用此模型;顧問版可額外帶入建議與勾選的配置面向。
import type { QuestionnaireData } from "./types";
import { CalcParams, DEFAULT_PARAMS } from "./params";
import {
  assetBreakdown,
  computeGaps,
  investableAssets,
  liquidAssets,
  protectionVsInvestment,
  sumAssets,
  type GapResult,
} from "./calc";

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
  /** 現有保障總覽(保單健檢) */
  insurance: { label: string; has: boolean; text: string }[];
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
    insurance: insuranceRows(data),
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

/** 現有保障總覽(各險種單位不同) */
function insuranceRows(data: QuestionnaireData): { label: string; has: boolean; text: string }[] {
  const ins = data.deep?.insurance_detail;
  if (!ins) return [];
  return [
    { label: "壽險", has: ins.life.has, text: `保額 ${ins.life.coverage} 萬` },
    { label: "重大疾病", has: ins.critical_illness.has, text: `一次金 ${ins.critical_illness.coverage} 萬` },
    { label: "意外", has: ins.accident.has, text: `保額 ${ins.accident.coverage} 萬` },
    { label: "醫療", has: ins.medical.has, text: `日額 ${ins.medical.daily} 元 · 實支 ${ins.medical.reimburse_limit} 萬` },
    { label: "失能", has: ins.disability.has, text: `每月 ${ins.disability.monthly} 萬` },
    { label: "長照", has: ins.long_term_care.has, text: `每月 ${ins.long_term_care.monthly} 萬` },
  ];
}

export function fmtWan(wan: number): string {
  const v = Math.round(wan);
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)} 億`;
  return `${v.toLocaleString("zh-TW")} 萬`;
}
