// 範例客戶資料 — 尚未接 Supabase 前,讓顧問後台有資料可展示。
// 接上資料庫後改由 questionnaire_responses 讀取。
import type { QuestionnaireData } from "@/lib/domain/types";

export interface MockClient {
  id: string;
  data: QuestionnaireData;
  createdAt: string;
}

export const MOCK_CLIENTS: MockClient[] = [
  {
    id: "c001",
    createdAt: "2026-08-10",
    data: {
      basic: { surname: "王", honorific: "先生", mobile: "0912-345-678", email: "wang@example.com", line_id: "wang888" },
      core: {
        age: 42, retire_age: 60,
        planning_scope: "含配偶", spouse_age: 40,
        dependents: { children: [{ stage: "國小", age: 8 }, { stage: "幼兒園", age: 5 }], parents: { count: 2, ages: [70, 68] }, siblings: [{ relation: "兄" }, { relation: "妹" }], grandchildren: { count: 0 } },
        income_type: "自營", income_band: "500-1000", surplus_band: ">10",
        horizon: "5-10年", urgency: "3個月內",
        assets: {
          cash: { has: true, amount: 300 }, stock_tw: { has: true, amount: 400 },
          stock_overseas: { has: true, amount: 250 }, fund_etf: { has: true, amount: 200 },
          insurance_protection: { has: true, amount: 60 }, insurance_savings: { has: true, amount: 300 },
          real_estate_own: { has: true, amount: 2000 }, real_estate_invest: { has: true, amount: 1500 },
          other: { has: true, amount: 100 },
        },
      },
      deep: {
        retire_lifestyle_pct: 80,
        edu_goals: [
          { overseas: true, annual_edu_budget: 80, annual_living_budget: 60 },
          { overseas: false, annual_edu_budget: 30, annual_living_budget: 20 },
        ],
        liabilities: { mortgage_balance: 800, loan_balance: 0, monthly_payment: 4 },
        emergency_months: 6,
        insurance_detail: {
          life: { has: true, coverage: 500 }, critical_illness: { has: true, coverage: 200 },
          cancer_lump: { has: true, coverage: 100 },
          accident: { has: true, coverage: 500 },
          medical: { has: true, daily: 3000, reimburse_limit: 20 },
          cancer_hospital: { has: false, daily: 0 },
          disability: { has: false, monthly: 0 },
          long_term_care: { has: false, monthly: 0 },
        },
        spouse_insurance: {
          life: { has: true, coverage: 300 }, critical_illness: { has: false, coverage: 0 },
          cancer_lump: { has: true, coverage: 50 }, accident: { has: true, coverage: 200 },
          medical: { has: true, daily: 2000, reimburse_limit: 15 }, cancer_hospital: { has: false, daily: 0 },
          disability: { has: false, monthly: 0 }, long_term_care: { has: false, monthly: 0 },
        },
        children_insurance: [
          { life: { has: false, coverage: 0 }, critical_illness: { has: false, coverage: 0 }, cancer_lump: { has: true, coverage: 30 }, accident: { has: true, coverage: 100 }, medical: { has: true, daily: 2000, reimburse_limit: 10 }, cancer_hospital: { has: false, daily: 0 }, disability: { has: false, monthly: 0 }, long_term_care: { has: false, monthly: 0 } },
          { life: { has: false, coverage: 0 }, critical_illness: { has: false, coverage: 0 }, cancer_lump: { has: false, coverage: 0 }, accident: { has: true, coverage: 100 }, medical: { has: true, daily: 1500, reimburse_limit: 10 }, cancer_hospital: { has: false, daily: 0 }, disability: { has: false, monthly: 0 }, long_term_care: { has: false, monthly: 0 } },
        ],
      },
      kyc: { exp_band: "10年以上", knowledge: "熟悉", familiar_products: ["股票", "基金/ETF"], invest_goal: "資產增值", loss_reaction: "續抱", volatility_tolerance: "可接受中度波動", fund_source: "閒置資金" },
    },
  },
  {
    id: "c002",
    createdAt: "2026-08-12",
    data: {
      basic: { surname: "林", honorific: "女士", mobile: "0922-111-222", email: "" },
      core: {
        age: 35, retire_age: 65,
        planning_scope: "個人",
        dependents: { children: [{ stage: "學前", age: 2, years_until_school: 4 }], parents: { count: 2, ages: [65, 63] }, siblings: [{ relation: "姊" }], grandchildren: { count: 0 } },
        income_type: "固定薪", income_band: "150-300", surplus_band: "3-6",
        horizon: "3-5年", urgency: "半年內",
        assets: {
          cash: { has: true, amount: 120 }, stock_tw: { has: true, amount: 80 },
          stock_overseas: { has: false, amount: 0 }, fund_etf: { has: true, amount: 60 },
          insurance_protection: { has: true, amount: 40 }, insurance_savings: { has: false, amount: 0 },
          real_estate_own: { has: true, amount: 900 }, real_estate_invest: { has: false, amount: 0 },
          other: { has: false, amount: 0 },
        },
      },
      deep: { emergency_months: 3 },
    },
  },
  {
    id: "c003",
    createdAt: "2026-08-13",
    data: {
      basic: { surname: "陳", honorific: "先生", line_id: "chen_life" },
      core: {
        age: 28, retire_age: 65,
        planning_scope: "個人",
        dependents: { children: [], parents: { count: 0, ages: [] }, siblings: [{ relation: "兄" }, { relation: "弟" }, { relation: "妹" }], grandchildren: { count: 0 } },
        income_type: "業務浮動", income_band: "80-150", surplus_band: "1-3",
        horizon: ">10年", urgency: "先看看",
        assets: {
          cash: { has: true, amount: 30 }, stock_tw: { has: true, amount: 15 },
          stock_overseas: { has: false, amount: 0 }, fund_etf: { has: false, amount: 0 },
          insurance_protection: { has: false, amount: 0 }, insurance_savings: { has: false, amount: 0 },
          real_estate_own: { has: false, amount: 0 }, real_estate_invest: { has: false, amount: 0 },
          other: { has: true, amount: 5 },
        },
      },
    },
  },
];

export function getMockClient(id: string): MockClient | undefined {
  return MOCK_CLIENTS.find((c) => c.id === id);
}
