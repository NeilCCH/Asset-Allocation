// 綜合所得稅試算 — 台灣現行累進級距(概數,可依法令調整)。單位:萬元。
// 依「綜合所得淨額」(已扣除免稅額與扣除額)計算應納稅額與邊際稅率。

export const INCOME_TAX_BRACKETS = [
  { upTo: 56, rate: 0.05, diff: 0 }, // 56 萬以下 5%
  { upTo: 126, rate: 0.12, diff: 3.92 }, // 56–126 萬 12%,累進差額 3.92 萬
  { upTo: 252, rate: 0.2, diff: 13.46 }, // 126–252 萬 20%
  { upTo: 472, rate: 0.3, diff: 38.66 }, // 252–472 萬 30%
  { upTo: Infinity, rate: 0.4, diff: 85.86 }, // 472 萬以上 40%
];

export interface IncomeTaxResult {
  taxableIncome: number; // 綜合所得淨額(萬)
  tax: number; // 應納稅額(萬)
  marginalRate: number; // 邊際稅率
  effectiveRate: number; // 有效稅率
}

export function estimateIncomeTax(taxableIncome: number): IncomeTaxResult {
  const net = Math.max(0, taxableIncome);
  const b = INCOME_TAX_BRACKETS.find((x) => net <= x.upTo) ?? INCOME_TAX_BRACKETS[INCOME_TAX_BRACKETS.length - 1];
  const tax = Math.max(0, net * b.rate - b.diff);
  return {
    taxableIncome: Math.round(net * 10) / 10,
    tax: Math.round(tax * 10) / 10,
    marginalRate: b.rate,
    effectiveRate: net > 0 ? Math.round((tax / net) * 1000) / 10 : 0,
  };
}

/** 邊際稅率下,常見可再運用的節稅方向(類別層級提示,非個別商品建議) */
export function taxPlanningHints(marginalRate: number): string[] {
  const hints: string[] = [];
  if (marginalRate >= 0.2) {
    hints.push("儲蓄投資特別扣除額(每戶 27 萬)是否用滿");
    hints.push("每人保險費列舉扣除(每人 2.4 萬,全民健保不限額)是否用滿");
    hints.push("列舉扣除額 vs 標準扣除額何者有利");
  }
  if (marginalRate >= 0.3) {
    hints.push("所得分散(如分年、家庭成員間)與長期節稅規劃");
    hints.push("退休金/勞退自提可遞延課稅之空間");
  }
  return hints;
}
