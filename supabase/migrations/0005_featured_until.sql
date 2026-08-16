-- 付費推薦:年費到期日。featured 有效 = featured=true 且 featured_until 尚未過期。
-- 管理員收款後手動開通(設 featured=true 且 featured_until = 今日 + 1 年)。
-- 在 Supabase SQL Editor 執行。
alter table advisors add column if not exists featured_until timestamptz;
