import { NextResponse, type NextRequest } from "next/server";
import {
  isExpectedShopifyShopDomain,
  verifyShopifyWebhook
} from "@/lib/shopify/client";
import {
  getShopifyGraphQLOrderId,
  importShopifyOrderById
} from "@/lib/shopify/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TOPICS = new Set(["orders/create", "orders/updated"]);

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  const shopDomain = request.headers.get("x-shopify-shop-domain");
  const topic = request.headers.get("x-shopify-topic") || "";

  if (!verifyShopifyWebhook(rawBody, hmac)) {
    return NextResponse.json({ error: "Invalid Shopify webhook signature" }, { status: 401 });
  }

  if (!isExpectedShopifyShopDomain(shopDomain)) {
    return NextResponse.json({ error: "Unexpected Shopify shop domain" }, { status: 401 });
  }

  if (!ALLOWED_TOPICS.has(topic)) {
    return NextResponse.json({ error: "Unsupported Shopify webhook topic" }, { status: 400 });
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid Shopify webhook payload" }, { status: 400 });
  }

  try {
    const shopifyOrderId = getShopifyGraphQLOrderId(payload);
    const summary = await importShopifyOrderById(shopifyOrderId);

    return NextResponse.json({ topic, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import Shopify webhook order";

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
