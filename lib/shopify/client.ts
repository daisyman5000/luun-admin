import "server-only";

const SHOPIFY_API_VERSION = "2025-10";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

type ShopifyGraphQLError = {
  message: string;
};

type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: ShopifyGraphQLError[];
};

type ShopifyTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number | null;
};

let cachedToken: CachedToken | null = null;

export function getShopifyConfigStatus() {
  return {
    storeDomainExists: Boolean(process.env.SHOPIFY_STORE_DOMAIN),
    clientIdExists: Boolean(process.env.SHOPIFY_CLIENT_ID),
    clientSecretExists: Boolean(process.env.SHOPIFY_CLIENT_SECRET)
  };
}

function getShopifyConfig() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!storeDomain || !clientId || !clientSecret) {
    throw new Error("Missing Shopify Admin API configuration");
  }

  return {
    clientId,
    clientSecret,
    storeDomain: storeDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")
  };
}

function hasUsableCachedToken() {
  if (!cachedToken) return false;
  if (!cachedToken.expiresAt) return true;
  return cachedToken.expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now();
}

async function requestAdminAccessToken() {
  if (hasUsableCachedToken()) {
    return cachedToken!.accessToken;
  }

  const { clientId, clientSecret, storeDomain } = getShopifyConfig();
  const response = await fetch(`https://${storeDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Shopify token request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ShopifyTokenResponse;

  if (!payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Shopify did not return an access token");
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : null
  };

  return cachedToken.accessToken;
}

export async function shopifyAdminGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
) {
  const { storeDomain } = getShopifyConfig();
  const accessToken = await requestAdminAccessToken();
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
