import { NextResponse, type NextRequest } from "next/server";
import { canSyncShopifyOrders, getUserContext } from "@/lib/auth";
import {
  exchangeShopifyCodeForToken,
  saveShopifyConnection,
  verifyShopifyCallback
} from "@/lib/shopify/client";

export const runtime = "nodejs";

function redirectToData(request: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/data?shopify=${status}`, request.url));
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

  if (!expectedState || !returnedState || expectedState !== returnedState || !code) {
    const response = redirectToData(request, "failed");
    response.cookies.delete("shopify_oauth_state");
    return response;
  }

  if (!verifyShopifyCallback(request.nextUrl.searchParams)) {
    const response = redirectToData(request, "failed");
    response.cookies.delete("shopify_oauth_state");
    return response;
  }

  try {
    const token = await exchangeShopifyCodeForToken(code);
    await saveShopifyConnection(token.accessToken, token.scope, user.id);

    const response = redirectToData(request, "connected");
    response.cookies.delete("shopify_oauth_state");
    return response;
  } catch {
    const response = redirectToData(request, "failed");
    response.cookies.delete("shopify_oauth_state");
    return response;
  }
}
