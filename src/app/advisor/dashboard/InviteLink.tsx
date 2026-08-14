"use client";

// 顧問邀請連結 — 主要的客戶取得方式。顧問把此連結發給客戶,
// 客戶開啟即自動綁定本顧問(推薦碼夾帶於連結)。
import { useEffect, useState } from "react";

export function InviteLink({ code }: { code: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/join?ref=${code}`);
  }, [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 使用者可手動選取複製 */
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900 dark:bg-sky-950/30">
      <h2 className="text-base font-semibold text-sky-900 dark:text-sky-100">邀請客戶</h2>
      <p className="mt-1 text-xs text-sky-700/80 dark:text-sky-300/80">
        把這條專屬連結發給客戶(LINE / Email 皆可),他們開啟即自動綁定你。
      </p>
      <div className="mt-3 flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-lg border border-sky-200 bg-white px-3 py-2 font-mono text-xs outline-none dark:border-sky-800 dark:bg-neutral-900"
        />
        <button
          onClick={copy}
          className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          {copied ? "已複製 ✓" : "複製連結"}
        </button>
      </div>
    </section>
  );
}
