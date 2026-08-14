import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:py-16">
      {/* Hero */}
      <section className="text-center">
        <p className="text-sm font-medium tracking-widest text-emerald-700 dark:text-emerald-400">
          財富管理顧問工具
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
          資產配置健檢
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-300 sm:text-lg">
          跨資產類別的配置檢視與缺口試算。客戶輸入資產現況,系統彙整出全貌與缺口,
          由具專業資格的顧問提供規劃建議。
        </p>
        <p className="mx-auto mt-3 inline-block rounded-full bg-neutral-100 px-4 py-1 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          定位:檢視 · 試算 · 教育,非投資推介
        </p>
      </section>

      {/* 雙角色入口 */}
      <section className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2">
        <RoleCard
          role="客戶"
          title="我要做資產健檢"
          desc="憑顧問推薦碼註冊,填寫問卷與快速盤點,即時看見資產現況全貌與缺口概況。"
          bullets={["推薦碼綁定顧問", "個資使用同意(PDPA)", "彙整儀表板(事實層)"]}
          href="/client"
          cta="輸入推薦碼開始"
          accent="emerald"
        />
        <RoleCard
          role="顧問"
          title="我是財富管理顧問"
          desc="管理名下客戶、檢視完整缺口分析,參考系統配置面向框架,產出健檢報告。"
          bullets={["客戶清單 A/B/C 分級", "配置面向參考(僅顧問可見)", "PDF 健檢報告"]}
          href="/advisor"
          cta="顧問登入 / 註冊"
          accent="sky"
        />
      </section>

      {/* 合規聲明 */}
      <section className="mt-14 rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-sm leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <h2 className="mb-2 font-semibold text-neutral-800 dark:text-neutral-200">
          合規說明
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>系統僅提供客觀試算與資產類別層級的彙整,不推介任何單一金融商品。</li>
          <li>對客戶的規劃建議由具專業資格的顧問本人產出,系統為決策輔助工具。</li>
          <li>缺口試算採透明、可調參數的公式,不含投資意見。</li>
        </ul>
      </section>
    </main>
  );
}

function RoleCard({
  role,
  title,
  desc,
  bullets,
  href,
  cta,
  accent,
}: {
  role: string;
  title: string;
  desc: string;
  bullets: string[];
  href: string;
  cta: string;
  accent: "emerald" | "sky";
}) {
  const ring =
    accent === "emerald"
      ? "hover:border-emerald-400 focus-within:border-emerald-400"
      : "hover:border-sky-400 focus-within:border-sky-400";
  const btn =
    accent === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : "bg-sky-600 hover:bg-sky-700";
  const tag =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";

  return (
    <div
      className={`flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 transition-colors dark:border-neutral-800 dark:bg-neutral-950 ${ring}`}
    >
      <span
        className={`mb-3 inline-block w-fit rounded-full px-3 py-1 text-xs font-medium ${tag}`}
      >
        {role}
      </span>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
        {desc}
      </p>
      <ul className="mt-4 space-y-1.5 text-sm text-neutral-500 dark:text-neutral-400">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
            {b}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white transition-colors ${btn}`}
      >
        {cta}
      </Link>
    </div>
  );
}
