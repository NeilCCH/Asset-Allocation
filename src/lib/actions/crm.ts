"use server";

// 客戶預約聯繫 + 顧問 CRM 跟進。
// - requestContact:客戶端(多未登入)以 service_role 建立預約,寫入 contact_requests。
// - CRM(狀態/備註/追蹤日)寫在 advisor_private(RLS 限本顧問),客戶端讀不到。
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

/** 客戶送出「請顧問聯繫我 / 預約諮詢」。clientId 來自本機(綁定後儲存)。 */
export async function requestContact(input: {
  clientId: string;
  message?: string;
  preferredTime?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const svc = createServiceSupabase();
  // 確認 client 存在(避免任意 id)
  const { data: client } = await svc.from("clients").select("id").eq("id", input.clientId).maybeSingle();
  if (!client) return { ok: false, error: "找不到你的健檢記錄,請重新完成綁定" };
  const { error } = await svc.from("contact_requests").insert({
    client_id: input.clientId,
    message: input.message?.trim() || null,
    preferred_time: input.preferredTime?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface ContactRequestRow {
  id: string;
  message: string | null;
  preferred_time: string | null;
  status: string;
  created_at: string;
}

export interface ClientCrm {
  leadStatus: string | null;
  notes: string;
  nextFollowUp: string | null;
  contacts: ContactRequestRow[];
}

/** 顧問讀取某客戶的 CRM(狀態/備註/追蹤日)+ 預約清單。RLS 限本顧問名下。 */
export async function getClientCrm(clientId: string): Promise<ClientCrm> {
  const supabase = await createServerSupabase();
  const { data: priv } = await supabase
    .from("advisor_private")
    .select("lead_status, advisor_notes, next_follow_up")
    .eq("client_id", clientId)
    .maybeSingle();
  const { data: contacts } = await supabase
    .from("contact_requests")
    .select("id, message, preferred_time, status, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return {
    leadStatus: (priv?.lead_status as string) ?? null,
    notes: (priv?.advisor_notes as string) ?? "",
    nextFollowUp: (priv?.next_follow_up as string) ?? null,
    contacts: (contacts as ContactRequestRow[]) ?? [],
  };
}

/** 顧問儲存 CRM。寫入 advisor_private(RLS 限本顧問)。 */
export async function saveClientCrm(input: {
  clientId: string;
  leadStatus: string;
  notes: string;
  nextFollowUp: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "尚未登入" };
  const { error } = await supabase.from("advisor_private").upsert(
    {
      client_id: input.clientId,
      lead_status: input.leadStatus,
      advisor_notes: input.notes,
      next_follow_up: input.nextFollowUp,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 顧問把預約標記為已處理。RLS 限本顧問名下。 */
export async function markContactHandled(requestId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("contact_requests").update({ status: "handled" }).eq("id", requestId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * 顧問刪除自己名下客戶。⚠️ 不可復原:連動清除問卷作答 / 彙整結果 / CRM 備註 / 預約紀錄(FK cascade)。
 * RLS(clients_advisor_all)僅允許刪除 advisor_id = 本人 的客戶;另做明確擁有權檢查回明確錯誤。
 */
export async function deleteClient(clientId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "尚未登入" };
  const { data: client } = await supabase.from("clients").select("id, advisor_id").eq("id", clientId).maybeSingle();
  if (!client || client.advisor_id !== auth.user.id) return { ok: false, error: "找不到客戶,或你沒有刪除權限" };
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
