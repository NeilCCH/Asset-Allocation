// 瀏覽器端 Supabase client(以 anon key + 使用者 session 連線)。
// 受 RLS 約束 — 客戶登入後對 advisor_private 表一律讀不到。
import { createBrowserClient } from "@supabase/ssr";

// 長效 cookie(1 年),讓登入狀態關閉/重開後仍保持,不需每次重新登入。
export const AUTH_COOKIE_OPTIONS = { maxAge: 60 * 60 * 24 * 365 };

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: AUTH_COOKIE_OPTIONS },
  );
}
