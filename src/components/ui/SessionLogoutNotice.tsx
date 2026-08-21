"use client";

// 選項頁(首頁)登入提醒 — 若使用者仍在登入狀態,回到角色選擇頁時提醒。
// 提供實際動作:直接前往「自己的後台/健檢」,或登出改用其他身分。
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getMyAdvisor } from "@/lib/actions/advisor";

export function SessionLogoutNotice() {
  const [email, setEmail] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<string | null>(null); // null=判斷中
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await createClient().auth.getUser();
      if (!data.user) return;
      setEmail(data.user.email ?? "目前帳號");
      // 判斷身分:有顧問檔案 → 顧問後台;否則 → 客戶健檢
      try {
        const adv = await getMyAdvisor();
        setDashboard(adv ? "/advisor/dashboard" : "/client/dashboard");
      } catch {
        setDashboard("/client/dashboard");
      }
    })();
  }, []);

  if (!email || dismissed) return null;

  const isAdvisor = dashboard === "/advisor/dashboard";

  const signOut = async () => {
    setBusy(true);
    try {
      await createClient().auth.signOut();
    } catch {
      /* 即使清 session 失敗也硬導向 */
    }
    // 硬導向(整頁重載),確保伺服器以「已清除的 cookie」重新渲染 → 確實登出。
    // 刻意不用 next/redirect:登出需整頁重載以清除記憶體中的 session 狀態。
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  };

  const goDashboard = () => {
    if (!dashboard) return;
    setBusy(true);
    window.location.href = dashboard; // 直達自己的後台,避免又經過登入頁
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900">
        <h2 className="text-base font-semibold">你仍在登入狀態</h2>
        <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-300">
          目前以 <span className="font-medium">{email}</span> 登入。可直接前往你的
          {dashboard ? (isAdvisor ? "顧問後台" : "資產健檢") : "頁面"},或登出改用其他身分。
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={goDashboard}
            disabled={busy || !dashboard}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {dashboard ? (isAdvisor ? "前往顧問後台" : "前往我的資產健檢") : "載入中…"}
          </button>
          <button
            onClick={signOut}
            disabled={busy}
            className="w-full rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950/40"
          >
            {busy ? "處理中…" : "登出,改用其他身分"}
          </button>
          <button
            onClick={() => setDismissed(true)}
            disabled={busy}
            className="w-full py-1 text-center text-xs text-neutral-400 hover:text-neutral-600 disabled:opacity-50 dark:hover:text-neutral-300"
          >
            先留在此頁
          </button>
        </div>
      </div>
    </div>
  );
}
