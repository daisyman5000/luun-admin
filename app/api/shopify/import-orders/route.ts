import { NextResponse, type NextRequest } from "next/server";
import { canSyncShopifyOrders, getUserContext } from "@/lib/auth";
import {
  importRecentShopifyOrders,
  normalizeImportLimit,
  normalizeImportSinceDate
} from "@/lib/shopify/orders";

export async function POST(request: NextRequest) {
  const { user, profile } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canSyncShopifyOrders(profile?.role)) {
    return NextResponse.json(
      { error: "Not authorized to sync Shopify orders" },
      { status: 403 }
    );
  }

  let body: { limit?: unknown; sinceDate?: unknown } = {};

  try {
    body = (await request.json()) as { limit?: unknown; sinceDate?: unknown };
  } catch {
    body = {};
  }

  try {
    const limit = normalizeImportLimit(body.limit ?? request.nextUrl.searchParams.get("limit"));
    const sinceDate = normalizeImportSinceDate(
      body.sinceDate ?? request.nextUrl.searchParams.get("sinceDate")
    );
    const summary = await importRecentShopifyOrders(limit, sinceDate);

    return NextResponse.json({ ...summary, limit, sinceDate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import Shopify orders";

    return NextResponse.json(
      {
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [message]
      },
      { status: 500 }
    );
  }
}
