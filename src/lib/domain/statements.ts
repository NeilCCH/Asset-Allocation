// 家庭財務報表 — 參考公司三表(資產負債表 / 損益表 / 現金流量表)之結構與會計邏輯。
// 單位:資產負債表為萬元;損益/現金流為年或月(萬元)。
import type { QuestionnaireData } from "./types";
import { assetBreakdown } from "./calc";
import { INCOME_BAND_VALUE, SURPLUS_BAND_VALUE } from "./params";

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
  };
  // 現金流量表(月):流入 − 流出 = 淨現金流
  cashFlow: {
    inflow: number;
    outflow: number;
    debtPayment: number;
    net: number;
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
  const src = deep?.income_sources;
  let income: Line[];
  if (src && [src.salary, src.bonus, src.rental, src.dividend, src.business, src.other].some((v) => v > 0)) {
    income = [
      { label: "薪資", amount: src.salary, tag: "主動" },
      { label: "獎金 / 佣金", amount: src.bonus, tag: "主動" },
      { label: "租金", amount: src.rental, tag: "被動" },
      { label: "股利 / 利息", amount: src.dividend, tag: "被動" },
      { label: "事業盈餘", amount: src.business, tag: "半被動" },
      { label: "其他", amount: src.other },
    ].filter((l) => l.amount > 0);
  } else {
    income = [{ label: "年收入(級距估計)", amount: INCOME_BAND_VALUE[core.income_band] ?? 0 }];
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
    },
    cashFlow: {
      inflow: r1(inflow),
      outflow: r1(outflow),
      debtPayment: r1(debtPayment),
      net: r1(net),
    },
  };
}
