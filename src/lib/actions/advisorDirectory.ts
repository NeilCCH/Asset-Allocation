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
  website: string | null;
  facebook: string | null;
}

// 內部示範帳號不對外推薦
const DEMO_EMAIL_DOMAIN = "@aa-demo.internal";

export async function listRecommendedAdvisors(): Promise<RecommendedAdvisor[]> {
  const svc = createServiceSupabase();

  type Row = {
    id: string;
    email: string | null;
    display_name: string | null;
    full_name: string | null;
    referral_code: string;
    licenses: AdvisorLicense[] | null;
    verified: boolean | null;
    featured?: boolean | null;
    featured_until?: string | null;
    website?: string | null;
    facebook_url?: string | null;
    created_at: string;
  };

  // 逐段嘗試(欄位分屬不同 migration):含連結(0007)→ 含 featured(0003/0005)→ 基本。
  const base = "id, email, display_name, full_name, referral_code, licenses, verified, created_at";
  const selects = [
    `${base}, featured, featured_until, website, facebook_url`, // + 0007
    `${base}, featured, featured_until`, // 0003 + 0005
    base, // 皆無
  ];
  let rows: Row[] = [];
  for (const sel of selects) {
    const r = await svc.from("advisors").select(sel);
    if (!r.error) {
      rows = (r.data as unknown as Row[] | null) ?? [];
      break;
    }
  }

  const now = Date.now();
  return rows
    .filter((a) => !(a.email ?? "").endsWith(DEMO_EMAIL_DOMAIN))
    .map((a) => ({
      id: a.id,
      name: a.full_name || a.display_name || "專業顧問",
      referralCode: a.referral_code,
      licenses: a.licenses ?? [],
      verified: !!a.verified,
      // 有效付費 = featured 且未過期(年費到期後不再優先曝光)
      featured: !!a.featured && !!a.featured_until && new Date(a.featured_until).getTime() > now,
      website: a.website ?? null,
      facebook: a.facebook_url ?? null,
    }))
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) || Number(b.verified) - Number(a.verified),
    );
}
