// 缺口試算可調參數 — PRD §7「參數須可在顧問後台調整」
// 這些是透明的規則式假設，不含投資意見。改這裡即改全系統試算基準。

export interface CalcParams {
  /** 年化投資報酬率假設 */
  returnRate: number;
  /** 年化通膨率假設 */
  inflationRate: number;
  /** 期望薪資成長率（年化）— 內部用於「年結餘持續投入」之成長型年金，非 UI 參數 */
  salaryGrowthRate: number;
  /** 預估退休前薪資（萬/年）— 由互動參數填入；主動收入曲線自現況線性推估至此值。未填則沿用現況主動收入 */
  estRetireSalaryAnnual?: number;
  /** 預估餘命（歲）— 退休後年數 = lifeExpectancy − 退休年齡 */
  lifeExpectancy: number;
  /** 退休後想維持的生活水準預設（目前開銷幾成），未填深化題時採用 */
  defaultRetireLifestylePct: number;
  /** 每位子女每年扶養支出（萬元） */
  dependentSupportAnnual: number;
  /** 子女視為經濟獨立的年齡 */
  childIndependentAge: number;
  /** 奉養父母的支出總額估計（萬元，現值）— 無父母年齡時的後備估值 */
  parentSupportTotal: number;
  /** 每位父母每年奉養支出（萬元） */
  parentSupportAnnual: number;
  /** 父母平均餘命（歲）— 依台灣平均，可調 */
  parentLifeExpectancy: number;
  /** 子女教育總花費（萬元，現值基準）：國內 / 海外 */
  eduCostDomestic: number;
  eduCostOverseas: number;
}

/** 系統預設值（保守假設）。顧問可於後台針對個別客戶覆寫。 */
export const DEFAULT_PARAMS: CalcParams = {
  returnRate: 0.04,
  inflationRate: 0.02,
  salaryGrowthRate: 0.02, // 每年可投入金額成長率（薪資成長）
  lifeExpectancy: 84, // 預設；實際依客戶性別帶入台灣平均餘命（見下）
  defaultRetireLifestylePct: 70,
  dependentSupportAnnual: 15,
  childIndependentAge: 20, // 子女以 20 歲為經濟獨立基準
  parentSupportTotal: 200,
  parentSupportAnnual: 20, // 每位父母每年 20 萬
  parentLifeExpectancy: 82, // 台灣男女平均約 80-84，取 82
  eduCostDomestic: 150,
  eduCostOverseas: 600,
};

/**
 * 台灣地區平均餘命（依性別，以稱謂判斷）。用於退休試算之終齡。
 * 參考內政部簡易生命表概數，可於後台調整。
 */
export const TW_LIFE_EXPECTANCY: Record<string, number> = {
  "先生": 77, // 男性
  "女士": 84, // 女性
};

/** 依客戶稱謂（性別）給出預設試算參數：本人終齡帶入台灣平均餘命 */
export function clientDefaultParams(honorific?: string): CalcParams {
  const life = (honorific && TW_LIFE_EXPECTANCY[honorific]) || DEFAULT_PARAMS.lifeExpectancy;
  return { ...DEFAULT_PARAMS, lifeExpectancy: life };
}

// ── 級距 → 代表值（萬元）。試算時把 enum 折算成可運算數字。 ──

/** 家庭年收入級距 → 年收入代表值（萬元） */
export const INCOME_BAND_VALUE: Record<string, number> = {
  "<80": 60,
  "80-150": 115,
  "150-300": 225,
  "300-500": 400,
  "500-1000": 750,
  ">1000": 1200,
};

/** 每月結餘級距 → 月結餘代表值（萬元）。「赤字」以負值處理。 */
export const SURPLUS_BAND_VALUE: Record<string, number> = {
  "赤字": -1,
  "<1": 0.5,
  "1-3": 2,
  "3-6": 4.5,
  "6-10": 8,
  ">10": 12,
};
