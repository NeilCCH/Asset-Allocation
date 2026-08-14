"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveReferral } from "@/lib/referral";

export default function ClientEntry() {
  const router = useRouter();
  const [showManual, setShowManual] = useState(false);
  const [code, setCode] = useState("");

  const startWithCode = () => {
    if (code.trim()) saveReferral(code.trim());
    router.push("/client/assessment");
  };

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
        ← 返回
      </Link>
      <h1 className="mt-6 text-2xl font-bold">開始資產健檢</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
        檢視你的資產配置現況與缺口試算。若你收到財富管理顧問的邀請連結,開啟連結即會自動綁定顧問。
      </p>

      <Link
        href="/client/assessment"
        className="mt-8 block w-full rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-emerald-700"
      >
        開始資產健檢
      </Link>

      {/* 手動輸入推薦碼(次要方式,主畫面收合) */}
      <div className="mt-6">
        <button
          onClick={() => setShowManual((v) => !v)}
          className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
        >
          有顧問推薦碼?手動輸入 ▾
        </button>
        {showManual && (
          <div className="mt-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="例如 WM-8F3K2"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              onClick={startWithCode}
              className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              綁定並開始
            </button>
          </div>
        )}
      </div>

      <p className="mt-6 rounded-lg bg-neutral-100 p-3 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        流程:個資使用同意(PDPA)→ 必填核心問卷 → 快速盤點 → 彙整儀表板。
      </p>
    </main>
  );
}
