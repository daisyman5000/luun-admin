import { NextResponse, type NextRequest } from "next/server";
import { canSyncShopifyOrders, getUserContext } from "@/lib/auth";
import {
  exchangeShopifyCodeForToken,
  getCallbackShopDomain,
  saveShopifyConnectionForShop,
  verifyShopifyCallback
} from "@/lib/shopify/client";

export const runtime = "nodejs";

function redirectToData(request: NextRequest, status: string, reason?: string) {
  const url = new URL("/data", request.url);
  url.searchParams.set("shopify", status);

  if (reason) {
    url.searchParams.set("shopify_reason", reason);
  }

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { profile, user } = await getUserContext();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!canSyncShopifyOrders(profile?.role)) {
    return NextResponse.json(
      { error: "Not authorized to connect Shopify" },
      { status: 403 }
    );
  }

  const expectedState = request.cookies.get("shopify_oauth_state")?.value;
  const returnedState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const shopifyError = request.nextUrl.searchParams.get("error");

  if (shopifyError) {
    const response = redirectToData(request, "failed", shopifyError);
    response.cookies.delete("shopify_oauth_state");
    return response;
  }

  if (!expectedState || !returnedState || expectedState !== returnedState || !code) {
    const response = redirectToData(request, "failed", "state");
    response.cookies.delete("shopify_oauth_state");
    return response;
  }

  let shopDomain: string;

  try {
    shopDomain = getCallbackShopDomain(request.nextUrl.searchParams);
  } catch {
    const response = redirectToData(request, "failed", "shop");
    response.cookies.delete("shopify_oauth_state");
    return response;
  }

  verifyShopifyCallback(request.nextUrl.search);

  try {
    const token = await exchangeShopifyCodeForToken(code, shopDomain);
    await saveShopifyConnectionForShop(shopDomain, token.accessToken, token.scope, user.id);

    const response = redirectToData(request, "connected");
    response.cookies.delete("shopify_oauth_state");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const reason = message.includes("save") ? "save" : "token";
    const response = redirectToData(request, "failed", reason);
    response.cookies.delete("shopify_oauth_state");
    return response;
  }
}
