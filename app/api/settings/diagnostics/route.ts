import { NextResponse } from "next/server";
import { canManageUsers, getUserContext } from "@/lib/auth";
import {
  getSupabasePublishableKey,
  getSupabaseUrl
} from "@/lib/supabase/public-config";
import { getSupabaseSecretKey } from "@/lib/supabase/server-config";

export async function GET() {
  const { profile, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageUsers(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to view diagnostics" }, { status: 403 });
  }

  return NextResponse.json({
    supabaseUrlExists: Boolean(getSupabaseUrl()),
    publishableKeyExists: Boolean(getSupabasePublishableKey()),
    serverSecretKeyExists: Boolean(getSupabaseSecretKey()),
    currentAuthUserId: user.id,
    matchingProfileExists: Boolean(profile && profile.id === user.id),
    currentRole: profile?.role || null
  });
}
