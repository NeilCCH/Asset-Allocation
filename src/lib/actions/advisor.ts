"use server";

// 顧問端 server actions — 建立/讀取顧問檔案。受 RLS 約束(只能寫自己 id = auth.uid())。
import { createServerSupabase } from "@/lib/supabase/server";
import type { AdvisorLicense } from "@/lib/domain/licenses";

function genReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去除易混淆字元
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `WM-${s}`;
}

export interface AdvisorProfile {
  id: string;
  email: string;
  display_name: string | null;
  full_name: string | null;
  mobile: string | null;
  referral_code: string;
  licenses: AdvisorLicense[];
  card_front_path: string | null;
  card_back_path: string | null;
  verified: boolean;
}

/** 建立顧問檔案(註冊後呼叫)。需已有登入 session。 */
export async function createAdvisorProfile(input: {
  fullName: string;
  mobile: string;
  licenses: AdvisorLicense[];
  cardFrontPath?: string;
  cardBackPath?: string;
}): Promise<{ ok: true; referralCode: string } | { ok: false; error: string }> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "尚未登入,無法建立顧問檔案" };

  // 已存在則不重複建立
  const { data: existing } = await supabase.from("advisors").select("referral_code").eq("id", auth.user.id).maybeSingle();
  if (existing) return { ok: true, referralCode: existing.referral_code };

  // 產生唯一推薦碼(碰撞則重試)
  for (let attempt = 0; attempt < 6; attempt++) {
    const referral_code = genReferralCode();
    const { error } = await supabase.from("advisors").insert({
      id: auth.user.id,
      email: auth.user.email,
      display_name: input.fullName,
      full_name: input.fullName,
      mobile: input.mobile,
      referral_code,
      licenses: input.licenses,
      card_front_path: input.cardFrontPath ?? null,
      card_back_path: input.cardBackPath ?? null,
    });
    if (!error) return { ok: true, referralCode: referral_code };
    if (error.code !== "23505") return { ok: false, error: error.message }; // 非唯一鍵衝突則直接回報
    // 23505 唯一鍵衝突 → 可能撞 referral_code,重試
  }
  return { ok: false, error: "推薦碼產生失敗,請重試" };
}

import type { CalcParams } from "@/lib/domain/params";

/** 儲存顧問工作台 — 建議 + 勾選的配置面向 + 試算參數覆寫。⚠️ 寫入 advisor_private(RLS 限本顧問)。 */
export async function saveAdvisorWorkbench(input: {
  clientId: string;
  recommendation: string;
  dimensionKeys: string[];
  paramsOverride?: Partial<CalcParams>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "尚未登入" };
  const { error } = await supabase.from("advisor_private").upsert(
    {
      client_id: input.clientId,
      allocation_framework: { dimensions: input.dimensionKeys },
      advisor_recommendation: input.recommendation,
      calc_params_override: input.paramsOverride ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface AdvisorWorkbenchData {
  recommendation: string;
  dimensionKeys: string[];
  paramsOverride: Partial<CalcParams>;
}

/** 讀取已儲存的工作台內容(RLS 限本顧問名下客戶) */
export async function getAdvisorWorkbench(clientId: string): Promise<AdvisorWorkbenchData | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("advisor_private")
    .select("advisor_recommendation, allocation_framework, calc_params_override")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) return null;
  const framework = data.allocation_framework as { dimensions?: string[] } | null;
  return {
    recommendation: data.advisor_recommendation ?? "",
    dimensionKeys: framework?.dimensions ?? [],
    paramsOverride: (data.calc_params_override as Partial<CalcParams>) ?? {},
  };
}

/** 讀取目前登入顧問的檔案 */
export async function getMyAdvisor(): Promise<AdvisorProfile | null> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("advisors")
    .select("id, email, display_name, full_name, mobile, referral_code, licenses, card_front_path, card_back_path, verified")
    .eq("id", auth.user.id)
    .maybeSingle();
  return (data as AdvisorProfile) ?? null;
}
