"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SyncSummary = {
  imported: number;
  sinceDate?: string;
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

  if (reason === "webhooks") {
    return "Shopify connected, but automatic order updates could not be enabled. Check the Shopify app scopes and try Connect Shopify again.";
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
      body: JSON.stringify({ limit: 250, sinceDate: "2026-06-24" })
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
      `Sync complete since ${payload?.sinceDate || "2026-06-24"}. Imported ${payload?.imported || 0}, updated ${payload?.updated || 0}, skipped ${payload?.skipped || 0}.`
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          className="rounded-md border border-line bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
          href="/api/shopify/install"
        >
          Connect
        </Link>
        <button
          className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          onClick={syncOrders}
          type="button"
        >
          {loading ? "Syncing" : "Sync Shopify"}
        </button>
      </div>
      <div className="text-right">
        {message ? <p className="text-xs text-green-700">{message}</p> : null}
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        {shopifyStatus === "connected" ? (
          <p className="text-xs text-green-700">Shopify connected</p>
        ) : null}
        {shopifyStatus === "failed" ? (
          <p className="text-xs text-red-700">{getFailureMessage(shopifyReason)}</p>
        ) : null}
      </div>
    </div>
  );
}
