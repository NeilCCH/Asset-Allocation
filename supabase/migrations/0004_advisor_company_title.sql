-- 顧問檔案新增:公司名稱、職稱。並提供登入後編輯個人資料。
-- 在 Supabase SQL Editor 執行。
alter table advisors add column if not exists company_name text;
alter table advisors add column if not exists job_title   text;
