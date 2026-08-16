"use client";

// 報稅單 OCR — 瀏覽器端辨識(Tesseract.js),影像不離開裝置、不上傳、不儲存。
// 只萃取數字供使用者確認;確認後由上層只保存「綜合所得淨額(萬)」。
import { useState } from "react";

export function TaxOcr({ onExtract }: { onExtract: (wan: number) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [candidates, setCandidates] = useState<number[]>([]);
  const [recommended, setRecommended] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    setCandidates([]);
    setRecommended(null);
    setProgress(0);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(file, "chi_tra+eng", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      const text = data.text || "";
      // 萃取金額(元):4 位數以上的數字(可含逗號)
      const nums = Array.from(text.matchAll(/[\d,]{4,}/g))
        .map((m) => Number(m[0].replace(/,/g, "")))
        .filter((n) => !Number.isNaN(n) && n >= 10000 && n < 1_000_000_000);
      const uniq = [...new Set(nums)].sort((a, b) => b - a).slice(0, 8);
      setCandidates(uniq);
      // 嘗試找「淨額」附近的數字作為推薦
      const flat = text.replace(/\s/g, "");
      const near = flat.match(/淨額[^\d]{0,6}([\d,]{4,})/);
      if (near) {
        const v = Number(near[1].replace(/,/g, ""));
        if (!Number.isNaN(v)) setRecommended(v);
      }
      if (uniq.length === 0) setErr("未能辨識到金額,請改用手動輸入,或換清晰一點的照片。");
    } catch {
      setErr("辨識失敗,請改用手動輸入。");
    } finally {
      setBusy(false);
    }
  };

  const pick = (yuan: number) => {
    onExtract(Math.round((yuan / 10000) * 10) / 10); // 元 → 萬
    setOpen(false);
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-sky-600 hover:underline dark:text-sky-400"
      >
        📷 拍照 / 上傳報稅單自動辨識(免上傳,影像不離開裝置)
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs"
          />
          {busy && <p className="mt-2 text-xs text-neutral-500">辨識中… {progress}%(在你的裝置上進行,不上傳)</p>}
          {err && <p className="mt-2 text-xs text-amber-600">{err}</p>}
          {candidates.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                點選正確的「綜合所得淨額」(會自動換算為萬元):
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {candidates.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => pick(n)}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      recommended === n
                        ? "bg-sky-600 text-white"
                        : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                    }`}
                  >
                    {n.toLocaleString("zh-TW")} 元{recommended === n ? " ★" : ""}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">
                ★ 為系統推測值,請務必核對。影像僅在裝置上辨識,不會上傳或儲存,系統只保存你選定的數字。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
