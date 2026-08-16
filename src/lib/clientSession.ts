// 記住本次提交所建立的 client 記錄 id — 供之後「建立帳號綁定」使用。
const KEY = "aa_client_id";

export function saveClientId(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // 無痕模式 / 額滿:忽略。
  }
}

export function loadClientId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}
