-- 顧問付費方案 / 推薦名錄(未來向顧問收費的入口)
-- 在 Supabase SQL Editor 執行。
--
-- featured           = 已開通「付費推薦」(平台方核准後才為 true;顧問不可自行開通)
-- featured_requested = 顧問已提出升級申請(待平台開通)
--
-- 未綁定顧問的客戶只看到簡易報告,並在儀表板看到「推薦顧問」清單;
-- 推薦排序:featured(付費)→ verified(已驗證名片)→ 建立時間。
alter table advisors add column if not exists featured           boolean not null default false;
alter table advisors add column if not exists featured_requested boolean not null default false;

-- 開通某位顧問為付費推薦(平台方手動核准範例):
--   update advisors set featured = true, featured_requested = false where referral_code = 'WM-XXXXX';
