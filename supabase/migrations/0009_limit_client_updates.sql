-- RLS 限制可更新的列；欄位權限另外禁止客戶改顧問、同意紀錄或帳號歸屬。
revoke update on public.clients from authenticated;
grant update (surname, honorific, mobile, line_id, email) on public.clients to authenticated;

-- 問卷由伺服器驗證並寫入，避免客戶繞過伺服器的摘要計算直接改 JSON。
drop policy if exists qr_self_all on public.questionnaire_responses;
create policy qr_self_select on public.questionnaire_responses for select
  using (is_self_client(client_id));
