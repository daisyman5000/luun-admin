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
  storeDomain: string;
};

let cachedConnection: CachedConnection | null = null;

export function getShopifyConfigStatus() {
  return {
    storeDomainExists: Boolean(process.env.SHOPIFY_STORE_DOMAIN),
    clientIdExists: Boolean(process.env.SHOPIFY_CLIENT_ID),
    clientSecretExists: Boolean(process.env.SHOPIFY_CLIENT_SECRET),
    webhookSecretExists: Boolean(process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET)
  };
}

function normalizeShopDomain(shopDomain: string) {
  return shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
}

function safeCompareHex(left: string, right: string) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function safeCompareBase64(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "base64");
  const rightBuffer = Buffer.from(right, "base64");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getShopifyConfig() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();

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

function getShopifyWebhookSecret() {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim() || process.env.SHOPIFY_CLIENT_SECRET?.trim();

  if (!secret) {
    throw new Error("Missing Shopify webhook secret");
  }

  return secret;
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

  const rawMessage = search
    .replace(/^\?/, "")
    .split("&")
    .filter((part) => part && !part.startsWith("hmac=") && !part.startsWith("signature="))
    .sort((left, right) => left.split("=")[0].localeCompare(right.split("=")[0]))
    .map((part) => {
      const [key, ...valueParts] = part.split("=");
      return `${key}=${valueParts.join("=")}`;
    })
    .join("&");

  const sortedEntries = Array.from(searchParams.entries())
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  const encodedParams = new URLSearchParams();
  sortedEntries.forEach(([key, value]) => {
    encodedParams.append(key, value);
  });

  const encodedMessage = encodedParams.toString();
  const decodedMessage = sortedEntries
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const messages = Array.from(new Set([rawMessage, encodedMessage, decodedMessage]));

  return messages.some((message) => {
    const digest = createHmac("sha256", clientSecret).update(message).digest("hex");
    return safeCompareHex(digest, hmac);
  });
}

export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null) {
  if (!hmacHeader) {
    return false;
  }

  let digest: string;

  try {
    digest = createHmac("sha256", getShopifyWebhookSecret())
      .update(rawBody, "utf8")
      .digest("base64");
  } catch {
    return false;
  }

  return safeCompareBase64(digest, hmacHeader);
}

export function getCallbackShopDomain(searchParams: URLSearchParams) {
  const shop = searchParams.get("shop");
  const shopDomain = shop ? normalizeShopDomain(shop) : "";

  if (!shopDomain || !SHOPIFY_DOMAIN_PATTERN.test(shopDomain)) {
    throw new Error("Shopify returned an invalid shop domain");
  }

  return shopDomain;
}

export function isExpectedShopifyShopDomain(shopDomain: string | null) {
  if (!shopDomain) {
    return false;
  }

  try {
    const { storeDomain } = getShopifyConfig();
    return normalizeShopDomain(shopDomain) === storeDomain;
  } catch {
    return false;
  }
}

export async function exchangeShopifyCodeForToken(code: string, shopDomain?: string) {
  const { clientId, clientSecret, storeDomain } = getShopifyConfig();
  const tokenShopDomain = shopDomain || storeDomain;
  const response = await fetch(`https://${tokenShopDomain}/admin/oauth/access_token`, {
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
  return saveShopifyConnectionForShop(storeDomain, accessToken, scope, userId);
}

export async function saveShopifyConnectionForShop(
  shopDomain: string,
  accessToken: string,
  scope: string | null,
  userId: string
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("shopify_connections").upsert(
    {
      shop_domain: shopDomain,
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

  cachedConnection = { accessToken, scope, storeDomain: shopDomain };
}

export async function getShopifyConnectionStatus() {
  try {
    const { storeDomain } = getShopifyConfig();
    const supabase = createAdminClient();
    let { data, error } = await supabase
      .from("shopify_connections")
      .select("shop_domain, updated_at")
      .eq("shop_domain", storeDomain)
      .maybeSingle();

    if (!data && !error) {
      const latest = await supabase
        .from("shopify_connections")
        .select("shop_domain, updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      data = latest.data;
      error = latest.error;
    }

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

async function getStoredShopifyConnection() {
  if (cachedConnection?.accessToken) {
    return cachedConnection;
  }

  const { storeDomain } = getShopifyConfig();
  const supabase = createAdminClient();
  let { data, error } = await supabase
    .from("shopify_connections")
    .select("shop_domain, access_token, scope")
    .eq("shop_domain", storeDomain)
    .maybeSingle();

  if (!data && !error) {
    const latest = await supabase
      .from("shopify_connections")
      .select("shop_domain, access_token, scope")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    data = latest.data;
    error = latest.error;
  }

  if (error) {
    throw new Error("Unable to load Shopify connection");
  }

  if (!data?.access_token) {
    throw new Error("Shopify is not connected. Connect Shopify before syncing orders.");
  }

  cachedConnection = {
    accessToken: data.access_token,
    scope: data.scope || null,
    storeDomain: data.shop_domain || storeDomain
  };

  return cachedConnection;
}

export async function shopifyAdminGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
) {
  const connection = await getStoredShopifyConnection();
  const response = await fetch(
    `https://${connection.storeDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": connection.accessToken
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

type ShopifyWebhookRegistrationResponse = {
  webhookSubscriptionCreate: {
    userErrors: Array<{
      message: string;
    }>;
  };
};

export async function registerShopifyOrderWebhooks(origin: string) {
  const callbackUrl = `${origin}/api/shopify/webhooks/orders`;
  const topics = ["ORDERS_CREATE", "ORDERS_UPDATED"];

  for (const topic of topics) {
    const data = await shopifyAdminGraphQL<ShopifyWebhookRegistrationResponse>(
      /* GraphQL */ `
        mutation RegisterOrderWebhook(
          $topic: WebhookSubscriptionTopic!
          $webhookSubscription: WebhookSubscriptionInput!
        ) {
          webhookSubscriptionCreate(
            topic: $topic
            webhookSubscription: $webhookSubscription
          ) {
            userErrors {
              message
            }
          }
        }
      `,
      {
        topic,
        webhookSubscription: {
          uri: callbackUrl
        }
      }
    );

    const errors = data.webhookSubscriptionCreate.userErrors;
    const blockingErrors = errors.filter(
      (error) => !error.message.toLowerCase().includes("already exists")
    );

    if (blockingErrors.length > 0) {
      throw new Error(`Shopify webhook registration failed: ${blockingErrors.map((error) => error.message).join("; ")}`);
    }
  }
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
