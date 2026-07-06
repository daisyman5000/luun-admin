import { NextResponse } from "next/server";
import { getPublicInventoryPayload } from "@/lib/public-inventory-data";

export const dynamic = "force-dynamic";

const allowedOrigins = new Set([
  "https://www.luun.ca",
  "https://luun.ca",
  "https://luun-pro.webflow.io",
  "https://preview.webflow.com"
]);

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    return allowedOrigins.has(origin) || url.hostname.endsWith(".webflow.io");
  } catch {
    return false;
  }
}

function publicInventoryHeaders(origin: string | null) {
  const headers = new Headers({
    "Cache-Control": "public, max-age=45, s-maxage=45, stale-while-revalidate=30",
    "Content-Type": "application/json",
    "Vary": "Origin"
  });

  if (isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin!);
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }

  return headers;
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    headers: publicInventoryHeaders(request.headers.get("origin")),
    status: 204
  });
}

export async function GET(request: Request) {
  const headers = publicInventoryHeaders(request.headers.get("origin"));

  try {
    return NextResponse.json(await getPublicInventoryPayload(), { headers });
  } catch {
    return NextResponse.json(
      { error: "Public inventory is not configured" },
      { headers, status: 500 }
    );
  }
}
