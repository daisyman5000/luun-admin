import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const SHOPIFY_API_VERSION = "2025-10";
const SHOPIFY_SCOPES = ["read_orders"];
const SHOPIFY_DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

type ShopifyGraphQLError = {
  message: string;
};

type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: ShopifyGraphQLError[];
};

type ShopifyTokenResponse = {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type CachedConnection = {
  accessToken: string;
  scope: string | null;
};

let cachedConnection: CachedConnection | null = null;

export function getShopifyConfigStatus() {
  return {
    storeDomainExists: Boolean(process.env.SHOPIFY_STORE_DOMAIN),
    clientIdExists: Boolean(process.env.SHOPIFY_CLIENT_ID),
    clientSecretExists: Boolean(process.env.SHOPIFY_CLIENT_SECRET)
  };
}

function normalizeShopDomain(shopDomain: string) {
  return shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
}

function getShopifyConfig() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!storeDomain || !clientId || !clientSecret) {
    throw new Error("Missing Shopify app configuration");
  }

  const normalizedStoreDomain = normalizeShopDomain(storeDomain);

  if (!SHOPIFY_DOMAIN_PATTERN.test(normalizedStoreDomain)) {
    throw new Error("SHOPIFY_STORE_DOMAIN must be a myshopify.com domain");
  }

  return {
    clientId,
    clientSecret,
    storeDomain: normalizedStoreDomain
  };
}

export function createShopifyOAuthState() {
  return randomBytes(32).toString("hex");
}

export function buildShopifyInstallUrl(origin: string, state: string) {
  const { clientId, storeDomain } = getShopifyConfig();
  const authorizeUrl = new URL(`https://${storeDomain}/admin/oauth/authorize`);

  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("scope", SHOPIFY_SCOPES.join(","));
  authorizeUrl.searchParams.set("redirect_uri", `${origin}/api/shopify/callback`);
  authorizeUrl.searchParams.set("state", state);

  return authorizeUrl.toString();
}

export function verifyShopifyCallback(search: string) {
  const { clientSecret, storeDomain } = getShopifyConfig();
  const searchParams = new URLSearchParams(search);
  const shop = searchParams.get("shop");
  const hmac = searchParams.get("hmac");

  if (!shop || normalizeShopDomain(shop) !== storeDomain) {
    return false;
  }

  if (!hmac) {
    return false;
  }

  const message = search
    .replace(/^\?/, "")
    .split("&")
    .filter((part) => part && !part.startsWith("hmac=") && !part.startsWith("signature="))
    .sort((left, right) => left.split("=")[0].localeCompare(right.split("=")[0]))
    .map((part) => {
      const [key, ...valueParts] = part.split("=");
      return `${key}=${valueParts.join("=")}`;
    })
    .join("&");

  const digest = createHmac("sha256", clientSecret).update(message).digest("hex");
  const expected = Buffer.from(digest, "hex");
  const received = Buffer.from(hmac, "hex");

  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function exchangeShopifyCodeForToken(code: string) {
  const { clientId, clientSecret, storeDomain } = getShopifyConfig();
  const response = await fetch(`https://${storeDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Shopify token exchange failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ShopifyTokenResponse;

  if (!payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Shopify did not return an access token");
  }

  return {
    accessToken: payload.access_token,
    scope: payload.scope || null
  };
}

export async function saveShopifyConnection(accessToken: string, scope: string | null, userId: string) {
  const { storeDomain } = getShopifyConfig();
  const supabase = createAdminClient();
  const { error } = await supabase.from("shopify_connections").upsert(
    {
      shop_domain: storeDomain,
      access_token: accessToken,
      scope,
      installed_by: userId,
      updated_at: new Date().toISOString()
    },
    { onConflict: "shop_domain" }
  );

  if (error) {
    throw new Error("Unable to save Shopify connection");
  }

  cachedConnection = { accessToken, scope };
}

export async function getShopifyConnectionStatus() {
  try {
    const { storeDomain } = getShopifyConfig();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("shopify_connections")
      .select("shop_domain, updated_at")
      .eq("shop_domain", storeDomain)
      .maybeSingle();

    if (error) {
      return { connected: false, updatedAt: null };
    }

    return {
      connected: Boolean(data),
      updatedAt: data?.updated_at || null
    };
  } catch {
    return { connected: false, updatedAt: null };
  }
}

async function getStoredShopifyAccessToken() {
  if (cachedConnection?.accessToken) {
    return cachedConnection.accessToken;
  }

  const { storeDomain } = getShopifyConfig();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shopify_connections")
    .select("access_token, scope")
    .eq("shop_domain", storeDomain)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load Shopify connection");
  }

  if (!data?.access_token) {
    throw new Error("Shopify is not connected. Connect Shopify before syncing orders.");
  }

  cachedConnection = {
    accessToken: data.access_token,
    scope: data.scope || null
  };

  return cachedConnection.accessToken;
}

export async function shopifyAdminGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
) {
  const { storeDomain } = getShopifyConfig();
  const accessToken = await getStoredShopifyAccessToken();
  const response = await fetch(
    `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify Admin API request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ShopifyGraphQLResponse<T>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("Shopify Admin API returned no data");
  }

  return payload.data;
}

export async function checkShopifyAdminConnection() {
  try {
    await shopifyAdminGraphQL<{ shop: { id: string } }>(/* GraphQL */ `
      query ShopifyConnectionCheck {
        shop {
          id
        }
      }
    `);

    return true;
  } catch {
    return false;
  }
}
