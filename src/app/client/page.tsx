import Link from "next/link";

export default function ClientEntry() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
      <Link
        href="/"
        className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← 返回
      </Link>
      <h1 className="mt-6 text-2xl font-bold">開始資產健檢</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
        請輸入財富管理顧問提供的推薦碼,系統將把你與該顧問綁定。
      </p>

      <form className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">顧問推薦碼</span>
          <input
            type="text"
            placeholder="例如 WM-8F3K2"
            className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <Link
          href="/client/assessment"
          className="block w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-emerald-700"
        >
          下一步
        </Link>
      </form>

      <p className="mt-6 rounded-lg bg-neutral-100 p-3 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        流程:個資使用同意(PDPA)→ 必填核心問卷 → 快速盤點 → 彙整儀表板。
        (推薦碼綁定與帳號登入待接上 Supabase 後啟用)
      </p>
    </main>
  );
}
