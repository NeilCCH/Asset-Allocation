"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/advisor");
    router.refresh();
  };
  return (
    <button onClick={signOut} className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
      登出
    </button>
  );
}
