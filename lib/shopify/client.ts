import "server-only";

const SHOPIFY_API_VERSION = "2025-10";

type ShopifyGraphQLError = {
  message: string;
};

type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: ShopifyGraphQLError[];
};

function getShopifyConfig() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!storeDomain || !accessToken) {
    throw new Error("Missing Shopify Admin API configuration");
  }

  return {
    accessToken,
    storeDomain: storeDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")
  };
}

export async function shopifyAdminGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
) {
  const { accessToken, storeDomain } = getShopifyConfig();
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
