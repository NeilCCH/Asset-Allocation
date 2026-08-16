// 資產分層 — 依「可投資資產」對應現行財富管理 HNW 分層。
// 取代對客戶的 A/B/C leads 分級「顯示」;此為客觀資產級距(非銷售評分),
// 語彙貼近財富管理實務。基準:可投資資產(不含自住不動產),單位:萬元 NTD。

export type WealthTierKey = "uhnw" | "hnw" | "affluent" | "mass_affluent" | "mass";

export interface WealthTier {
  key: WealthTierKey;
  label: string; // 顯示名稱
  en: string; // 英文對照
  range: string; // 級距說明(可投資資產)
}

// 門檻(可投資資產,萬元 NTD),由高至低。
const TIERS: (WealthTier & { min: number })[] = [
  { key: "uhnw", label: "超高淨值", en: "UHNW", min: 10000, range: "可投資 ≥ 1 億" },
  { key: "hnw", label: "高淨值", en: "HNW", min: 3000, range: "3,000 萬 – 1 億" },
  { key: "affluent", label: "富裕", en: "Affluent", min: 1000, range: "1,000 – 3,000 萬" },
  { key: "mass_affluent", label: "中產", en: "Mass Affluent", min: 300, range: "300 – 1,000 萬" },
  { key: "mass", label: "一般", en: "Mass", min: 0, range: "< 300 萬" },
];

export function wealthTier(investableWan: number): WealthTier {
  const t = TIERS.find((x) => investableWan >= x.min) ?? TIERS[TIERS.length - 1];
  const { min: _min, ...tier } = t;
  void _min;
  return tier;
}

export const WEALTH_TIERS: readonly WealthTier[] = TIERS.map(({ min: _m, ...t }) => {
  void _m;
  return t;
});
