// 平台管理員判斷 — 以 email 白名單(環境變數 ADMIN_EMAILS,逗號分隔)。僅供伺服器端使用。
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
