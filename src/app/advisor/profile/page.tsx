// 顧問編輯註冊資料。未登入 / 無檔案導回 /advisor。
import { redirect } from "next/navigation";
import { getMyAdvisor } from "@/lib/actions/advisor";
import { BackLink } from "@/components/ui/BackLink";
import { ProfileForm } from "./ProfileForm";

export default async function AdvisorProfilePage() {
  const advisor = await getMyAdvisor();
  if (!advisor) redirect("/advisor");

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <BackLink href="/advisor/dashboard" label="客戶清單" accent="sky" />
      <h1 className="mt-6 text-2xl font-bold">編輯個人資料</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        更新你的顧問檔案。推薦碼 <span className="font-mono font-semibold">{advisor.referral_code}</span> 不變。
      </p>
      <ProfileForm advisor={advisor} />
    </main>
  );
}
