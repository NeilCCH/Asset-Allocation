// 缺口試算引擎 — PRD §7。純函式、規則式、可調參數，輸出屬客觀試算，不含投資意見。
// 所有金額單位：萬元 TWD。

import type { Assets, QuestionnaireData } from "./types";
import {
  CalcParams,
  DEFAULT_PARAMS,
  INCOME_BAND_VALUE,
  SURPLUS_BAND_VALUE,
} from "./params";

// ── 資產彙整（現況全貌圖來源） ─────────────────────────

// 資產三分類（固定 / 流動 / 風險）；保障型保單不計入資產，獨立顯示。
export type AssetClass = "流動" | "固定" | "風險" | "保障";
// 風險資產再分：穩定（收租/配息等穩定收益）vs 風險（高波動）
export type RiskType = "穩定" | "風險";

export interface AssetBreakdown {
  label: string;
  key: keyof Assets;
  amount: number;
  category: "流動" | "投資" | "保障" | "不動產" | "其他"; // 舊分類（保留給既有計算）
  assetClass: AssetClass;
  riskType?: RiskType;
}

const ASSET_META: Record<
  keyof Assets,
  { label: string; category: AssetBreakdown["category"]; assetClass: AssetClass; riskType?: RiskType; liquid: boolean; investable: boolean }
> = {
  cash: { label: "現金存款", category: "流動", assetClass: "流動", liquid: true, investable: true },
  forex: { label: "外幣活存", category: "流動", assetClass: "流動", liquid: true, investable: true },
  stock_tw: { label: "台股", category: "投資", assetClass: "風險", riskType: "風險", liquid: true, investable: true },
  stock_overseas: { label: "海外股票", category: "投資", assetClass: "風險", riskType: "風險", liquid: true, investable: true },
  fund_etf: { label: "基金/ETF", category: "投資", assetClass: "風險", riskType: "風險", liquid: true, investable: true },
  insurance_protection: { label: "保單（保障型）", category: "保障", assetClass: "保障", liquid: false, investable: false },
  insurance_invest: { label: "投資型保單", category: "投資", assetClass: "風險", riskType: "風險", liquid: false, investable: true },
  insurance_savings: { label: "儲蓄保單", category: "其他", assetClass: "固定", liquid: false, investable: false },
  gold: { label: "黃金/貴金屬", category: "投資", assetClass: "風險", riskType: "穩定", liquid: true, investable: true },
  crypto: { label: "加密貨幣", category: "投資", assetClass: "風險", riskType: "風險", liquid: true, investable: true },
  real_estate_own: { label: "不動產（自住）", category: "不動產", assetClass: "固定", liquid: false, investable: false },
  real_estate_invest: { label: "不動產（投資）", category: "不動產", assetClass: "風險", riskType: "穩定", liquid: false, investable: false },
  retire_account: { label: "退休專戶累積金", category: "其他", assetClass: "固定", liquid: false, investable: false },
  other: { label: "其他（藝術品/收藏等）", category: "其他", assetClass: "固定", liquid: false, investable: false },
};

export function assetBreakdown(assets: Assets): AssetBreakdown[] {
  return (Object.keys(ASSET_META) as (keyof Assets)[]).map((key) => ({
    key,
    label: ASSET_META[key].label,
    amount: assets[key].has ? Math.max(0, assets[key].amount) : 0,
    category: ASSET_META[key].category,
    assetClass: ASSET_META[key].assetClass,
    riskType: ASSET_META[key].riskType,
  }));
}

/** 資產總額 — ⚠️ 不含保障型保單（保障不視為可運用資產，獨立顯示）。 */
export function sumAssets(assets: Assets): number {
  return assetBreakdown(assets)
    .filter((a) => a.assetClass !== "保障")
    .reduce((s, a) => s + a.amount, 0);
}

/** 保障型保單金額（獨立於資產總額） */
export const protectionAssets = (assets: Assets) => sumBy(assets, (m) => m.assetClass === "保障");

// 資產三分類分布（固定 / 流動 / 風險），另附獨立的保障金額
export interface ClassSlice {
  assetClass: "流動" | "固定" | "風險";
  amount: number;
  pct: number;
}
export function assetClassBreakdown(assets: Assets): { slices: ClassSlice[]; total: number; protection: number } {
  const total = sumAssets(assets);
  const order: ClassSlice["assetClass"][] = ["流動", "固定", "風險"];
  const slices = order
    .map((c) => {
      const amount = sumBy(assets, (m) => m.assetClass === c);
      return { assetClass: c, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 };
    })
    .filter((s) => s.amount > 0);
  return { slices, total, protection: protectionAssets(assets) };
}

// 風險資產：穩定 vs 風險 兩組明細與比重
export interface RiskAssetGroup {
  items: { key: keyof Assets; label: string; amount: number; pct: number }[];
  total: number;
}
export interface RiskAssetBreakdown {
  stable: RiskAssetGroup;
  risky: RiskAssetGroup;
  total: number;
  stablePct: number;
  riskyPct: number;
}
export function riskAssetBreakdown(assets: Assets): RiskAssetBreakdown {
  const build = (rt: RiskType): RiskAssetGroup => {
    const raw = (Object.keys(ASSET_META) as (keyof Assets)[])
      .filter((k) => ASSET_META[k].riskType === rt)
      .map((k) => ({ key: k, label: ASSET_META[k].label, amount: assets[k].has ? Math.max(0, assets[k].amount) : 0 }))
      .filter((i) => i.amount > 0);
    const total = raw.reduce((s, i) => s + i.amount, 0);
    return {
      total,
      items: raw.map((i) => ({ ...i, pct: total > 0 ? Math.round((i.amount / total) * 100) : 0 })).sort((a, b) => b.amount - a.amount),
    };
  };
  const stable = build("穩定");
  const risky = build("風險");
  const total = stable.total + risky.total;
  return { stable, risky, total, stablePct: total > 0 ? Math.round((stable.total / total) * 100) : 0, riskyPct: total > 0 ? Math.round((risky.total / total) * 100) : 0 };
}

function sumBy(assets: Assets, pick: (m: (typeof ASSET_META)[keyof Assets]) => boolean): number {
  return (Object.keys(ASSET_META) as (keyof Assets)[]).reduce(
    (s, key) => s + (pick(ASSET_META[key]) && assets[key].has ? Math.max(0, assets[key].amount) : 0),
    0,
  );
}

export const liquidAssets = (assets: Assets) => sumBy(assets, (m) => m.liquid);
export const investableAssets = (assets: Assets) => sumBy(assets, (m) => m.investable);

/** 保障型資產（壽險保障） vs 投資型資產 的比重 — 本工具差異化指標 */
export function protectionVsInvestment(assets: Assets) {
  const protection = sumBy(assets, (m) => m.category === "保障");
  const investment = sumBy(assets, (m) => m.category === "投資");
  return { protection, investment };
}

/** 投資組合明細 — 只納入「投資」類資產。投資型保單以帳戶價值計入，身故保額不列入投資統計。 */
export interface InvestmentBreakdown {
  items: { key: keyof Assets; label: string; amount: number; pct: number }[];
  total: number;
}
export function investmentBreakdown(assets: Assets): InvestmentBreakdown {
  const raw = (Object.keys(ASSET_META) as (keyof Assets)[])
    .filter((key) => ASSET_META[key].category === "投資")
    .map((key) => ({ key, label: ASSET_META[key].label, amount: assets[key].has ? Math.max(0, assets[key].amount) : 0 }))
    .filter((i) => i.amount > 0);
  const total = raw.reduce((s, i) => s + i.amount, 0);
  return {
    total,
    items: raw
      .map((i) => ({ ...i, pct: total > 0 ? Math.round((i.amount / total) * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount),
  };
}

// ── 通用金融函式 ─────────────────────────────────────

const grow = (pv: number, rate: number, years: number) => pv * Math.pow(1 + rate, years);

/** 期末年金終值：每年投入 pmt,rate 報酬，years 年 */
/** 貸款每月攤還金額（本息平均攤還法）。 */
export function loanMonthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const i = annualRatePct / 100 / 12;
  const months = years * 12;
  if (i === 0) return principal / months;
  return (principal * i) / (1 - Math.pow(1 + i, -months));
}

/** 貸款經過 years 年後的剩餘本金（已知月還款與年利率）；無還款資訊則視為不變。 */
export function remainingLoanBalance(balance: number, monthlyPayment: number, annualRatePct: number, years: number): number {
  if (balance <= 0) return 0;
  if (years <= 0) return balance;
  if (monthlyPayment <= 0) return balance;
  const i = annualRatePct / 100 / 12;
  const months = years * 12;
  if (i === 0) return Math.max(0, balance - monthlyPayment * months);
  const bal = balance * Math.pow(1 + i, months) - monthlyPayment * ((Math.pow(1 + i, months) - 1) / i);
  return Math.max(0, bal);
}

/** 成長型年金終值：首年投入 pmt，之後每年以 growth 成長，期間以 rate 複利。 */
export function fvGrowingAnnuity(pmt: number, rate: number, growth: number, years: number): number {
  if (years <= 0) return 0;
  if (Math.abs(rate - growth) < 1e-9) return pmt * years * Math.pow(1 + rate, years - 1);
  return (pmt * (Math.pow(1 + rate, years) - Math.pow(1 + growth, years))) / (rate - growth);
}

/** 目前年支出估計 = 年收入 − 年結餘（透明推導，無另問開銷） */
function estimateAnnualExpense(data: QuestionnaireData): number {
  const annualIncome = INCOME_BAND_VALUE[data.core.income_band] ?? 0;
  const monthlySurplus = SURPLUS_BAND_VALUE[data.core.surplus_band] ?? 0;
  const annualSurplus = monthlySurplus * 12;
  return Math.max(0, annualIncome - annualSurplus);
}

// ── 缺口結果型別 ─────────────────────────────────────

export type GapStatus = "computed" | "needs_deep_data" | "not_planned";

export interface GapResult {
  status: GapStatus;
  /** 缺口金額（萬元）。正值 = 短缺、需補足；負值/0 = 已足夠 */
  gap: number;
  breakdown: { label: string; amount: number }[];
  /** 缺哪些深化題才能算（status = needs_deep_data 時填） */
  missing?: string[];
}

// ── ① 退休金缺口（基本層即可試算） ───────────────────

export function retirementGap(
  data: QuestionnaireData,
  params: CalcParams = DEFAULT_PARAMS,
): GapResult {
  const { core } = data;
  const yearsToRetire = Math.max(0, core.retire_age - core.age);
  const retireYears = Math.max(0, params.lifeExpectancy - core.retire_age);

  // 退休當年的年支出需求：優先用「退休後每月支出」；否則以目前開銷 × 生活水準%
  const lifestylePct =
    (data.deep?.retire_lifestyle_pct ?? params.defaultRetireLifestylePct) / 100;
  const annualNeedNow =
    data.deep?.retire_monthly_expense != null
      ? data.deep.retire_monthly_expense * 12
      : estimateAnnualExpense(data) * lifestylePct;
  // 無退休生活需求依據（未填退休後每月支出，且無收入/結餘級距可推估）→ 尚未規劃，不可顯示「已足夠」
  if (annualNeedNow <= 0) {
    return { status: "not_planned", gap: 0, breakdown: [], missing: ["退休後每月支出（或收支級距）"] };
  }
  const r = params.returnRate, inf = params.inflationRate;
  const annualNeedAtRetire = annualNeedNow * Math.pow(1 + inf, yearsToRetire);
  // 退休期間支出「逐年通膨」之名目總額（保守：不假設退休後本金再高成長）
  const needSumFactor = inf < 1e-9 ? retireYears : (Math.pow(1 + inf, retireYears) - 1) / inf;
  const totalNeed = annualNeedAtRetire * needSumFactor;

  // 退休後退休金收入（勞退/月退）名目總額，可抵需求（固定名目，不隨通膨調整）
  const pensionTotal = (data.deep?.retire_pension_monthly ?? 0) * 12 * retireYears;

  // 退休時可累積資產 = 現有可投資資產成長 + 未來「平投」終值（移除薪資成長之樂觀假設）
  const grownCurrent = grow(investableAssets(core.assets), r, yearsToRetire);
  const annualContribution = Math.max(0, (SURPLUS_BAND_VALUE[core.surplus_band] ?? 0) * 12);
  const contribFactor = r < 1e-9 ? yearsToRetire : (Math.pow(1 + r, yearsToRetire) - 1) / r; // 期末年金 FV
  const contributions = annualContribution * contribFactor;
  const accumulable = grownCurrent + contributions + pensionTotal;

  const gap = round(totalNeed - accumulable);
  return {
    status: "computed",
    gap,
    breakdown: [
      { label: "退休後總支出需求", amount: round(totalNeed) },
      { label: "現有資產成長估計", amount: round(grownCurrent) },
      { label: "未來持續投入估計", amount: round(contributions) },
      ...(pensionTotal > 0 ? [{ label: "退休金收入（勞退/月退）", amount: -round(pensionTotal) }] : []),
    ],
  };
}

// ── ② 保障缺口（需深化資料：負債、壽險保額） ──────────

export function protectionGap(
  data: QuestionnaireData,
  params: CalcParams = DEFAULT_PARAMS,
): GapResult {
  const missing: string[] = [];
  if (!data.deep?.liabilities) missing.push("負債明細");
  if (!data.deep?.insurance_detail) missing.push("現有保障明細（壽險保額）");
  if (missing.length > 0) {
    return { status: "needs_deep_data", gap: 0, breakdown: [], missing };
  }

  const { core, deep } = data;
  const liabilities = deep!.liabilities!;
  const unpaidLiabilities =
    liabilities.mortgage_balance + liabilities.loan_balance + (liabilities.credit_card_balance ?? 0);

  // 扶養支出現值 — 子女：至經濟獨立年齡的年數 × 每年扶養
  const perChildYears = core.dependents.children.reduce(
    (s, c) => s + Math.max(0, params.childIndependentAge - (c.age ?? 0)),
    0,
  );
  const childSupport = perChildYears * params.dependentSupportAnnual;

  // 父母：各自（平均餘命 − 目前年齡）年數 × 每年奉養；無年齡時用後備總額 × 人數
  const parents = core.dependents.parents;
  const parentsWithAge = parents.filter((p) => p.age > 0);
  const parentSupport =
    parentsWithAge.length > 0
      ? parentsWithAge.reduce((s, p) => s + Math.max(0, params.parentLifeExpectancy - p.age) * params.parentSupportAnnual, 0)
      : parents.length * params.parentSupportTotal;

  // 子女教育金（取教育缺口的總需求）
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

// ── ③ 教育金缺口（需深化資料:edu_goal) ─────────────

/** 子女高階教育總花費現值（不扣已準備），供保障缺口引用。
 *  每位子女:（每年教育預算 + 每年生活預算）× 就讀年數；就學時程由年齡推算（18 歲起）。
 *  未填預算時，以參數 eduCostOverseas/Domestic 作後備總額估計。 */
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
      missing: hasChildren ? ["子女高階教育規劃（出國/預算）"] : ["（無子女，不適用）"],
    };
  }
  const need = educationTotalNeed(data, params);
  const gap = round(need); // 已準備金額目前無對應欄位，預設 0
  return {
    status: "computed",
    gap,
    breakdown: [{ label: "子女教育總花費（現值）", amount: round(need) }],
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

// ── 退休金回推試算（解決建議）──────────────────────────
// 輸入：退休後每月想固定領取金額（萬）。回推現在需準備多少。

export interface ReserveResult {
  targetMonthly: number; // 目標每月領取（萬）
  annualNeed: number; // 每年領取（萬）
  capitalAtRetirement: number; // 退休時所需準備金（萬）
  lumpSumToday: number; // 今日一次準備（現值，萬）
  currentAssetsGrown: number; // 現有可投資資產成長至退休（萬）
  requiredMonthlySaving: number; // 從現在起每月需儲蓄（萬）
  sufficient: boolean; // 現有資產是否已足夠
}

export interface GapSolution {
  name: string;
  gap: number; // 缺口（萬）
  action: string; // 建議做法
  monthly?: number; // 建議每月儲蓄（萬），適用時
  lump?: number; // 建議補足金額（萬），適用時
}

/** 缺口補足建議 — 各缺口對應的解決方向與每月儲蓄估計 */
export function gapSolutions(data: QuestionnaireData, params: CalcParams = DEFAULT_PARAMS): GapSolution[] {
  const gaps = computeGaps(data, params);
  const r = params.returnRate;
  const yearsToRetire = Math.max(1, data.core.retire_age - data.core.age);
  const fv = (n: number) => (n <= 0 ? 0 : r === 0 ? n : (Math.pow(1 + r, n) - 1) / r);
  const out: GapSolution[] = [];

  if (gaps.retirement.status === "computed" && gaps.retirement.gap > 0) {
    out.push({ name: "退休金", gap: gaps.retirement.gap, action: "退休前每月增加儲蓄", monthly: round(gaps.retirement.gap / (fv(yearsToRetire) || 1) / 12) });
  }
  if (gaps.protection.status === "computed" && gaps.protection.gap > 0) {
    out.push({ name: "保障", gap: gaps.protection.gap, action: "補足保障保額（如壽險）", lump: round(gaps.protection.gap) });
  }
  if (gaps.education.status === "computed" && gaps.education.gap > 0) {
    const ages = data.core.dependents.children.map((c) => c.age ?? 0);
    const yrs = ages.length ? Math.max(1, 18 - Math.min(...ages)) : yearsToRetire;
    out.push({ name: "教育金", gap: gaps.education.gap, action: "每月為子女教育儲蓄", monthly: round(gaps.education.gap / (fv(yrs) || 1) / 12) });
  }
  return out;
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

  // 退休時所需準備金 = 年領取 × 年金現值因子（退休期間本金以 r 成長）
  const annuityPV = r === 0 ? retireYears : (1 - Math.pow(1 + r, -retireYears)) / r;
  const capitalAtRetirement = annualNeed * annuityPV;

  const lumpSumToday = capitalAtRetirement / Math.pow(1 + r, yearsToRetire);
  const currentAssetsGrown = grow(investableAssets(core.assets), r, yearsToRetire);
  const shortfall = Math.max(0, capitalAtRetirement - currentAssetsGrown);

  // 首年需存金額（之後每年依薪資成長率成長）：以成長型年金因子回推
  const fvFactor = fvGrowingAnnuity(1, r, params.salaryGrowthRate, yearsToRetire);
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
