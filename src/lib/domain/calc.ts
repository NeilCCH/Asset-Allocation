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

  // 退休當年的年支出需求:優先用「退休後每月支出」;否則以目前開銷 × 生活水準%
  const lifestylePct =
    (data.deep?.retire_lifestyle_pct ?? params.defaultRetireLifestylePct) / 100;
  const annualNeedNow =
    data.deep?.retire_monthly_expense != null
      ? data.deep.retire_monthly_expense * 12
      : estimateAnnualExpense(data) * lifestylePct;
  const annualNeedAtRetire = annualNeedNow * Math.pow(1 + params.inflationRate, yearsToRetire);
  const totalNeed = annualNeedAtRetire * retireYears;

  // 退休後退休金收入(勞退/月退)可抵需求
  const pensionTotal = (data.deep?.retire_pension_monthly ?? 0) * 12 * retireYears;

  // 退休時可累積資產 = 現有可投資資產成長 + 未來持續投入終值
  const grownCurrent = grow(investableAssets(core.assets), params.returnRate, yearsToRetire);
  const annualContribution = Math.max(0, (SURPLUS_BAND_VALUE[core.surplus_band] ?? 0) * 12);
  const contributions = fvAnnuity(annualContribution, params.returnRate, yearsToRetire);
  const accumulable = grownCurrent + contributions + pensionTotal;

  const gap = round(totalNeed - accumulable);
  return {
    status: "computed",
    gap,
    breakdown: [
      { label: "退休後總支出需求", amount: round(totalNeed) },
      { label: "現有資產成長估計", amount: round(grownCurrent) },
      { label: "未來持續投入估計", amount: round(contributions) },
      ...(pensionTotal > 0 ? [{ label: "退休金收入(勞退/月退)", amount: -round(pensionTotal) }] : []),
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

  // 扶養支出現值 — 子女:至經濟獨立年齡的年數 × 每年扶養
  const perChildYears = core.dependents.children.reduce(
    (s, c) => s + Math.max(0, params.childIndependentAge - (c.age ?? 0)),
    0,
  );
  const childSupport = perChildYears * params.dependentSupportAnnual;

  // 父母:各自(平均餘命 − 目前年齡)年數 × 每年奉養;無年齡時用後備總額 × 人數
  const parents = core.dependents.parents;
  const parentSupport =
    parents.ages.length > 0
      ? parents.ages.reduce((s, age) => s + Math.max(0, params.parentLifeExpectancy - age) * params.parentSupportAnnual, 0)
      : parents.count * params.parentSupportTotal;

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

/** 子女高階教育總花費現值(不扣已準備),供保障缺口引用。
 *  每位子女:(每年教育預算 + 每年生活預算)× 就讀年數;就學時程由年齡推算(18 歲起)。
 *  未填預算時,以參數 eduCostOverseas/Domestic 作後備總額估計。 */
function educationTotalNeed(data: QuestionnaireData, params: CalcParams): number {
  const goals = data.deep?.edu_goals ?? [];
  const children = data.core.dependents.children;
  const HIGHER_ED_START_AGE = 18;
  return goals.reduce((sum, g, i) => {
    const years = g.study_years ?? 4;
    const annual = (g.annual_edu_budget || 0) + (g.annual_living_budget || 0);
    const total = annual > 0 ? annual * years : g.overseas ? params.eduCostOverseas : params.eduCostDomestic;
    const childAge = children[i]?.age ?? 0;
    const yearsUntil = Math.max(0, HIGHER_ED_START_AGE - childAge);
    const pv = total / Math.pow(1 + params.returnRate, yearsUntil);
    return sum + pv;
  }, 0);
}

export function educationGap(
  data: QuestionnaireData,
  params: CalcParams = DEFAULT_PARAMS,
): GapResult {
  if (!data.deep?.edu_goals || data.deep.edu_goals.length === 0) {
    const hasChildren = data.core.dependents.children.length > 0;
    return {
      status: "needs_deep_data",
      gap: 0,
      breakdown: [],
      missing: hasChildren ? ["子女高階教育規劃(出國/預算)"] : ["(無子女,不適用)"],
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

// ── 退休金回推試算(解決建議)──────────────────────────
// 輸入:退休後每月想固定領取金額(萬)。回推現在需準備多少。

export interface ReserveResult {
  targetMonthly: number; // 目標每月領取(萬)
  annualNeed: number; // 每年領取(萬)
  capitalAtRetirement: number; // 退休時所需準備金(萬)
  lumpSumToday: number; // 今日一次準備(現值,萬)
  currentAssetsGrown: number; // 現有可投資資產成長至退休(萬)
  requiredMonthlySaving: number; // 從現在起每月需儲蓄(萬)
  sufficient: boolean; // 現有資產是否已足夠
}

export function retirementReserve(
  data: QuestionnaireData,
  params: CalcParams,
  targetMonthly: number,
): ReserveResult {
  const { core } = data;
  const yearsToRetire = Math.max(0, core.retire_age - core.age);
  const retireYears = Math.max(1, params.lifeExpectancy - core.retire_age);
  const r = params.returnRate;
  const annualNeed = targetMonthly * 12;

  // 退休時所需準備金 = 年領取 × 年金現值因子(退休期間本金以 r 成長)
  const annuityPV = r === 0 ? retireYears : (1 - Math.pow(1 + r, -retireYears)) / r;
  const capitalAtRetirement = annualNeed * annuityPV;

  const lumpSumToday = capitalAtRetirement / Math.pow(1 + r, yearsToRetire);
  const currentAssetsGrown = grow(investableAssets(core.assets), r, yearsToRetire);
  const shortfall = Math.max(0, capitalAtRetirement - currentAssetsGrown);

  const fvFactor = yearsToRetire <= 0 ? 0 : r === 0 ? yearsToRetire : (Math.pow(1 + r, yearsToRetire) - 1) / r;
  const requiredAnnualSaving = fvFactor > 0 ? shortfall / fvFactor : shortfall;

  return {
    targetMonthly,
    annualNeed: round(annualNeed),
    capitalAtRetirement: round(capitalAtRetirement),
    lumpSumToday: round(lumpSumToday),
    currentAssetsGrown: round(currentAssetsGrown),
    requiredMonthlySaving: round(requiredAnnualSaving / 12),
    sufficient: shortfall <= 0,
  };
}
