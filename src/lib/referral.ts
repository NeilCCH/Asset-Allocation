// 推薦碼暫存 — 客戶經邀請連結進入時記下綁定的顧問推薦碼。
// 接上 Supabase 後,綁定關係改寫入 clients.advisor_id。
const KEY = "aa_referral";

export function saveReferral(code: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, code.trim().toUpperCase());
  } catch {
    // 無痕模式 / 額滿:忽略。
  }
}

export function loadReferral(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

// ── 待綁定顧問 ──────────────────────────────────────────
// 無推薦碼客戶於儀表板選了顧問、但尚未註冊登入時,先暫存推薦碼;
// 註冊/登入回來後自動完成綁定。與 aa_referral(邀請連結)分開,避免匿名誤判為已綁定。
const PENDING_KEY = "aa_pending_advisor";

export function savePendingAdvisor(code: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_KEY, code.trim().toUpperCase());
  } catch {
    /* 無痕 / 額滿:忽略 */
  }
}

export function loadPendingAdvisor(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PENDING_KEY);
}

export function clearPendingAdvisor() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_KEY);
}
