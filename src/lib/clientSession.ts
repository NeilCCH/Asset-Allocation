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

// 送出去重用的隨機識別碼(非個資):同一裝置重填會沿用同一枚 token,
// 讓伺服器把重複送出更新為同一筆客戶,而不是新增。換裝置/清快取則會產生新 token。
const SUBMIT_TOKEN_KEY = "aa_submission_token";

export function getOrCreateSubmissionToken(): string {
  if (typeof window === "undefined") return "";
  try {
    let t = window.localStorage.getItem(SUBMIT_TOKEN_KEY);
    if (!t) {
      t = (window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      window.localStorage.setItem(SUBMIT_TOKEN_KEY, t);
    }
    return t;
  } catch {
    // 無痕模式 / 額滿:退回一次性隨機值(無法跨次去重,但不致失敗)。
    return window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
