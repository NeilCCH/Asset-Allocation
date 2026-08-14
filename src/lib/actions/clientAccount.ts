"use server";

// 客戶帳號綁定 — 把先前(匿名經邀請連結)提交的 client 記錄綁到剛註冊/登入的帳號。
// 以 service_role 設定 clients.auth_user_id;僅在該記錄尚未綁定時允許,避免被冒領。
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

export async function linkClientAccount(
  clientId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authClient = await createServerSupabase();
  const { data: auth } = await authClient.auth.getUser();
  if (!auth.user) return { ok: false, error: "尚未登入" };

  const svc = createServiceSupabase();
  // 僅綁定尚未綁定的記錄(auth_user_id 為 null)
  const { data: existing } = await svc
    .from("clients")
    .select("id, auth_user_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "找不到健檢記錄" };
  if (existing.auth_user_id && existing.auth_user_id !== auth.user.id)
    return { ok: false, error: "此記錄已綁定其他帳號" };

  const { error } = await svc.from("clients").update({ auth_user_id: auth.user.id }).eq("id", clientId).is("auth_user_id", null);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
