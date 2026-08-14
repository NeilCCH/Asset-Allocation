# 資產配置健檢 — 財富管理顧問工具

跨資產類別的**配置檢視與缺口試算**工具。客戶輸入資產現況,系統彙整出全貌與缺口;由具專業資格的**財富管理顧問**依此提供規劃建議。

> **定位:檢視 · 試算 · 教育,非投資推介。** 系統只到資產類別 / 配置面向層級,不推介任何單一金融商品。

## 合規設計(最高優先)

系統在**資料庫層(Supabase RLS)**物理隔離兩種可見性:

- **客戶端**只見「事實層」:資產分布、保障 vs 投資、缺口概況。
- **顧問後台**才見:leads A/B/C 評分、配置面向參考框架、顧問建議。客戶端**永遠讀不到**這些。

詳見 [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) 與 [`docs/SECURITY.md`](docs/SECURITY.md)。

## 技術棧

| 面向 | 選型 |
|------|------|
| 前端 / 後端 | Next.js 16(App Router)+ TypeScript |
| 樣式 | Tailwind CSS v4 |
| 圖表 | Recharts |
| 資料庫 / Auth | Supabase(Postgres + Auth + RLS) |
| PDF | 後端無頭瀏覽器列印 + 內嵌思源字型 |

## 本地啟動

需要 Node.js 20+。

```bash
npm install
cp .env.local.example .env.local   # 然後填入 Supabase 金鑰(見下)
npm run dev                        # http://localhost:3000
```

### 環境變數(`.env.local`)

從 Supabase 專案 **Project Settings → API** 取得:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...          # 公開金鑰
SUPABASE_SERVICE_ROLE_KEY=...              # 🔒 保密,僅伺服器端用,絕不 commit
```

> `.env.local` 已被 `.gitignore` 排除,不會進版控。clone 後需自行重建。

### 建立資料表

在 Supabase **SQL Editor** 執行 [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
會建立五張表並套用 RLS。

## 專案結構

```
src/
  app/
    client/         客戶端:問卷精靈、彙整儀表板(事實層)
    advisor/        顧問後台:客戶清單、A/B/C 分級、工作台
  lib/
    domain/         領域核心:型別、缺口引擎、評分、配置框架、可調參數
    supabase/       Supabase client(browser / server / service)
    mock/           範例資料(接 Supabase 前使用)
supabase/migrations/  資料庫 schema + RLS
docs/                 合規與資安文件
```

## 開發階段

- **Phase 1(已完成):** 客戶問卷 → 事實層儀表板;顧問後台客戶清單 / 分級 / 工作台(範例資料)。
- **Phase 2:** 接 Supabase auth / 推薦碼綁定 / 存檔;健檢報告 + PDF。
- **Phase 3:** 拍照 OCR 匯入、行情 API、進階情境模擬。

---

本工具為顧問決策輔助;對客戶的規劃建議由具專業資格的顧問本人產出。
