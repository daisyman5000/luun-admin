import { redirect } from "next/navigation";
import { hasValidGrokBotBearer } from "@/lib/grok-bot-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export { hasValidGrokBotBearer } from "@/lib/grok-bot-auth";

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

export async function getJobsApiContext(authorizationHeader: string | null | undefined) {
  try {
    const context = await getUserContext();

    if (context.user) {
      return { kind: "user" as const, ...context, user: context.user };
    }
  } catch {
    // Missing session configuration is treated as no cookie user.
  }

  if (hasValidGrokBotBearer(authorizationHeader)) {
    return {
      kind: "bot" as const,
      profile: null,
      supabase: createAdminClient(),
      user: null
    };
  }

  return { kind: "unauthenticated" as const };
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
