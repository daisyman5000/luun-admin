import { NextResponse } from "next/server";
import { canManageUsers, getUserContext } from "@/lib/auth";
import {
  checkShopifyAdminConnection,
  getShopifyConnectionStatus,
  getShopifyConfigStatus
} from "@/lib/shopify/client";
import {
  getSupabasePublishableKey,
  getSupabaseUrl
} from "@/lib/supabase/public-config";
import { getSupabaseSecretKey } from "@/lib/supabase/server-config";
import { checkWiseConnection, getWiseConfigStatus } from "@/lib/wise/client";

export async function GET() {
  const { profile, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageUsers(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to view diagnostics" }, { status: 403 });
  }

  const shopifyConfig = getShopifyConfigStatus();
  const shopifyConnection = await getShopifyConnectionStatus();
  const shopifyApiConnectionWorks =
    shopifyConfig.storeDomainExists &&
    shopifyConfig.clientIdExists &&
    shopifyConfig.clientSecretExists &&
    shopifyConnection.connected
      ? await checkShopifyAdminConnection()
      : false;
  const wiseConfig = getWiseConfigStatus();
  const wiseApiConnectionWorks = wiseConfig.apiTokenExists ? await checkWiseConnection() : false;

  return NextResponse.json({
    supabaseUrlExists: Boolean(getSupabaseUrl()),
    publishableKeyExists: Boolean(getSupabasePublishableKey()),
    serverSecretKeyExists: Boolean(getSupabaseSecretKey()),
    currentAuthUserId: user.id,
    matchingProfileExists: Boolean(profile && profile.id === user.id),
    currentRole: profile?.role || null,
    shopifyStoreDomainExists: shopifyConfig.storeDomainExists,
    shopifyClientIdExists: shopifyConfig.clientIdExists,
    shopifyClientSecretExists: shopifyConfig.clientSecretExists,
    shopifyWebhookSecretExists: shopifyConfig.webhookSecretExists,
    shopifyConnected: shopifyConnection.connected,
    shopifyConnectedAt: shopifyConnection.updatedAt,
    shopifyApiConnectionWorks,
    wiseApiTokenExists: wiseConfig.apiTokenExists,
    wiseApiConnectionWorks
  });
}
