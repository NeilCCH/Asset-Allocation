// 配置面向參考框架 — ⚠️ 顧問專屬。PRD §11 決策:採「顧問手動勾選、系統只提供參考框架」,
// 不做規則庫自動產生(降低自動化投顧疑慮)。此處只定義「面向清單」與中性提示,
// 由顧問本人(具專業資格)判斷後勾選並對客戶開口。
//
// 面向皆為「資產類別 / 規劃方向」層級,絕不含個股、代號、商品名稱或買賣指示。

import type { QuestionnaireData } from "./types";
import { computeGaps, liquidAssets, protectionVsInvestment, sumAssets } from "./calc";
import { clientDefaultParams } from "./params";

export interface AllocationDimension {
  key: string;
  title: string;
  desc: string;
}

/** 可供顧問勾選的配置面向(參考框架,非建議) */
export const ALLOCATION_DIMENSIONS: AllocationDimension[] = [
  { key: "liquidity", title: "流動性緩衝", desc: "建立或補強緊急預備金,確保短期支出無虞" },
  { key: "retirement", title: "退休準備", desc: "檢視長期退休資產累積是否足以支應退休後年支出" },
  { key: "protection", title: "保障缺口", desc: "檢視壽險 / 醫療 / 意外等保障是否足以覆蓋家庭責任" },
  { key: "education", title: "教育金專款", desc: "為子女教育設立專款,依時程與國內外規劃" },
  { key: "diversification", title: "投資分散", desc: "檢視投資部位是否過度集中於單一類別" },
  { key: "real_estate", title: "不動產占比", desc: "檢視不動產占總資產比重是否偏高、影響流動性" },
  { key: "succession", title: "傳承與稅務", desc: "資產傳承、信託等規劃面向(依需求)" },
];

/** 中性提示:僅標示「事實層」觀察到的現象,不下建議、不決定要不要處理。 */
export interface DimensionHint {
  key: string;
  flagged: boolean;
  note?: string;
}

export function dimensionHints(data: QuestionnaireData): DimensionHint[] {
  const gaps = computeGaps(data, clientDefaultParams(data.basic.honorific));
  const total = sumAssets(data.core.assets);
  const liquid = liquidAssets(data.core.assets);
  const pvi = protectionVsInvestment(data.core.assets);
  const liquidPct = total > 0 ? liquid / total : 0;
  const realEstate =
    (data.core.assets.real_estate_own.has ? data.core.assets.real_estate_own.amount : 0) +
    (data.core.assets.real_estate_invest.has ? data.core.assets.real_estate_invest.amount : 0);
  const realEstatePct = total > 0 ? realEstate / total : 0;

  return [
    { key: "liquidity", flagged: liquidPct < 0.1, note: `流動資產約占 ${Math.round(liquidPct * 100)}%` },
    {
      key: "retirement",
      flagged: gaps.retirement.status === "computed" && gaps.retirement.gap > 0,
      note: gaps.retirement.status === "computed" ? `退休試算缺口 ${Math.round(gaps.retirement.gap)} 萬` : "待深化資料",
    },
    {
      key: "protection",
      flagged: pvi.protection === 0 || pvi.protection < pvi.investment * 0.1,
      note: "保障型資產偏低",
    },
    {
      key: "education",
      flagged: data.core.dependents.children.length > 0,
      note: data.core.dependents.children.length > 0 ? `有 ${data.core.dependents.children.length} 位子女` : undefined,
    },
    { key: "diversification", flagged: false },
    { key: "real_estate", flagged: realEstatePct > 0.6, note: `不動產約占 ${Math.round(realEstatePct * 100)}%` },
    { key: "succession", flagged: total > 3000, note: total > 3000 ? "資產規模較大" : undefined },
  ];
}
