-- 顧問個人資料擴充 + 名片上傳(帳號驗證參考)
-- 在 Supabase SQL Editor 執行。

-- ── advisors 欄位調整 ──
alter table advisors drop column if exists firm_name;          -- 移除所屬事業體
alter table advisors add column if not exists full_name       text;  -- 完整姓名
alter table advisors add column if not exists mobile          text;  -- 手機
alter table advisors add column if not exists card_front_path text;  -- 名片正面(storage 路徑)
alter table advisors add column if not exists card_back_path  text;  -- 名片反面
alter table advisors add column if not exists verified        boolean not null default false; -- 名片人工核驗狀態

-- ── 名片私有儲存桶 ──
insert into storage.buckets (id, name, public)
values ('advisor-cards', 'advisor-cards', false)
on conflict (id) do nothing;

-- 儲存 RLS:顧問只能上傳/讀取自己資料夾(路徑首層 = auth.uid())
drop policy if exists "advisor upload own cards" on storage.objects;
create policy "advisor upload own cards" on storage.objects for insert to authenticated
  with check (bucket_id = 'advisor-cards' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "advisor read own cards" on storage.objects;
create policy "advisor read own cards" on storage.objects for select to authenticated
  using (bucket_id = 'advisor-cards' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "advisor update own cards" on storage.objects;
create policy "advisor update own cards" on storage.objects for update to authenticated
  using (bucket_id = 'advisor-cards' and (storage.foldername(name))[1] = auth.uid()::text);
