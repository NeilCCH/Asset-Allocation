-- 顧問檔案新增:個人網頁、Facebook。供客戶端在推薦名錄中參考、聯繫。
-- 在 Supabase SQL Editor 執行。
alter table advisors add column if not exists website      text;
alter table advisors add column if not exists facebook_url text;
