import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  return { supabase, user, profile };
}

export function canManageInventory(role?: string | null) {
  return role === "owner" || role === "admin";
}

export function canManageUsers(role?: string | null) {
  return role === "owner" || role === "admin";
}
