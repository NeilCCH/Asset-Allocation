"use server";

// 平台管理員 — 顧問付費推薦(年費)開通/停用。以 email 白名單(ADMIN_EMAILS)把關,
// 通過後以 service_role 更新任一顧問的 featured / featured_until。
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

async function requireAdmin(): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  return !!auth.user && isAdminEmail(auth.user.email);
}

export interface AdminAdvisorRow {
  id: string;
  email: string;
  name: string;
  referral_code: string;
  company_name: string | null;
  job_title: string | null;
  verified: boolean;
  featured: boolean;
  featured_until: string | null;
  featured_requested: boolean;
}

export async function listAdvisorsForAdmin(): Promise<
  { ok: true; advisors: AdminAdvisorRow[] } | { ok: false; error: string }
> {
  if (!(await requireAdmin())) return { ok: false, error: "非管理員" };
  const svc = createServiceSupabase();
  // featured_until 屬 migration 0005;未執行時退回不含此欄位版本(仍可列出顧問)
  const full = "id, email, full_name, display_name, referral_code, company_name, job_title, verified, featured, featured_until, featured_requested";
  const withUntil = await svc.from("advisors").select(full).order("featured_requested", { ascending: false }).order("featured", { ascending: false });
  const { data, error } = withUntil.error
    ? await svc
        .from("advisors")
        .select("id, email, full_name, display_name, referral_code, company_name, job_title, verified, featured, featured_requested")
        .order("featured_requested", { ascending: false })
    : withUntil;
  if (error) return { ok: false, error: "請先在 Supabase 執行 migration 0005(featured_until):" + error.message };
  type Row = {
    id: string; email: string; full_name: string | null; display_name: string | null; referral_code: string;
    company_name: string | null; job_title: string | null; verified: boolean | null; featured: boolean | null;
    featured_until: string | null; featured_requested: boolean | null;
  };
  return {
    ok: true,
    advisors: ((data as Row[] | null) ?? []).map((a) => ({
      id: a.id,
      email: a.email,
      name: a.full_name || a.display_name || a.email,
      referral_code: a.referral_code,
      company_name: a.company_name,
      job_title: a.job_title,
      verified: !!a.verified,
      featured: !!a.featured,
      featured_until: a.featured_until,
      featured_requested: !!a.featured_requested,
    })),
  };
}

/** 開通付費推薦:自今日起 months 個月(年費 = 12)。清除申請旗標。 */
export async function grantFeatured(advisorId: string, months = 12): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "非管理員" };
  const until = new Date();
  until.setMonth(until.getMonth() + months);
  const svc = createServiceSupabase();
  const { error } = await svc
    .from("advisors")
    .update({ featured: true, featured_until: until.toISOString(), featured_requested: false })
    .eq("id", advisorId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 停用付費推薦。 */
export async function revokeFeatured(advisorId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "非管理員" };
  const svc = createServiceSupabase();
  const { error } = await svc.from("advisors").update({ featured: false, featured_until: null }).eq("id", advisorId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
