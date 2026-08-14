import Link from "next/link";

export default function AdvisorEntry() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
      <Link
        href="/"
        className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← 返回
      </Link>
      <h1 className="mt-6 text-2xl font-bold">財富管理顧問</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
        登入或註冊顧問帳號。註冊時可登錄專業證照,作為專家資格佐證。
      </p>

      <form className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <Link
          href="/advisor/dashboard"
          className="block w-full rounded-lg bg-sky-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-sky-700"
        >
          進入後台(示範)
        </Link>
      </form>

      <p className="mt-6 rounded-lg bg-neutral-100 p-3 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        後台功能:推薦碼管理 · 名下客戶 A/B/C 分級 · 完整缺口檢視 · 配置面向參考(僅顧問可見)· PDF 報告。
      </p>
    </main>
  );
}
