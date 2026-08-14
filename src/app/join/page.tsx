"use client";

// 邀請連結入口 — 顧問發出的 /join?ref=WM-XXXXX。
// 客戶開啟即記下綁定顧問的推薦碼,再進入健檢流程。
import { useEffect, useState } from "react";
import Link from "next/link";
import { saveReferral } from "@/lib/referral";

export default function Join() {
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("ref");
    if (r) {
      saveReferral(r);
      setRef(r.toUpperCase());
    }
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-900/40">
        📋
      </div>
      <h1 className="text-2xl font-bold">歡迎進行資產健檢</h1>
      {ref ? (
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
          您由財富管理顧問(推薦碼 <span className="font-mono font-semibold">{ref}</span>)邀請。
          <br />完成問卷後,顧問將依健檢結果與您討論規劃方向。
        </p>
      ) : (
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
          開始檢視您的資產配置現況與缺口試算。
        </p>
      )}

      <Link
        href="/client/assessment"
        className="mt-8 w-full rounded-lg bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700"
      >
        開始資產健檢
      </Link>

      <p className="mt-6 text-xs text-neutral-400">
        接下來:個資使用同意(PDPA)→ 必填問卷 → 快速盤點 → 彙整儀表板
      </p>
    </main>
  );
}
