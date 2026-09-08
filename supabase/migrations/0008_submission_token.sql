-- 送出去重:以「隨機送出識別碼」(非個資)判斷同一人重複送出。
-- 同一顧問下、同一 token 的重複送出視為同一人 → 更新既有客戶,而非新增。
-- 完全不使用手機/email/姓名等個資作為比對鍵(PDPA:避免以敏感個資勾稽)。

alter table clients add column if not exists submission_token text;

-- 部分唯一索引:同顧問內 token 唯一;token 為 NULL(舊資料/無痕模式)不受限,可並存。
create unique index if not exists uq_clients_advisor_submission_token
  on clients (advisor_id, submission_token)
  where submission_token is not null;
