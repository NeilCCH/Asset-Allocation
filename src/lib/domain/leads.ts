// 有效客戶評分 — PRD §5。⚠️ 顧問專屬:此模組輸出「絕不」送往客戶端。
// 原則:入口零門檻、背景評分、顧問端分級跟進。評分因子皆取自既有問卷。

import type { QuestionnaireData } from "./types";
import { INCOME_BAND_VALUE, SURPLUS_BAND_VALUE } from "./params";
import { sumAssets, investableAssets } from "./calc";

export type LeadGrade = "A" | "B" | "C";

export interface LeadScore {
  grade: LeadGrade;
  total: number; // 0-100
  factors: {
    assetScale: number; // 資產規模
    cashFlow: number; // 現金流健康度
    needClarity: number; // 需求明確度
    urgency: number; // 急迫性
    engagement: number; // 互動意願
  };
}

// 各因子權重(合計 100)
const WEIGHTS = {
  assetScale: 30,
  cashFlow: 20,
  needClarity: 20,
  urgency: 20,
  engagement: 10,
} as const;

const URGENCY_SCORE: Record<string, number> = {
  "3個月內": 1,
  "半年內": 0.7,
  "一年內": 0.4,
  "先看看": 0.15,
};

/** 資產規模分:可投入資金 + 總資產級距(萬元) */
function assetScaleScore(data: QuestionnaireData): number {
  const total = sumAssets(data.core.assets);
  const investable = investableAssets(data.core.assets);
  // 以 1500 萬總資產 / 500 萬可投入 為滿分基準(對數式趨緩)
  const totalScore = Math.min(1, Math.log10(1 + total) / Math.log10(1 + 1500));
  const investScore = Math.min(1, Math.log10(1 + investable) / Math.log10(1 + 500));
  return 0.5 * totalScore + 0.5 * investScore;
}

/** 現金流健康度:月結餘 / 月收入 */
function cashFlowScore(data: QuestionnaireData): number {
  const monthlyIncome = (INCOME_BAND_VALUE[data.core.income_band] ?? 0) / 12;
  const monthlySurplus = SURPLUS_BAND_VALUE[data.core.surplus_band] ?? 0;
  if (monthlySurplus <= 0) return 0; // 赤字
  if (monthlyIncome <= 0) return 0.3;
  const ratio = monthlySurplus / monthlyIncome;
  return Math.min(1, ratio / 0.4); // 結餘率 40% 視為滿分
}

/** 需求明確度:是否勾選具體目標 / 缺口(來自深化題) */
function needClarityScore(data: QuestionnaireData): number {
  let hits = 0;
  const d = data.deep;
  if (d?.retire_lifestyle_pct != null) hits++;
  if (d?.edu_goals && d.edu_goals.length > 0) hits++;
  if (d?.major_expense) hits++;
  if (d?.insurance_detail) hits++;
  if (d?.emergency_months != null) hits++;
  return Math.min(1, hits / 3); // 勾到 3 項以上即滿分
}

/** 互動意願:問卷完成度 + 聯絡方式完整度 */
function engagementScore(data: QuestionnaireData): number {
  const contacts = [data.basic.line_id, data.basic.mobile, data.basic.email].filter(Boolean).length;
  const contactScore = Math.min(1, contacts / 2);
  let completion = 0.34; // 完成核心
  if (data.deep && Object.keys(data.deep).length > 0) completion += 0.33;
  if (data.kyc && Object.keys(data.kyc).length > 0) completion += 0.33;
  return 0.5 * contactScore + 0.5 * Math.min(1, completion);
}

export function scoreLead(data: QuestionnaireData): LeadScore {
  const factors = {
    assetScale: assetScaleScore(data),
    cashFlow: cashFlowScore(data),
    needClarity: needClarityScore(data),
    urgency: URGENCY_SCORE[data.core.urgency] ?? 0.2,
    engagement: engagementScore(data),
  };

  const total = Math.round(
    factors.assetScale * WEIGHTS.assetScale +
      factors.cashFlow * WEIGHTS.cashFlow +
      factors.needClarity * WEIGHTS.needClarity +
      factors.urgency * WEIGHTS.urgency +
      factors.engagement * WEIGHTS.engagement,
  );

  const grade: LeadGrade = total >= 70 ? "A" : total >= 45 ? "B" : "C";

  return {
    grade,
    total,
    factors: {
      assetScale: Math.round(factors.assetScale * WEIGHTS.assetScale),
      cashFlow: Math.round(factors.cashFlow * WEIGHTS.cashFlow),
      needClarity: Math.round(factors.needClarity * WEIGHTS.needClarity),
      urgency: Math.round(factors.urgency * WEIGHTS.urgency),
      engagement: Math.round(factors.engagement * WEIGHTS.engagement),
    },
  };
}
