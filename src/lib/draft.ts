// 問卷草稿暫存 — Phase 1 尚未接 Supabase,先以 localStorage 保存作答,
// 讓「填問卷 → 看儀表板」流程可離線跑通。接上 Supabase 後改存資料庫。
import type { QuestionnaireData } from "./domain/types";

const KEY = "aa_assessment_draft";

export function saveDraft(data: QuestionnaireData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

export function loadDraft(): QuestionnaireData | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuestionnaireData;
  } catch {
    return null;
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
