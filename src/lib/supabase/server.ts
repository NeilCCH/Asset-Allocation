// 伺服器端 Supabase clients。
// - createServerSupabase(): 以使用者 session 連線,受 RLS 約束(一般讀寫)。
// - createServiceSupabase(): 以 service_role 連線,略過 RLS,僅供彙整運算
//   將 client_summaries 寫回。⚠️ 絕不可在此以外洩露 service_role key。
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { maxAge: 60 * 60 * 24 * 365 }, // 長效登入
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component 內呼叫 set 會拋錯,由 middleware 處理 session 刷新即可
          }
        },
      },
    },
  );
}

/** service_role client — 僅限伺服器端彙整運算使用,略過 RLS。 */
export function createServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
