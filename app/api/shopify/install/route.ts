import { NextResponse, type NextRequest } from "next/server";
import { canSyncShopifyOrders, getUserContext } from "@/lib/auth";
import {
  buildShopifyInstallUrl,
  createShopifyOAuthState
} from "@/lib/shopify/client";

export const runtime = "nodejs";

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

  const state = createShopifyOAuthState();
  const response = NextResponse.redirect(
    buildShopifyInstallUrl(request.nextUrl.origin, state)
  );

  response.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return response;
}
