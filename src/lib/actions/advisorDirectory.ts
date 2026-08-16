"use server";

// 顧問推薦名錄 — 供「未綁定顧問」的客戶挑選並綁定。
// 以 service_role 讀取安全欄位(客戶端不直接讀 advisors 表,RLS 仍限 advisor 只能讀自己)。
// 排序:featured(未來付費優先)→ verified(已驗證)→ 建立時間。
import { createServiceSupabase } from "@/lib/supabase/server";
import type { AdvisorLicense } from "@/lib/domain/licenses";

export interface RecommendedAdvisor {
  id: string;
  name: string;
  referralCode: string;
  licenses: AdvisorLicense[];
  verified: boolean;
  featured: boolean;
}

// 內部示範帳號不對外推薦
const DEMO_EMAIL_DOMAIN = "@aa-demo.internal";

export async function listRecommendedAdvisors(): Promise<RecommendedAdvisor[]> {
  const svc = createServiceSupabase();

  // 嘗試含 featured;若欄位尚未 migrate(0003)則退回不含 featured 版本
  const withFeatured = await svc
    .from("advisors")
    .select("id, email, display_name, full_name, referral_code, licenses, verified, featured, created_at");
  const res = withFeatured.error
    ? await svc.from("advisors").select("id, email, display_name, full_name, referral_code, licenses, verified, created_at")
    : withFeatured;

  type Row = {
    id: string;
    email: string | null;
    display_name: string | null;
    full_name: string | null;
    referral_code: string;
    licenses: AdvisorLicense[] | null;
    verified: boolean | null;
    featured?: boolean | null;
    created_at: string;
  };

  return ((res.data as Row[] | null) ?? [])
    .filter((a) => !(a.email ?? "").endsWith(DEMO_EMAIL_DOMAIN))
    .map((a) => ({
      id: a.id,
      name: a.full_name || a.display_name || "專業顧問",
      referralCode: a.referral_code,
      licenses: a.licenses ?? [],
      verified: !!a.verified,
      featured: !!a.featured,
    }))
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) || Number(b.verified) - Number(a.verified),
    );
}
