# 專案交接文件(HANDOFF)— 資產配置管理 APP

> 目的:讓任何助手/開發者(含 claude.ai 新對話)能無縫接續本專案。
> 最後更新:2026-08-18

---

## 1. 這是什麼

**財富管理顧問**用的「資產配置檢視 / 試算 / 教育」工具(**非投資推介**)。
客戶填問卷 → 系統彙整「事實層」與缺口試算;**配置面向建議、leads 分級僅顧問後台可見**,以 Supabase RLS 在資料庫層物理隔離(合規核心)。

**商業模式:向顧問收費(年費制)**。顧問申請「付費推薦」→ 管理員收款後手動「開通一年」→ 到期自動失效可續約。

---

## 2. 座標(雲端資源)

| 項目 | 位置 |
|---|---|
| 正式站 | https://asset-allocation-delta.vercel.app |
| GitHub(私有) | `NeilCCH/Asset-Allocation`,分支 `main`(push 即自動部署) |
| Vercel 專案 | `asset-allocation`(帳號 neil-cch)。舊的重複專案 `asset-allocation-sg5s` 已刪 |
| Supabase ref | `iraiqnhxfttdanhmwdtj` |
| 本機工作目錄 | `/Users/neo/新專案作業區/asset-allocation-app`(Node 由 Homebrew 裝於 `/opt/homebrew/bin`) |

---

## 3. 技術棧與**重要地雷**

- **Next.js 16**(App Router, Turbopack)。⚠️ middleware 改名為 **`proxy.ts`**(`export function proxy`),見 `AGENTS.md`。
- **Tailwind v4**(`@import "tailwindcss"`);**全站字級放大 1.5×**(`globals.css` 的 `html { font-size:150% }`)。
- **Supabase**(Postgres + Auth + RLS + Storage),`@supabase/ssr`。
- 報告用**純內嵌 SVG + `.hcr` px 樣式**(列印友善);字級另在元件內 ×1.5(不吃 rem)。
- 客戶端 **OCR** 用 Tesseract.js(瀏覽器端、免 token、影像不離裝置)。

### 已修過、會再踩的坑
- **PostgREST 巢狀 embed 形狀**:`questionnaire_responses.client_id`、`advisor_private.client_id` 有 `unique` → 巢狀回傳**物件**而非陣列。取值一律相容物件/陣列(`firstQR`/`firstPriv` helper)。
- **舊 schema 客戶資料**:早期 `dependents` 形狀不同(`children` 存成 `{count,ages}`)。**一律經 `lib/domain/normalize.ts` 正規化**再進 domain 計算,否則 `estateTax`/`buildReport` 會 TypeError 整頁崩潰。
- **`parents` 模型已改為陣列** `[{relation:"父"|"母", age}]`(對齊 `siblings`);`normalize` 會把舊格式 `{count,ages}` 自動轉為父/母。所有消費端用 `parents.length`(非 `.count`)。
- **報告列印縮放**:`HealthCheckReport` 的 `@media print` 用 `.hcr { zoom:0.65 }`(僅列印,螢幕不變)。
- **投資型保單只計帳戶價值**:`insurance_savings.amount` = 帳戶/現金價值(非保額);保額在 `insurance_detail` 僅供保障缺口,不進資產統計。
- **getMyAdvisor 逐段 select**:0003/0004/0005 欄位分段嘗試查詢,任一 migration 未跑也能讀到其他段。
- **localStorage 全包 try/catch**(iOS 無痕會丟例外)。
- **送出防連點用 `useRef`**(state 有閉包時間差,快速雙擊會重複建檔)。
- **登入按鈕勿以空值 disabled**(iOS autofill 不觸發 onChange)→ 改 ref 讀 DOM 值。
- **登入持久化**:三個 Supabase client 都設 `cookieOptions.maxAge`(否則當 session cookie,關閉即失效)。**登出用 `window.location` 硬導向**確保清乾淨。

---

## 4. 角色與主要路由

- **客戶** `/client`(問卷)→ `/client/dashboard`(事實層;**未綁顧問只給簡易版 + 推薦顧問解鎖卡**);帳號 `/client/account`
- **顧問** `/advisor`(登入/註冊,需證照+名片)→ `/advisor/dashboard`(客戶清單+資產分層 HNW+CRM 狀態+總覽數字)、`/advisor/profile`、`/advisor/clients/[id]`(詳情+CRM 面板)、`/advisor/clients/[id]/report`(可調參數即時重算的報告)
- **管理員** `/admin/advisors`(僅 `ADMIN_EMAILS` 名單;開通/停用付費顧問年費)
- **密碼**:登入頁「忘記密碼?」→ 寄信 → `/reset-password`;登入後可「修改密碼」

---

## 5. 資料模型 / Migrations(依序執行於 Supabase SQL Editor)

- `0001_init.sql` — schema + RLS(合規隔離核心:advisors / clients / questionnaire_responses / client_summaries / **advisor_private**〔顧問專屬,客戶端永讀不到〕)
- `0002_advisor_card_and_fields.sql` — 顧問名片 + storage bucket
- `0003_advisor_featured.sql` — 付費推薦 `featured` / `featured_requested`
- `0004_advisor_company_title.sql` — 顧問 `company_name` / `job_title`
- `0005_featured_until.sql` — 付費年費到期日
- `0006_crm_contact.sql` — CRM(`advisor_private.lead_status/advisor_notes/next_follow_up`)+ `contact_requests` 表(客戶預約)
- `0007_advisor_links.sql` — 顧問 `website` / `facebook_url`(客戶端推薦卡顯示連結)

### 必要環境變數(Vercel 專案 + 本機 `.env.local`)
`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`(機密,勿放雲端備份)、`ADMIN_EMAILS`(管理員白名單,含 `neo0935@gmail.com`)。
Supabase Auth → URL Configuration:Site URL 設正式站;Redirect URLs 加 `.../reset-password`。

---

## 6. 已完成功能(重點)

**核心**
- 客戶問卷(7 步,含 PDPA)、事實層儀表板、簡易 vs 完整報告
- 缺口試算(退休/保障/教育)、遺產稅、綜所稅、風險屬性(KYC 系統計算)、資產分層(HNW)
- 家庭財務三表、家族關係圖(genogram)、**民法法定繼承順位**提示
- 顧問後台:客戶清單、邀請連結、可調參數即時重算報告、配置面向勾選、報告顧問署名(公司/職稱/證照分類)
- **付費方案**(年費制)+ 管理員開通後台
- **未綁顧問客戶 → 簡易報告 + 推薦顧問一鍵綁定**
- **客戶預約諮詢 + 顧問 CRM**(跟進狀態/備註/追蹤日)+ 後台總覽數字
- 忘記/修改密碼、登入持久化、確認式登出

**2026-08-18 這批(以下皆已上線,部分待實機驗證)**
- 顧問資料:**個人網頁 / Facebook** 欄位(客戶推薦卡顯示可點連結,migration 0007)
- 顧問證照:抽出共用 **`LicenseSelector`**(依保險/理財認證/信託投顧三分類),註冊與編輯共用
- 顧問徽章 **`advisorBadges` + `Badges.tsx`**:專業徽章(依證照分類,集滿三類→「全方位顧問」金徽章)+ 檔案完成度卡(進度條+尚缺提示)。**「積極度」刻意未做**(需行為數據,另議)
- 客戶 **`/client/account` 登入後為個人資料頁**(改手機/LINE/Email 聯絡資料 + 改密碼)
- **無推薦碼客戶延後註冊**:首次填問卷/看儀表板免 email;只有「連結顧問 / 產出報告」才要求註冊(登入頁支援 `?next=` 導回)
- **首頁選項頁登入提醒**:已登入者回首頁彈出「確認登出」對話框
- 客戶預約**時段改選擇制**(上午 10:00/11:00,下午 14:00/15:00/16:00)
- **客戶投資組合分析**(儀表板+報告):投資類分項占比;**投資型保單只計帳戶價值**、保額不列入
- **父母資料逐位選父/母 + 年齡**(`parents` 改陣列;家族圖依 relation 顯示)
- **每月固定收支明細**(收支步驟,選填,萬/月;建議項含租金支出等)→ 報告現金流量表呈現明細與合計
- 報告視覺:淡色區塊填充、色系收斂、顧問面向改淡綠卡(去文字符號感)、**列印縮 65%**(螢幕不變)

---

## 7. 待辦 / Backlog

- **2026-08-18 這批功能待正式站實機驗證**(顧問徽章/證照分類版面、報告顧問面向、列印 65%、父母父/母、延後註冊整條、首頁登出提醒、每月固定收支)
- **登入登出手機端最終驗證**(cookie maxAge + 硬導向登出;iOS Safari cookie 政策若仍掉登入,需改持久化策略)
- 報告 PDF 後端自動產出 + 寄客戶(思源字型內嵌)
- 自動金流(綠界/藍新)取代管理員手動開通
- 客戶清單搜尋/篩選/排序;新客戶綁定 Email 通知顧問
- 合規:客戶端推薦顧問排序透明化(featured=付費,建議標示或只當同分加權)

---

## 8. 在 claude.ai 接續的方式

1. 到 claude.ai 建一個 **Project**,連結 GitHub repo `NeilCCH/Asset-Allocation`(或上傳本檔 `HANDOFF.md`)。
2. 新對話開頭貼:「請依 repo 根目錄的 `HANDOFF.md` 接續本專案」。
3. 注意:claude.ai 網頁環境**無本機檔案系統/終端機**,適合討論、讀 repo、產草稿;要實際跑 `npm`/部署仍需在本機 Claude Code 或有終端機的環境。
