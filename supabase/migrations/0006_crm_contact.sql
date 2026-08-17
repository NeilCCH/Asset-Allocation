-- 顧問 CRM(跟進紀錄)+ 客戶預約聯繫。在 Supabase SQL Editor 執行。

-- ── 顧問 CRM:寫在 advisor_private(⛔ 僅綁定顧問可讀寫,客戶端讀不到) ──
alter table advisor_private add column if not exists lead_status   text;  -- 待聯繫 / 洽談中 / 已成交 / 擱置
alter table advisor_private add column if not exists advisor_notes text;  -- 跟進備註
alter table advisor_private add column if not exists next_follow_up date; -- 下次追蹤日

-- ── 客戶預約聯繫 ──
create table if not exists contact_requests (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients (id) on delete cascade,
  message        text,
  preferred_time text,                          -- 客戶偏好聯繫時間(自由文字)
  status         text not null default 'new',   -- new / handled
  created_at     timestamptz not null default now()
);
create index if not exists idx_contact_requests_client on contact_requests (client_id);

alter table contact_requests enable row level security;
-- 顧問可讀/更新名下客戶的預約(標記已處理)
create policy contact_advisor_all on contact_requests for all
  using (is_owning_advisor(client_id)) with check (is_owning_advisor(client_id));
-- 客戶(已登入)可讀自己的
create policy contact_self_select on contact_requests for select
  using (is_self_client(client_id));
-- 建立預約主要由 service_role(伺服器端)進行(客戶多未登入),不開放一般角色 insert
