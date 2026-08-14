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

/** 扶養結構(§6.2) */
export interface Dependents {
  children: { count: number; ages: number[] };
  support_parents: boolean; // 是否奉養父母
}

// ── 必填核心(§6.2) ──────────────────────────────────

export interface CoreProfile {
  age: number;
  retire_age: number;
  dependents: Dependents;
  income_type: IncomeType;
  income_band: IncomeBand;
  surplus_band: SurplusBand;
  assets: Assets;
  horizon: Horizon;
  urgency: Urgency;
}

// ── 選填深化(§6.3) ─────────────────────────────────

export interface EduGoal {
  years_until: number; // 幾年後
  location: "國內" | "海外";
}

export interface Liabilities {
  mortgage_balance: number; // 房貸餘額(萬元)
  loan_balance: number; // 其他貸款餘額(萬元)
  monthly_payment: number; // 月付(萬元)
}

export interface InsuranceDetail {
  medical: { has: boolean; coverage: number }; // 醫療
  critical_illness: { has: boolean; coverage: number }; // 重疾
  accident: { has: boolean; coverage: number }; // 意外
  life: { has: boolean; coverage: number }; // 壽險
  long_term_care: { has: boolean; coverage: number }; // 長照
}

export interface DeepProfile {
  retire_lifestyle_pct?: number; // 退休後想維持目前開銷的幾成 (0-100+)
  edu_goals?: EduGoal[]; // 每位子女
  major_expense?: { amount: number; years_until: number }; // 近期大額支出
  liabilities?: Liabilities;
  emergency_months?: number; // 緊急預備金(幾個月生活費)
  insurance_detail?: InsuranceDetail;
}

// ── KYC 風險(§6.4,行為題不用自評) ────────────────

export interface KycProfile {
  exp_years?: number; // 投資經驗年數
  familiar_products?: string[]; // 熟悉哪些商品
  loss_reaction?: LossReaction; // 核心指標
  investable_ratio?: number; // 可投資金額占總資產比重 (0-100)
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
