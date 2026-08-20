// 風險屬性評估 — 由系統依「行為題(承受意願)」+「客觀資料(承受能力)」計算,
// 客戶不自評。承受能力與意願取其低(prudent),對應 RR1–RR5 / 保守~積極型。
import type { QuestionnaireData } from "./types";
import { investableAssets, riskAssetBreakdown, sumAssets } from "./calc";

export interface RiskAssessment {
  capacity: number; // 承受能力 0-100
  tolerance: number; // 承受意願 0-100
  score: number; // 綜合(取低者)
  profile: string; // 保守型 / 保守穩健型 / 穩健型 / 穩健積極型 / 積極型
  rr: 1 | 2 | 3 | 4 | 5;
  capacityFactors: { label: string; val: number }[];
  toleranceFactors: { label: string; val: number }[];
  investableRatio: number; // 系統自算(可投資資產 / 總資產)
}

const avg = (arr: { val: number }[]) => (arr.length ? Math.round(arr.reduce((s, x) => s + x.val, 0) / arr.length) : 0);

const HORIZON: Record<string, number> = { "<1年": 20, "1-3年": 40, "3-5年": 60, "5-10年": 80, ">10年": 100 };
const INCOME_STABILITY: Record<string, number> = { 固定薪: 80, 業務浮動: 50, 自營: 60 };
const KNOWLEDGE: Record<string, number> = { 完全不了解: 20, 略懂: 45, 熟悉: 70, 專精: 95 };
const EXP: Record<string, number> = { 無經驗: 20, "1-3年": 45, "3-10年": 70, "10年以上": 95 };
const LOSS: Record<string, number> = { 全部出場: 10, 部分贖回: 40, 續抱: 70, 加碼: 100 };
const VOL: Record<string, number> = { 幾乎不能接受損失: 15, 可接受小幅波動: 45, 可接受中度波動: 70, 願承受大幅波動: 95 };
const GOAL: Record<string, number> = { 保本保值: 20, 穩定領息: 45, 資產增值: 70, 積極獲利: 95 };
const FUND: Record<string, number> = { 借貸資金: 5, 需動用生活費: 25, 部分生活儲蓄: 55, 閒置資金: 90 };

export function assessRisk(data: QuestionnaireData): RiskAssessment | null {
  const kyc = data.kyc;
  if (!kyc) return null;
  const core = data.core;

  // ── 承受能力(客觀) ──
  const yearsToRetire = Math.max(0, core.retire_age - core.age);
  const ageScore = yearsToRetire >= 20 ? 100 : yearsToRetire >= 15 ? 80 : yearsToRetire >= 10 ? 60 : yearsToRetire >= 5 ? 40 : 20;
  const total = sumAssets(core.assets);
  const investableRatio = total > 0 ? Math.round((investableAssets(core.assets) / total) * 100) : 0;
  const ratioScore = investableRatio < 10 ? 40 : investableRatio <= 30 ? 70 : investableRatio <= 70 ? 100 : 80;
  const em = data.deep?.emergency_months;
  const emScore = em == null ? 55 : em >= 6 ? 100 : em >= 3 ? 70 : 40;

  const capacityFactors = [
    { label: "距退休年數", val: ageScore },
    { label: "資金可用時間", val: HORIZON[core.horizon] ?? 50 },
    { label: "收入穩定度", val: INCOME_STABILITY[core.income_type] ?? 50 },
    { label: "可投資資產占比(自算)", val: ratioScore },
    { label: "緊急預備金", val: emScore },
  ];
  const capacity = avg(capacityFactors);

  // ── 承受意願(行為題) ──
  const toleranceFactors = [
    { label: "投資知識", val: KNOWLEDGE[kyc.knowledge ?? ""] ?? 40 },
    { label: "投資經驗", val: EXP[kyc.exp_band ?? ""] ?? 40 },
    { label: "虧損反應", val: LOSS[kyc.loss_reaction ?? ""] ?? 40 },
    { label: "波動接受度", val: VOL[kyc.volatility_tolerance ?? ""] ?? 40 },
    { label: "投資目的", val: GOAL[kyc.invest_goal ?? ""] ?? 40 },
    { label: "資金來源", val: FUND[kyc.fund_source ?? ""] ?? 40 },
  ];
  const tolerance = avg(toleranceFactors);

  // 綜合:取低者(承受能力與意願取其低)
  const score = Math.min(capacity, tolerance);
  const { profile, rr } = classify(score);

  return { capacity, tolerance, score, profile, rr, capacityFactors, toleranceFactors, investableRatio };
}

// ── 風險資產配置分析(⚠️ 顧問專屬:含 RR 與目標配置,屬顧問決策輔助)──
// 依風險屬性 RR 給「風險投資占風險資產」之參考目標區間,對照現況算落差(缺口)。
const TARGET_RISKY_BY_RR: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 20, 2: 35, 3: 50, 4: 65, 5: 80 };

export interface RiskAllocationAnalysis {
  rr: 1 | 2 | 3 | 4 | 5;
  profile: string;
  riskTotal: number;
  stablePct: number;
  currentRiskyPct: number; // 現況:風險投資占風險資產
  targetRiskyPct: number; // 依 RR 之參考目標
  gap: number; // 現況 − 目標(正=偏積極,負=偏保守)
  status: "偏積極" | "偏保守" | "相符";
}

export function riskAllocationAnalysis(data: QuestionnaireData): RiskAllocationAnalysis | null {
  const risk = assessRisk(data);
  if (!risk) return null;
  const ra = riskAssetBreakdown(data.core.assets);
  if (ra.total <= 0) return null;
  const targetRiskyPct = TARGET_RISKY_BY_RR[risk.rr];
  const gap = ra.riskyPct - targetRiskyPct;
  const status = Math.abs(gap) <= 10 ? "相符" : gap > 0 ? "偏積極" : "偏保守";
  return { rr: risk.rr, profile: risk.profile, riskTotal: ra.total, stablePct: ra.stablePct, currentRiskyPct: ra.riskyPct, targetRiskyPct, gap, status };
}

function classify(score: number): { profile: string; rr: 1 | 2 | 3 | 4 | 5 } {
  if (score < 30) return { profile: "保守型", rr: 1 };
  if (score < 45) return { profile: "保守穩健型", rr: 2 };
  if (score < 60) return { profile: "穩健型", rr: 3 };
  if (score < 78) return { profile: "穩健積極型", rr: 4 };
  return { profile: "積極型", rr: 5 };
}
