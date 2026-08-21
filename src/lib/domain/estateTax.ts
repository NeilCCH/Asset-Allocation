// 遺產稅預估 — 台灣現行遺產稅概數（可依法令調整）。單位：萬元。
// 屬客觀試算（非投資建議）；僅在達課稅標準（課稅遺產淨額 > 0）時呈現。
import type { QuestionnaireData } from "./types";
import { sumAssets } from "./calc";

export const ESTATE_TAX = {
  exemption: 1333, // 免稅額（1,333 萬）
  funeral: 138, // 喪葬費扣除額（138 萬）
  spouse: 493, // 配偶扣除額（493 萬）
  perChild: 56, // 每位直系血親卑親屬扣除額（56 萬）
  perParent: 138, // 每位父母扣除額（138 萬）
  brackets: [
    { upTo: 5000, rate: 0.1, diff: 0 }, // 5,000 萬以下 10%
    { upTo: 10000, rate: 0.15, diff: 250 }, // 5,000 萬–1 億 15%，累進差額 250 萬
    { upTo: Infinity, rate: 0.2, diff: 750 }, // 1 億以上 20%，累進差額 750 萬
  ],
};

export interface EstateTaxResult {
  taxable: boolean; // 是否達課稅標準
  grossEstate: number;
  deductions: { label: string; amount: number }[];
  totalDeductions: number;
  netTaxable: number;
  tax: number;
  rate: number;
}

export function estimateEstateTax(data: QuestionnaireData): EstateTaxResult {
  const grossEstate = sumAssets(data.core.assets);
  const hasSpouse = data.core.planning_scope === "含配偶";
  const dep = data.core.dependents;
  const children = dep?.children?.length ?? 0;
  const parents = dep?.parents?.length ?? 0;
  const liabilities = data.deep?.liabilities
    ? data.deep.liabilities.mortgage_balance + data.deep.liabilities.loan_balance + (data.deep.liabilities.credit_card_balance ?? 0)
    : 0;

  const deductions = [
    { label: "免稅額", amount: ESTATE_TAX.exemption },
    { label: "喪葬費扣除", amount: ESTATE_TAX.funeral },
    ...(hasSpouse ? [{ label: "配偶扣除", amount: ESTATE_TAX.spouse }] : []),
    ...(children > 0 ? [{ label: `直系卑親屬扣除 ×${children}`, amount: children * ESTATE_TAX.perChild }] : []),
    ...(parents > 0 ? [{ label: `父母扣除 ×${parents}`, amount: parents * ESTATE_TAX.perParent }] : []),
    ...(liabilities > 0 ? [{ label: "未償債務扣除", amount: liabilities }] : []),
  ];
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  const netTaxable = grossEstate - totalDeductions;

  if (netTaxable <= 0) {
    return { taxable: false, grossEstate, deductions, totalDeductions, netTaxable: 0, tax: 0, rate: 0 };
  }
  const b = ESTATE_TAX.brackets.find((x) => netTaxable <= x.upTo)!;
  const tax = Math.max(0, netTaxable * b.rate - b.diff);
  return {
    taxable: true,
    grossEstate,
    deductions,
    totalDeductions,
    netTaxable: Math.round(netTaxable * 10) / 10,
    tax: Math.round(tax * 10) / 10,
    rate: b.rate,
  };
}
