// 瀏覽器端 Supabase client(以 anon key + 使用者 session 連線)。
// 受 RLS 約束 — 客戶登入後對 advisor_private 表一律讀不到。
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
