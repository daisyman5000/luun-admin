"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      className="rounded-md border border-line px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      onClick={signOut}
      type="button"
    >
      Sign out
    </button>
  );
}
