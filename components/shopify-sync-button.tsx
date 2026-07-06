"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SyncSummary = {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
};

type ShopifySyncButtonProps = {
  reason?: string | string[];
  status?: string | string[];
};

function getFailureMessage(reason?: string) {
  if (reason === "state") {
    return "Shopify connection failed because the login session expired. Click Connect Shopify again.";
  }

  if (reason === "signature") {
    return "Shopify connection failed because the callback could not be verified. Check the Shopify Client Secret in Vercel.";
  }

  if (reason === "shop") {
    return "Shopify connection failed because SHOPIFY_STORE_DOMAIN does not match the Shopify store.";
  }

  if (reason === "token") {
    return "Shopify connection failed while creating the Admin API token. Check the Shopify Client ID, Client Secret, app scopes, and callback URL.";
  }

  if (reason === "save") {
    return "Shopify connected, but the app could not save the token in Supabase. Check that the database setup SQL was run.";
  }

  if (reason) {
    return `Shopify connection failed: ${reason}.`;
  }

  return "Shopify connection failed. Try connecting again.";
}

export function ShopifySyncButton({ reason, status }: ShopifySyncButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shopifyStatus = Array.isArray(status) ? status[0] : status;
  const shopifyReason = Array.isArray(reason) ? reason[0] : reason;

  async function syncOrders() {
    setLoading(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/shopify/import-orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ limit: 50 })
    });

    const payload = (await response.json().catch(() => null)) as
      | (SyncSummary & { error?: string })
      | null;
    setLoading(false);

    if (!response.ok) {
      setError(payload?.errors?.[0] || payload?.error || "Unable to sync Shopify orders.");
      return;
    }

    setMessage(
      `Sync complete. Imported ${payload?.imported || 0}, updated ${payload?.updated || 0}, skipped ${payload?.skipped || 0}.`
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-slate-800">Shopify order sync</p>
        {message ? <p className="mt-1 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-1 text-sm text-red-700">{error}</p> : null}
        {shopifyStatus === "connected" ? (
          <p className="mt-1 text-sm text-green-700">Shopify is connected.</p>
        ) : null}
        {shopifyStatus === "failed" ? (
          <p className="mt-1 text-sm text-red-700">{getFailureMessage(shopifyReason)}</p>
        ) : null}
        {!message && !error ? (
          <p className="mt-1 text-sm text-slate-600">
            Connect Shopify once, then import the latest 50 orders.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          className="rounded-md border border-line px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
          href="/api/shopify/install"
        >
          Connect Shopify
        </Link>
        <button
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          onClick={syncOrders}
          type="button"
        >
          {loading ? "Syncing..." : "Sync Shopify Orders"}
        </button>
      </div>
    </div>
  );
}
