"use client";

// 客戶主動預約 / 請顧問聯繫。送出後寫入 contact_requests,顧問後台會看到。
import { useState } from "react";
import { loadClientId } from "@/lib/clientSession";
import { requestContact } from "@/lib/actions/crm";

// 可預約時段(顧問工作時間,固定選項,不自由輸入)
const TIME_SLOTS: { period: string; slots: string[] }[] = [
  { period: "上午", slots: ["10:00", "11:00"] },
  { period: "下午", slots: ["14:00", "15:00", "16:00"] },
];

export function ContactAdvisorCard() {
  const [message, setMessage] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleTime = (v: string) => setTimes((prev) => (prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]));

  const submit = async () => {
    const clientId = loadClientId();
    if (!clientId) return setErr("尚未綁定顧問,請先於上方選擇一位顧問");
    if (times.length === 0) return setErr("請至少選擇一個方便的時段");
    setBusy(true);
    setErr(null);
    const res = await requestContact({ clientId, message, preferredTime: times.join("、") });
    setBusy(false);
    if (res.ok) setSent(true);
    else setErr(res.error);
  };

  if (sent) {
    return (
      <section className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
        <div className="flex items-center gap-2">
          <span className="text-xl">✓</span>
          <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">已送出預約</h2>
        </div>
        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
          你的財富管理顧問會盡快與你聯繫,一起討論後續規劃方向。
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
      <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">與顧問預約諮詢</h2>
      <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
        想更完整的規劃?留下方便的時間與想討論的事,顧問會主動與你聯繫。
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <p className="mb-1.5 text-sm font-medium text-emerald-900 dark:text-emerald-100">方便的時段(可複選)</p>
          <div className="space-y-2">
            {TIME_SLOTS.map(({ period, slots }) => (
              <div key={period} className="flex flex-wrap items-center gap-2">
                <span className="w-8 shrink-0 text-sm text-emerald-800 dark:text-emerald-200">{period}</span>
                {slots.map((s) => {
                  const value = `${period} ${s}`;
                  const active = times.includes(value);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleTime(value)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                        active
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-neutral-900 dark:text-emerald-200 dark:hover:bg-emerald-950"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="想討論的方向(選填,例:退休準備、保障規劃)"
          className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-emerald-900 dark:bg-neutral-900"
        />
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "送出中…" : "送出預約,請顧問聯繫我"}
        </button>
      </div>
    </section>
  );
}
