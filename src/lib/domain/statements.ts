// 家庭財務報表 — 參考公司三表(資產負債表 / 損益表 / 現金流量表)之結構與會計邏輯。
// 單位:資產負債表為萬元;損益/現金流為年或月(萬元)。
import type { QuestionnaireData } from "./types";
import { assetBreakdown } from "./calc";
import { INCOME_BAND_VALUE, SURPLUS_BAND_VALUE } from "./params";
import { estimateIncomeTax } from "./incomeTax";

export interface Line {
  label: string;
  amount: number;
  tag?: string; // 主動 / 被動 等註記
}

export interface PersonalStatements {
  // 資產負債表:資產 = 負債 + 淨值
  balanceSheet: {
    assets: Line[];
    liabilities: Line[];
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
  };
  // 損益表(年):收入 − 支出 = 結餘
  incomeStatement: {
    income: Line[];
    totalIncome: number;
    totalExpense: number;
    surplus: number;
    passiveIncome: number;
    passiveRatio: number; // 被動收入占總收入
    incomeTax?: number; // 應納所得稅(萬),有填綜合所得淨額時
    afterTaxIncome?: number; // 稅後所得(萬)
    marginalRate?: number; // 邊際稅率
  };
  // 現金流量表(月):流入 − 流出 = 淨現金流
  cashFlow: {
    inflow: number;
    outflow: number;
    debtPayment: number;
    net: number;
    // 每月固定支出明細(選填,萬/月)
    fixedExpense?: Line[];
    fixedExpenseTotal?: number;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function personalStatements(data: QuestionnaireData): PersonalStatements {
  const { core, deep } = data;

  // ── 資產負債表 ──
  const assets: Line[] = assetBreakdown(core.assets)
    .filter((a) => a.amount > 0)
    .map((a) => ({ label: a.label, amount: a.amount }));
  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);

  const liabilities: Line[] = [];
  if (deep?.liabilities) {
    if (deep.liabilities.mortgage_balance > 0) liabilities.push({ label: "房貸餘額", amount: deep.liabilities.mortgage_balance });
    if (deep.liabilities.loan_balance > 0) liabilities.push({ label: "其他貸款餘額", amount: deep.liabilities.loan_balance });
  }
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
  const netWorth = totalAssets - totalLiabilities;

  // ── 損益表(年) ──
  // 收入拆解優先用「每月固定收入明細」(×12);其次相容舊的 income_sources;最後用年收入級距估計。
  // 級距估計作為下限:明細合計不足時補「其他收入」,避免總收入被低估、下游試算跑掉。
  const bandIncome = INCOME_BAND_VALUE[core.income_band] ?? 0;
  const PASSIVE_LABELS = new Set(["租金收入", "股利 / 利息"]);
  const fixedInc = deep?.annual_fixed_income ?? []; // 固定收入明細以「年」為單位,直接採用
  const src = deep?.income_sources;
  let income: Line[];
  if (fixedInc.length > 0) {
    income = fixedInc.map((i) => ({
      label: i.label,
      amount: r1(i.amount),
      tag: PASSIVE_LABELS.has(i.label) ? "被動" : undefined,
    }));
    const detailTotal = income.reduce((s, l) => s + l.amount, 0);
    if (detailTotal < bandIncome) income.push({ label: "其他收入", amount: r1(bandIncome - detailTotal) });
  } else if (src && [src.salary, src.bonus, src.rental, src.dividend, src.business, src.other].some((v) => v > 0)) {
    income = [
      { label: "薪資", amount: src.salary, tag: "主動" },
      { label: "獎金 / 佣金", amount: src.bonus, tag: "主動" },
      { label: "租金", amount: src.rental, tag: "被動" },
      { label: "股利 / 利息", amount: src.dividend, tag: "被動" },
      { label: "事業盈餘", amount: src.business, tag: "半被動" },
      { label: "其他", amount: src.other },
    ].filter((l) => l.amount > 0);
  } else {
    income = [{ label: "年收入(級距估計)", amount: bandIncome }];
  }
  const totalIncome = income.reduce((s, l) => s + l.amount, 0);
  const annualSurplus = (SURPLUS_BAND_VALUE[core.surplus_band] ?? 0) * 12;
  const totalExpense = Math.max(0, totalIncome - annualSurplus);
  const passiveIncome = income.filter((l) => l.tag === "被動").reduce((s, l) => s + l.amount, 0);

  // ── 現金流量表(月) ──
  const inflow = totalIncome / 12;
  const net = SURPLUS_BAND_VALUE[core.surplus_band] ?? 0; // 月結餘
  const outflow = inflow - net;
  const debtPayment = deep?.liabilities?.monthly_payment ?? 0;

  // ── 每月固定支出明細(選填,月)──(固定收入為年,已計入上方損益表)
  const fixedExpenseItems = deep?.monthly_fixed_expense ?? [];
  const fixedExpenseTotal = fixedExpenseItems.reduce((s, i) => s + i.amount, 0);

  // ── 所得稅(有填綜合所得淨額時) ──
  const tax = deep?.taxable_income != null ? estimateIncomeTax(deep.taxable_income) : null;

  return {
    balanceSheet: {
      assets,
      liabilities,
      totalAssets: r1(totalAssets),
      totalLiabilities: r1(totalLiabilities),
      netWorth: r1(netWorth),
    },
    incomeStatement: {
      income,
      totalIncome: r1(totalIncome),
      totalExpense: r1(totalExpense),
      surplus: r1(annualSurplus),
      passiveIncome: r1(passiveIncome),
      passiveRatio: totalIncome > 0 ? Math.round((passiveIncome / totalIncome) * 100) : 0,
      incomeTax: tax ? tax.tax : undefined,
      afterTaxIncome: tax ? r1(totalIncome - tax.tax) : undefined,
      marginalRate: tax ? tax.marginalRate : undefined,
    },
    cashFlow: {
      inflow: r1(inflow),
      outflow: r1(outflow),
      debtPayment: r1(debtPayment),
      net: r1(net),
      fixedExpense: fixedExpenseItems.length ? fixedExpenseItems.map((i) => ({ label: i.label, amount: r1(i.amount) })) : undefined,
      fixedExpenseTotal: fixedExpenseItems.length ? r1(fixedExpenseTotal) : undefined,
    },
  };
}
