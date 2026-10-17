// 問卷草稿暫存 — Phase 1 尚未接 Supabase,先以 localStorage 保存作答,
// 讓「填問卷 → 看儀表板」流程可離線跑通。接上 Supabase 後改存資料庫。
import type { QuestionnaireData } from "./domain/types";

const KEY = "aa_assessment_draft";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function saveDraft(data: QuestionnaireData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // iOS Safari 無痕模式 / 儲存額滿會丟例外;忽略即可,不可中斷送出流程。
  }
}

export function loadDraft(): QuestionnaireData | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try { raw = window.localStorage.getItem(KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as { savedAt?: number; data?: QuestionnaireData };
    if (!saved.savedAt || Date.now() - saved.savedAt > MAX_AGE_MS || !saved.data) {
      clearDraft();
      return null;
    }
    return saved.data;
  } catch {
    return null;
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(KEY); } catch { /* 儲存空間不可用 */ }
}
