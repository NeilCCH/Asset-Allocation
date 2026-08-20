"use client";

// 刪除客戶 — ⚠️ 顧問專屬。必經確認彈窗 + 不可復原提示,不直接刪除。
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteClient } from "@/lib/actions/crm";

export function DeleteClientButton({ clientId, name }: { clientId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const doDelete = async () => {
    setBusy(true);
    setErr(null);
    const res = await deleteClient(clientId);
    if (res.ok) {
      router.push("/advisor/dashboard");
      router.refresh();
    } else {
      setBusy(false);
      setErr(res.error);
    }
  };

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        刪除此客戶資料
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => !busy && setConfirming(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-red-600 dark:text-red-400">確認刪除客戶資料?</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              將永久刪除「<span className="font-medium">{name}</span>」的<strong>所有健檢資料</strong>:問卷作答、彙整結果、預約紀錄、CRM 備註。
            </p>
            <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
              ⚠️ 此操作<strong>無法復原</strong>,刪除後資料將永久消失。
            </p>
            {err && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                取消
              </button>
              <button
                onClick={doDelete}
                disabled={busy}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "刪除中…" : "確認刪除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
