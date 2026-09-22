"use server";

// 客戶帳號綁定 — 把先前(匿名經邀請連結)提交的 client 記錄綁到剛註冊/登入的帳號。
// 以 service_role 設定 clients.auth_user_id;僅在該記錄尚未綁定時允許,避免被冒領。
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

export async function linkClientAccount(
  clientId: string,
  submissionToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authClient = await createServerSupabase();
  const { data: auth } = await authClient.auth.getUser();
  if (!auth.user) return { ok: false, error: "尚未登入" };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionToken))
    return { ok: false, error: "缺少有效的提交憑證" };

  const svc = createServiceSupabase();
  // 僅綁定尚未綁定的記錄(auth_user_id 為 null)
  const { data: existing } = await svc
    .from("clients")
    .select("id, auth_user_id, submission_token")
    .eq("id", clientId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "找不到健檢記錄" };
  if (existing.submission_token !== submissionToken) return { ok: false, error: "提交憑證不符" };
  if (existing.auth_user_id && existing.auth_user_id !== auth.user.id)
    return { ok: false, error: "此記錄已綁定其他帳號" };

  if (existing.auth_user_id === auth.user.id) return { ok: true };
  const { data: linked, error } = await svc.from("clients").update({ auth_user_id: auth.user.id })
    .eq("id", clientId).eq("submission_token", submissionToken).is("auth_user_id", null).select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!linked) return { ok: false, error: "記錄已被綁定，請重新整理" };
  return { ok: true };
}
