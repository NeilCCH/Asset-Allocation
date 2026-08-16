-- 顧問推薦名錄:付費優先旗標(未來向顧問收費後,featured 者優先推薦給未綁定客戶)
-- 在 Supabase SQL Editor 執行。
alter table advisors add column if not exists featured boolean not null default false;

-- 說明:未綁定顧問的客戶只看到簡易報告,並在儀表板看到「推薦顧問」清單。
-- 推薦排序:featured(付費)→ verified(已驗證名片)→ 建立時間。
-- 名錄由伺服器端 service_role 讀取安全欄位(姓名/證照/驗證狀態/推薦碼),
-- 不開放客戶端直接讀 advisors 表(RLS 仍限 advisor 只能讀自己)。
