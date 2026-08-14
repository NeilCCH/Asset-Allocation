# 資安與客戶資料隱私

## 資料存放位置
- 客戶資料存於 **Supabase 託管 PostgreSQL**(底層 AWS),實體落在建立專案時選定的**區域**。
  - 建議選 **東京(ap-northeast-1)** 或 **新加坡**,便於向客戶交代資料落地。
- 開發者本機**只存程式碼**,不存任何客戶資料。

## 已內建的安全控制
- **傳輸加密**:全程 TLS/HTTPS(Supabase 強制)。
- **靜態加密**:Supabase at-rest AES-256。
- **資料庫層隔離(RLS)**:客戶連線物理上讀不到 `advisor_private`(配置建議 + leads 評分);顧問僅見名下客戶。詳見 [COMPLIANCE.md](./COMPLIANCE.md)。
- **密碼**:由 Supabase Auth 雜湊處理,系統不儲存、不接觸明文。
- **金鑰隔離**:`SUPABASE_SERVICE_ROLE_KEY` 僅伺服器端使用,無 `NEXT_PUBLIC_` 前綴;`.env*` 已被 `.gitignore` 排除,git 未追蹤任何金鑰。
- **資料最小化**:只收姓氏(非全名);PDPA 同意閘門 + 時戳 + 版本;刪除採 cascade。

## 上線前待補(正式營運就緒清單)
- [ ] Supabase Pro + 簽署 DPA(資料處理協議)— 併入 §11 法遵簽核。
- [ ] 選定並記錄資料落地區域。
- [ ] 顧問帳號 MFA(雙因素驗證)。
- [ ] 敏感欄位(手機/Email)應用層加密(進階)。
- [ ] 存取稽核日誌。
- [ ] PDPA 當事人權利自助流程(查詢 / 更正 / 刪除)。
- [ ] 正式部署 HTTPS(Vercel 免費層自帶)。
- [ ] 定期備份與還原演練。

## 開發守則
- 絕不將 `.env.local` 或任何金鑰提交至 git。
- `service_role` 金鑰只出現在伺服器端程式碼路徑。
- 新增蒐集欄位前,先確認是否對應一個運算輸出(PRD §6 原則),避免過度蒐集。
