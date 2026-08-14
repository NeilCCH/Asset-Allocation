-- 資產配置管理 APP — 初始 schema + RLS
-- ⚠️ 合規核心(PRD §1):RLS 在「資料庫層」物理隔離。
--    客戶端連線永遠 SELECT 不到 advisor_private 表(配置面向建議 + leads 評分)。
--    這不是應用層約定,是資料庫強制。

-- ── 顧問(財富管理顧問) ─────────────────────────────
create table if not exists advisors (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  display_name  text,
  referral_code text not null unique,     -- 客戶憑此註冊自動綁定
  -- 專業證照(佐證「產出建議者具資格」— 合規稽核用)。
  -- 陣列元素:{ type, number?, verified? }。type 見 domain/licenses.ts。
  licenses      jsonb not null default '[]'::jsonb,
  firm_name     text,                     -- 所屬事業體(投顧/保經代等)
  created_at    timestamptz not null default now()
);

-- ── 客戶 ─────────────────────────────────────────────
create table if not exists clients (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null, -- 客戶登入帳號
  advisor_id    uuid not null references advisors (id) on delete restrict, -- 綁定顧問(leads 分派骨架)
  surname       text not null,            -- 只收姓氏(最小化蒐集)
  honorific     text check (honorific in ('先生','女士')),
  line_id       text,
  mobile        text,
  email         text,
  pdpa_consent      boolean not null default false,  -- 個資同意閘門
  pdpa_consent_at   timestamptz,
  pdpa_version      text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_clients_advisor on clients (advisor_id);

-- ── 問卷作答(分層 jsonb;typed calc 於伺服器端執行) ──
create table if not exists questionnaire_responses (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null unique references clients (id) on delete cascade,
  basic       jsonb not null default '{}'::jsonb,
  core        jsonb not null default '{}'::jsonb,
  deep        jsonb,   -- 選填深化
  kyc         jsonb,   -- KYC 風險
  updated_at  timestamptz not null default now()
);

-- ── 彙整結果(事實層,客戶可見) ───────────────────────
-- 只放客觀試算:資產分布、保障 vs 投資、缺口概況。不含任何配置建議。
create table if not exists client_summaries (
  client_id             uuid primary key references clients (id) on delete cascade,
  asset_breakdown       jsonb,
  protection_vs_invest  jsonb,
  gaps                  jsonb,   -- 退休/保障/教育缺口(客觀公式)
  computed_at           timestamptz not null default now()
);

-- ── 顧問專屬(⛔ 客戶端永不可讀) ─────────────────────
-- leads A/B/C 評分 + 配置面向建議框架 + 顧問對客戶的建議草稿。
create table if not exists advisor_private (
  client_id             uuid primary key references clients (id) on delete cascade,
  lead_score            jsonb,   -- {grade, total, factors} — §5
  allocation_framework  jsonb,   -- 顧問手動勾選的配置面向(僅類別層級,無個股/商品)
  advisor_recommendation text,   -- 顧問(具投顧資格)本人消化後產出
  calc_params_override  jsonb,   -- 個別客戶的試算參數覆寫(§7 可調參數)
  updated_at            timestamptz not null default now()
);

-- ══ RLS ══════════════════════════════════════════════
alter table advisors                enable row level security;
alter table clients                 enable row level security;
alter table questionnaire_responses enable row level security;
alter table client_summaries        enable row level security;
alter table advisor_private         enable row level security;

-- 判斷:目前登入者是否為此 client 的綁定顧問
create or replace function is_owning_advisor(target_client uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from clients c
    where c.id = target_client and c.advisor_id = auth.uid()
  );
$$;

-- 判斷:目前登入者是否為此 client 本人
create or replace function is_self_client(target_client uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from clients c
    where c.id = target_client and c.auth_user_id = auth.uid()
  );
$$;

-- advisors:只能讀寫自己
create policy advisor_self_select on advisors for select using (id = auth.uid());
create policy advisor_self_update on advisors for update using (id = auth.uid());
create policy advisor_self_insert on advisors for insert with check (id = auth.uid());

-- clients:顧問看名下客戶;客戶看自己
create policy clients_advisor_all on clients for all
  using (advisor_id = auth.uid()) with check (advisor_id = auth.uid());
create policy clients_self_select on clients for select using (auth_user_id = auth.uid());
create policy clients_self_update on clients for update using (auth_user_id = auth.uid());

-- questionnaire_responses:客戶讀寫自己;顧問可讀名下客戶
create policy qr_self_all on questionnaire_responses for all
  using (is_self_client(client_id)) with check (is_self_client(client_id));
create policy qr_advisor_select on questionnaire_responses for select
  using (is_owning_advisor(client_id));

-- client_summaries(事實層):客戶可讀自己;顧問可讀名下
create policy summary_self_select on client_summaries for select
  using (is_self_client(client_id));
create policy summary_advisor_select on client_summaries for select
  using (is_owning_advisor(client_id));
-- 寫入僅由 service_role(伺服器端彙整運算)進行,不開放一般角色

-- ⛔ advisor_private:僅綁定顧問可讀寫。刻意「不」建立任何客戶可讀的 policy。
--    RLS 預設拒絕 → 客戶端連線對本表一律 0 rows。這是合規物理隔離的關鍵。
create policy private_advisor_all on advisor_private for all
  using (is_owning_advisor(client_id)) with check (is_owning_advisor(client_id));
