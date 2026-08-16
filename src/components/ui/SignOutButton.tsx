"use client";

// 登出按鈕 — 點擊後跳出確認對話框,確認才登出。兩端共用。
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({
  redirectTo = "/",
  label = "登出",
  className,
}: {
  redirectTo?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    await createClient().auth.signOut();
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className={className ?? "text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"}
      >
        {label}
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => !busy && setConfirming(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold">確認登出?</h2>
            <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
              登出後需重新輸入帳號密碼才能再次進入。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                取消
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
      )}
    </>
  );
}
