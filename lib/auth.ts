import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getUserContext() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  return { supabase, user, profile };
}

export async function requireUser() {
  const context = await getUserContext();

  if (!context.user) {
    redirect("/login");
  }

  return {
    ...context,
    user: context.user
  };
}

export function canManageInventory(role?: string | null) {
  return role === "owner" || role === "admin";
}

export function canManageUsers(role?: string | null) {
  return role === "owner" || role === "admin";
}

export function canSyncShopifyOrders(role?: string | null) {
  return role === "owner" || role === "admin";
}

export function canViewFinancials(role?: string | null) {
  return role === "owner" || role === "admin";
}

export function canUpdateOrderLogistics(role?: string | null) {
  return role === "owner" || role === "admin" || role === "logistics";
}

export function isKnownRole(role: unknown) {
  return role === "owner" || role === "admin" || role === "logistics" || role === "viewer";
}
