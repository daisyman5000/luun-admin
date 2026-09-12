import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
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

function parseBearerToken(authorizationHeader: string | null | undefined) {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(\S+)/i.exec(authorizationHeader.trim());
  return match?.[1] ?? null;
}

export function hasValidGrokBotBearer(authorizationHeader: string | null | undefined) {
  const secret = process.env.GROK_BOT_SECRET;
  const token = parseBearerToken(authorizationHeader);

  if (!secret || !token) {
    return false;
  }

  const expected = createHash("sha256").update(secret).digest();
  const provided = createHash("sha256").update(token).digest();
  return timingSafeEqual(expected, provided);
}

export async function getJobsApiContext(authorizationHeader: string | null | undefined) {
  const context = await getUserContext();

  if (context.user) {
    return { kind: "user" as const, ...context, user: context.user };
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
