// 缺口試算引擎 — PRD §7。純函式、規則式、可調參數,輸出屬客觀試算,不含投資意見。
// 所有金額單位:萬元 TWD。

import type { Assets, QuestionnaireData } from "./types";
import {
  CalcParams,
  DEFAULT_PARAMS,
  INCOME_BAND_VALUE,
  SURPLUS_BAND_VALUE,
} from "./params";

// ── 資產彙整(現況全貌圖來源) ─────────────────────────

export interface AssetBreakdown {
  label: string;
  key: keyof Assets;
  amount: number;
  category: "流動" | "投資" | "保障" | "不動產" | "其他";
}

const ASSET_META: Record<
  keyof Assets,
  { label: string; category: AssetBreakdown["category"]; liquid: boolean; investable: boolean }
> = {
  cash: { label: "現金存款", category: "流動", liquid: true, investable: true },
  stock_tw: { label: "台股", category: "投資", liquid: true, investable: true },
  stock_overseas: { label: "海外股票", category: "投資", liquid: true, investable: true },
  fund_etf: { label: "基金/ETF", category: "投資", liquid: true, investable: true },
  insurance_protection: { label: "保單(保障型)", category: "保障", liquid: false, investable: false },
  insurance_savings: { label: "保單(儲蓄/投資型)", category: "投資", liquid: false, investable: true },
  real_estate_own: { label: "不動產(自住)", category: "不動產", liquid: false, investable: false },
  real_estate_invest: { label: "不動產(投資)", category: "不動產", liquid: false, investable: false },
  other: { label: "其他(外幣/黃金/加密等)", category: "其他", liquid: true, investable: true },
};

export function assetBreakdown(assets: Assets): AssetBreakdown[] {
  return (Object.keys(ASSET_META) as (keyof Assets)[]).map((key) => ({
    key,
    label: ASSET_META[key].label,
    amount: assets[key].has ? Math.max(0, assets[key].amount) : 0,
    category: ASSET_META[key].category,
  }));
}

export function sumAssets(assets: Assets): number {
  return assetBreakdown(assets).reduce((s, a) => s + a.amount, 0);
}

function sumBy(assets: Assets, pick: (m: (typeof ASSET_META)[keyof Assets]) => boolean): number {
  return (Object.keys(ASSET_META) as (keyof Assets)[]).reduce(
    (s, key) => s + (pick(ASSET_META[key]) && assets[key].has ? Math.max(0, assets[key].amount) : 0),
    0,
  );
}

export const liquidAssets = (assets: Assets) => sumBy(assets, (m) => m.liquid);
export const investableAssets = (assets: Assets) => sumBy(assets, (m) => m.investable);

/** 保障型資產(壽險保障) vs 投資型資產 的比重 — 本工具差異化指標 */
export function protectionVsInvestment(assets: Assets) {
  const protection = sumBy(assets, (m) => m.category === "保障");
  const investment = sumBy(assets, (m) => m.category === "投資");
  return { protection, investment };
}

// ── 通用金融函式 ─────────────────────────────────────

const grow = (pv: number, rate: number, years: number) => pv * Math.pow(1 + rate, years);

/** 期末年金終值:每年投入 pmt,rate 報酬,years 年 */
function fvAnnuity(pmt: number, rate: number, years: number): number {
  if (years <= 0) return 0;
  if (rate === 0) return pmt * years;
  return pmt * ((Math.pow(1 + rate, years) - 1) / rate);
}

/** 目前年支出估計 = 年收入 − 年結餘(透明推導,無另問開銷) */
function estimateAnnualExpense(data: QuestionnaireData): number {
  const annualIncome = INCOME_BAND_VALUE[data.core.income_band] ?? 0;
  const monthlySurplus = SURPLUS_BAND_VALUE[data.core.surplus_band] ?? 0;
  const annualSurplus = monthlySurplus * 12;
  return Math.max(0, annualIncome - annualSurplus);
}

// ── 缺口結果型別 ─────────────────────────────────────

export type GapStatus = "computed" | "needs_deep_data";

export interface GapResult {
  status: GapStatus;
  /** 缺口金額(萬元)。正值 = 短缺、需補足;負值/0 = 已足夠 */
  gap: number;
  breakdown: { label: string; amount: number }[];
  /** 缺哪些深化題才能算(status = needs_deep_data 時填) */
  missing?: string[];
}

// ── ① 退休金缺口(基本層即可試算) ───────────────────

export function retirementGap(
  data: QuestionnaireData,
  params: CalcParams = DEFAULT_PARAMS,
): GapResult {
  const { core } = data;
  const yearsToRetire = Math.max(0, core.retire_age - core.age);
  const retireYears = Math.max(0, params.lifeExpectancy - core.retire_age);

  const lifestylePct =
    (data.deep?.retire_lifestyle_pct ?? params.defaultRetireLifestylePct) / 100;
  const annualExpenseNow = estimateAnnualExpense(data);

  // 退休當年的年支出需求(以通膨推估至退休時點)
  const annualNeedAtRetire =
    annualExpenseNow * lifestylePct * Math.pow(1 + params.inflationRate, yearsToRetire);
  const totalNeed = annualNeedAtRetire * retireYears;

  // 退休時可累積資產 = 現有可投資資產成長 + 未來持續投入終值
  const grownCurrent = grow(investableAssets(core.assets), params.returnRate, yearsToRetire);
  const annualContribution = Math.max(0, (SURPLUS_BAND_VALUE[core.surplus_band] ?? 0) * 12);
  const contributions = fvAnnuity(annualContribution, params.returnRate, yearsToRetire);
  const accumulable = grownCurrent + contributions;

  const gap = round(totalNeed - accumulable);
  return {
    status: "computed",
    gap,
    breakdown: [
      { label: "退休後總支出需求", amount: round(totalNeed) },
      { label: "現有資產成長估計", amount: round(grownCurrent) },
      { label: "未來持續投入估計", amount: round(contributions) },
    ],
  };
}

// ── ② 保障缺口(需深化資料:負債、壽險保額) ──────────

export function protectionGap(
  data: QuestionnaireData,
  params: CalcParams = DEFAULT_PARAMS,
): GapResult {
  const missing: string[] = [];
  if (!data.deep?.liabilities) missing.push("負債明細");
  if (!data.deep?.insurance_detail) missing.push("現有保障明細(壽險保額)");
  if (missing.length > 0) {
    return { status: "needs_deep_data", gap: 0, breakdown: [], missing };
  }

  const { core, deep } = data;
  const liabilities = deep!.liabilities!;
  const unpaidLiabilities =
    liabilities.mortgage_balance + liabilities.loan_balance;

  // 扶養支出現值
  const perChildYears = core.dependents.children.ages.reduce(
    (s, age) => s + Math.max(0, params.childIndependentAge - age),
    0,
  );
  const childSupport = perChildYears * params.dependentSupportAnnual;
  const parentSupport = core.dependents.support_parents ? params.parentSupportTotal : 0;

  // 子女教育金(取教育缺口的總需求)
  const eduNeed = educationTotalNeed(data, params);

  const lifeCoverage = deep!.insurance_detail!.life.coverage;
  const liquid = liquidAssets(core.assets);

  const need = unpaidLiabilities + childSupport + parentSupport + eduNeed;
  const haveNow = lifeCoverage + liquid;
  const gap = round(need - haveNow);

  return {
    status: "computed",
    gap,
    breakdown: [
      { label: "未償負債", amount: round(unpaidLiabilities) },
      { label: "扶養支出", amount: round(childSupport + parentSupport) },
      { label: "子女教育金", amount: round(eduNeed) },
      { label: "現有壽險保額", amount: -round(lifeCoverage) },
      { label: "流動資產", amount: -round(liquid) },
    ],
  };
}

// ── ③ 教育金缺口(需深化資料:edu_goal) ─────────────

/** 子女教育總花費現值(不扣已準備),供保障缺口引用 */
function educationTotalNeed(data: QuestionnaireData, params: CalcParams): number {
  const goals = data.deep?.edu_goals ?? [];
  return goals.reduce((sum, g) => {
    const base = g.location === "海外" ? params.eduCostOverseas : params.eduCostDomestic;
    // 折現至現值:未來花費以報酬率貼現
    const pv = base / Math.pow(1 + params.returnRate, Math.max(0, g.years_until));
    return sum + pv;
  }, 0);
}

export function educationGap(
  data: QuestionnaireData,
  params: CalcParams = DEFAULT_PARAMS,
): GapResult {
  if (!data.deep?.edu_goals || data.deep.edu_goals.length === 0) {
    const hasChildren = data.core.dependents.children.count > 0;
    return {
      status: "needs_deep_data",
      gap: 0,
      breakdown: [],
      missing: hasChildren ? ["子女教育金目標(幾年後、國內/海外)"] : ["(無子女,不適用)"],
    };
  }
  const need = educationTotalNeed(data, params);
  const gap = round(need); // 已準備金額目前無對應欄位,預設 0
  return {
    status: "computed",
    gap,
    breakdown: [{ label: "子女教育總花費(現值)", amount: round(need) }],
  };
}

// ── 一次算出全部缺口 ─────────────────────────────────

export interface GapSummary {
  retirement: GapResult;
  protection: GapResult;
  education: GapResult;
}

export function computeGaps(
  data: QuestionnaireData,
  params: CalcParams = DEFAULT_PARAMS,
): GapSummary {
  return {
    retirement: retirementGap(data, params),
    protection: protectionGap(data, params),
    education: educationGap(data, params),
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
