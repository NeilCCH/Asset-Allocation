// 平台管理員 — 顧問付費推薦(年費)開通/停用。非管理員一律 404。
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { listAdvisorsForAdmin } from "@/lib/actions/admin";
import { BackLink } from "@/components/ui/BackLink";
import { AdminAdvisorTable } from "./AdminAdvisorTable";

export default async function AdminAdvisorsPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !isAdminEmail(auth.user.email)) notFound();

  const res = await listAdvisorsForAdmin();
  const advisors = res.ok ? res.advisors : [];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <BackLink href="/advisor/dashboard" label="後台" accent="sky" />
      <h1 className="mt-6 text-2xl font-bold">顧問付費推薦管理</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        年費制。收到款項後,對該顧問按「開通一年」;到期後自動失去優先曝光,可續約或停用。
      </p>
      {!res.ok && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{res.error}</p>}
      <AdminAdvisorTable initial={advisors} />
    </main>
  );
}
