"use client";

// 選項頁(首頁)登入提醒 — 若使用者仍在登入狀態,回到角色選擇頁時提醒是否登出,
// 避免以舊身分(客戶 / 顧問)誤用。點「保持登入」可關閉;「登出」則清除 session。
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SessionLogoutNotice() {
  const [email, setEmail] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) setEmail(data.user.email ?? "目前帳號");
      });
  }, []);

  if (!email || dismissed) return null;

  const signOut = async () => {
    setBusy(true);
    try {
      await createClient().auth.signOut();
    } catch {
      /* 即使清 session 失敗也重載 */
    }
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900">
        <h2 className="text-base font-semibold">你仍在登入狀態</h2>
        <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-300">
          目前以 <span className="font-medium">{email}</span> 登入。
          若要以其他身分(客戶填寫 / 顧問註冊)使用,建議先登出,避免資料混淆。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setDismissed(true)}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            保持登入
          </button>
          <button
            onClick={signOut}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "登出中…" : "登出"}
          </button>
        </div>
      </div>
    </div>
  );
}
