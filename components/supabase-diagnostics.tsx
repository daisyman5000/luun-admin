import { getUserContext } from "@/lib/auth";
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

function CheckRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

export async function SupabaseDiagnostics() {
  const { profile, user } = await getUserContext();

  if (!user || (profile?.role !== "owner" && profile?.role !== "admin")) {
    return null;
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

  return (
    <section className="mb-5 rounded-lg border border-line bg-white p-4">
      <h2 className="text-base font-semibold tracking-normal">System diagnostics</h2>
      <div className="mt-3">
        <CheckRow label="Supabase URL" value={getSupabaseUrl() ? "Configured" : "Missing"} />
        <CheckRow
          label="Publishable key"
          value={getSupabasePublishableKey() ? "Configured" : "Missing"}
        />
        <CheckRow
          label="Server secret key"
          value={getSupabaseSecretKey() ? "Configured" : "Missing"}
        />
        <CheckRow label="Current auth user id" value={user.id} />
        <CheckRow
          label="Matching profile row"
          value={profile?.id === user.id ? "Found" : "Missing"}
        />
        <CheckRow label="Current role" value={profile?.role || "Missing"} />
        <CheckRow
          label="Shopify store domain"
          value={shopifyConfig.storeDomainExists ? "Configured" : "Missing"}
        />
        <CheckRow
          label="Shopify client ID"
          value={shopifyConfig.clientIdExists ? "Configured" : "Missing"}
        />
        <CheckRow
          label="Shopify client secret"
          value={shopifyConfig.clientSecretExists ? "Configured" : "Missing"}
        />
        <CheckRow
          label="Shopify app connection"
          value={shopifyConnection.connected ? "Connected" : "Not connected"}
        />
        <CheckRow
          label="Shopify API connection"
          value={shopifyApiConnectionWorks ? "Working" : "Not connected"}
        />
      </div>
    </section>
  );
}
