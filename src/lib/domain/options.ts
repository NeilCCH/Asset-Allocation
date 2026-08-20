// 問卷 UI 選項標籤 — 集中管理 enum → 顯示文字,供表單下拉/單選使用。
import type {
  Assets,
  Honorific,
  Horizon,
  IncomeBand,
  IncomeType,
  SurplusBand,
  Urgency,
} from "./types";

export const HONORIFIC_OPTIONS: Honorific[] = ["先生", "女士"];

export const INCOME_TYPE_OPTIONS: { value: IncomeType; label: string }[] = [
  { value: "固定薪", label: "固定薪(月薪穩定)" },
  { value: "業務浮動", label: "業務浮動(獎金/佣金為主)" },
  { value: "自營", label: "自營 / 事業主" },
];

export const INCOME_BAND_OPTIONS: { value: IncomeBand; label: string }[] = [
  { value: "<80", label: "80 萬以下" },
  { value: "80-150", label: "80–150 萬" },
  { value: "150-300", label: "150–300 萬" },
  { value: "300-500", label: "300–500 萬" },
  { value: "500-1000", label: "500–1,000 萬" },
  { value: ">1000", label: "1,000 萬以上" },
];

export const SURPLUS_BAND_OPTIONS: { value: SurplusBand; label: string }[] = [
  { value: "赤字", label: "入不敷出" },
  { value: "<1", label: "1 萬以下" },
  { value: "1-3", label: "1–3 萬" },
  { value: "3-6", label: "3–6 萬" },
  { value: "6-10", label: "6–10 萬" },
  { value: ">10", label: "10 萬以上" },
];

export const HORIZON_OPTIONS: { value: Horizon; label: string }[] = [
  { value: "<1年", label: "1 年內就會用到" },
  { value: "1-3年", label: "1–3 年" },
  { value: "3-5年", label: "3–5 年" },
  { value: "5-10年", label: "5–10 年" },
  { value: ">10年", label: "10 年以上用不到" },
];

export const URGENCY_OPTIONS: { value: Urgency; label: string }[] = [
  { value: "3個月內", label: "3 個月內想開始" },
  { value: "半年內", label: "半年內" },
  { value: "一年內", label: "一年內" },
  { value: "先看看", label: "先看看" },
];

/** 資產盤點欄位順序與標籤(對應 Assets) */
export const ASSET_FIELDS: { key: keyof Assets; label: string; hint?: string }[] = [
  { key: "cash", label: "現金存款" },
  { key: "forex", label: "外幣活存" },
  { key: "stock_tw", label: "台股" },
  { key: "stock_overseas", label: "海外股票" },
  { key: "fund_etf", label: "基金 / ETF" },
  { key: "gold", label: "黃金 / 貴金屬" },
  { key: "crypto", label: "加密貨幣" },
  { key: "insurance_protection", label: "保單(保障型)", hint: "壽險/醫療/意外等保障" },
  { key: "insurance_invest", label: "投資型保單", hint: "填帳戶價值(現金價值),非保額" },
  { key: "insurance_savings", label: "儲蓄保單", hint: "填帳戶價值(現金價值),非保額" },
  { key: "real_estate_own", label: "不動產(自住)" },
  { key: "real_estate_invest", label: "不動產(投資)" },
  { key: "retire_account", label: "退休專戶累積金", hint: "勞退自提、企業退休金等受限帳戶" },
  { key: "other", label: "其他", hint: "藝術品 / 收藏等" },
];
