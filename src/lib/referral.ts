// 推薦碼暫存 — 客戶經邀請連結進入時記下綁定的顧問推薦碼。
// 接上 Supabase 後,綁定關係改寫入 clients.advisor_id。
const KEY = "aa_referral";

export function saveReferral(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, code.trim().toUpperCase());
}

export function loadReferral(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}
