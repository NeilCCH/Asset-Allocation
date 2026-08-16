// 領域型別定義 — 對應 PRD §6 資料模型藍圖
// 分層:基本資料 → 必填核心 → 選填深化 → KYC 風險

// ── 列舉 ──────────────────────────────────────────────

export type Honorific = "先生" | "女士";

/** 主要收入型態 */
export type IncomeType = "固定薪" | "業務浮動" | "自營";

/** 家庭年收入級距(萬元 TWD) */
export type IncomeBand =
  | "<80"
  | "80-150"
  | "150-300"
  | "300-500"
  | "500-1000"
  | ">1000";

/** 每月結餘級距(萬元 TWD) */
export type SurplusBand =
  | "<1"
  | "1-3"
  | "3-6"
  | "6-10"
  | ">10"
  | "赤字"; // 入不敷出

/** 資金可用時間軸(多久內用不到) */
export type Horizon = "<1年" | "1-3年" | "3-5年" | "5-10年" | ">10年";

/** 規劃急迫性(leads 評分用,§5 新增題) */
export type Urgency = "3個月內" | "半年內" | "一年內" | "先看看";

/** 帳面虧 20% 的反應(KYC 核心行為題,§6.4) */
export type LossReaction = "加碼" | "續抱" | "部分贖回" | "全部出場";

// ── 資產盤點物件(§6.2) ────────────────────────────
// 每類「有無 + 概略金額(萬元)」。保單刻意拆兩類 — 本工具差異化關鍵。

export interface AssetItem {
  has: boolean;
  /** 概略金額,萬元 TWD;has=false 時為 0 */
  amount: number;
}

export interface Assets {
  cash: AssetItem; // 現金存款
  stock_tw: AssetItem; // 台股
  stock_overseas: AssetItem; // 海外股票
  fund_etf: AssetItem; // 基金 / ETF
  insurance_protection: AssetItem; // 保單:保障型
  insurance_savings: AssetItem; // 保單:儲蓄/投資型
  real_estate_own: AssetItem; // 不動產:自住
  real_estate_invest: AssetItem; // 不動產:投資
  other: AssetItem; // 其他(外幣/黃金/加密等)
}

/** 規劃範圍:個人 或 含配偶(家庭) */
export type PlanningScope = "個人" | "含配偶";

/** 子女就學身份 */
export type EduStage = "學前" | "幼兒園" | "國小" | "國中" | "高中" | "大專以上" | "已完成";

export interface Child {
  stage: EduStage;
  age?: number;
  /** 學前:預計幾年後就學 */
  years_until_school?: number;
}

/** 兄弟姊妹關係(隱含性別與長幼):兄/弟=男,姊/妹=女 */
export type SiblingRelation = "兄" | "弟" | "姊" | "妹";

/** 家庭 / 扶養結構(§6.2)。含遺產繼承順位相關成員。 */
export interface Dependents {
  children: Child[];
  /** 父母:人數 + 各自年齡 */
  parents: { count: number; ages: number[] };
  /** 兄弟姊妹(遺產第三順位繼承人,旁系):逐位關係 */
  siblings: { relation: SiblingRelation }[];
  /** 孫子女(代位繼承 / 傳承規劃,直系卑親屬):人數 */
  grandchildren: { count: number };
}

// ── 必填核心(§6.2) ──────────────────────────────────

export interface CoreProfile {
  age: number;
  retire_age: number;
  /** 規劃範圍;含配偶時填 spouse_age */
  planning_scope: PlanningScope;
  spouse_age?: number;
  dependents: Dependents;
  income_type: IncomeType;
  income_band: IncomeBand;
  surplus_band: SurplusBand;
  assets: Assets;
  horizon: Horizon;
  urgency: Urgency;
}

// ── 選填深化(§6.3) ─────────────────────────────────

// 子女高階教育規劃(大專以上)。就學時程由子女年齡自動推算,不再手填。
export interface EduGoal {
  overseas: boolean; // 是否有出國深造規劃
  annual_edu_budget: number; // 每年教育預算(萬)
  annual_living_budget: number; // 每年生活預算(萬)
  study_years?: number; // 就讀年數(預設 4)
}

export interface Liabilities {
  mortgage_balance: number; // 房貸餘額(萬元)
  loan_balance: number; // 其他貸款餘額(萬元)
  monthly_payment: number; // 月付(萬元)
  interest_rate?: number; // 平均利率(%)
  remaining_years?: number; // 剩餘年限
}

export interface InsuranceDetail {
  life: { has: boolean; coverage: number }; // 壽險:保額(萬)
  critical_illness: { has: boolean; coverage: number }; // 重大疾病:一次給付(萬)
  cancer_lump: { has: boolean; coverage: number }; // 癌症:單筆一次給付(萬)
  accident: { has: boolean; coverage: number }; // 意外:保額(萬)
  medical: { has: boolean; daily: number; reimburse_limit: number }; // 醫療:日額(元)+ 實支實付限額(萬)
  cancer_hospital: { has: boolean; daily: number }; // 癌症住院:日額(元,與一般住院日額分開)
  disability: { has: boolean; monthly: number }; // 失能:每月失能金(萬)
  long_term_care: { has: boolean; monthly: number }; // 長照:每月給付(萬)
}

/** 收入來源明細(年,萬元)。含被動收入(租金/股利/事業)。 */
export interface IncomeSources {
  salary: number; // 薪資
  bonus: number; // 獎金 / 佣金
  rental: number; // 租金收入(被動)
  dividend: number; // 股利 / 利息(被動)
  business: number; // 事業盈餘(被動 / 半被動)
  other: number; // 其他
}

export interface DeepProfile {
  income_sources?: IncomeSources; // 收入來源拆解(含被動收入)
  taxable_income?: number; // 綜合所得淨額(報稅用,萬);用於所得稅與稅後試算
  retire_lifestyle_pct?: number; // 退休後想維持目前開銷的幾成 (0-100+)
  retire_monthly_expense?: number; // 退休後每月預計支出(萬);有填則優先於生活水準%
  retire_pension_monthly?: number; // 退休後每月退休金收入(勞退/月退,萬)
  edu_goals?: EduGoal[]; // 每位子女
  major_expense?: { amount: number; years_until: number }; // 近期大額支出
  liabilities?: Liabilities;
  emergency_months?: number; // 緊急預備金(幾個月生活費)
  insurance_detail?: InsuranceDetail; // 本人保障
  spouse_insurance?: InsuranceDetail; // 配偶保障(家戶計算)
  children_insurance?: InsuranceDetail[]; // 各子女保障(家戶計算)
}

// ── KYC 風險(§6.4,行為題不用自評) ────────────────

export type ExpBand = "無經驗" | "1-3年" | "3-10年" | "10年以上";
export type Knowledge = "完全不了解" | "略懂" | "熟悉" | "專精";
export type VolatilityTolerance = "幾乎不能接受損失" | "可接受小幅波動" | "可接受中度波動" | "願承受大幅波動";
export type FundSource = "閒置資金" | "部分生活儲蓄" | "需動用生活費" | "借貸資金";
export type InvestGoal = "保本保值" | "穩定領息" | "資產增值" | "積極獲利";

/** KYC 行為題 — 客戶只回答行為與偏好;風險屬性由系統計算(不自評、不問投資占比) */
export interface KycProfile {
  exp_band?: ExpBand; // 投資經驗
  knowledge?: Knowledge; // 投資知識程度
  familiar_products?: string[]; // 熟悉哪些商品
  invest_goal?: InvestGoal; // 主要投資目的
  loss_reaction?: LossReaction; // 帳面虧 20% 的反應
  volatility_tolerance?: VolatilityTolerance; // 對波動的接受度
  fund_source?: FundSource; // 投資資金來源
}

// ── 完整客戶問卷資料 ────────────────────────────────

export interface ClientBasic {
  surname: string; // 只收姓氏
  honorific: Honorific;
  line_id?: string;
  mobile?: string;
  email?: string;
}

export interface QuestionnaireData {
  basic: ClientBasic;
  core: CoreProfile;
  deep?: DeepProfile;
  kyc?: KycProfile;
}
