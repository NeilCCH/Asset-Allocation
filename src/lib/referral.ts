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
