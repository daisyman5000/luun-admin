import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { shopifyAdminGraphQL } from "@/lib/shopify/client";

type ShopifyMailingAddress = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  provinceCode?: string | null;
  country?: string | null;
  countryCodeV2?: string | null;
  zip?: string | null;
  phone?: string | null;
};

type ShopifyOrderNode = {
  id: string;
  name?: string | null;
  createdAt?: string | null;
  email?: string | null;
  phone?: string | null;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  currencyCode?: string | null;
  currentTotalPriceSet?: {
    shopMoney?: {
      amount?: string | null;
      currencyCode?: string | null;
    } | null;
  } | null;
  shippingAddress?: ShopifyMailingAddress | null;
  billingAddress?: ShopifyMailingAddress | null;
  lineItems?: {
    edges: Array<{
      node: {
        discountedTotalSet?: {
          shopMoney?: {
            amount?: string | null;
            currencyCode?: string | null;
          } | null;
        } | null;
        originalTotalSet?: {
          shopMoney?: {
            amount?: string | null;
            currencyCode?: string | null;
          } | null;
        } | null;
        title?: string | null;
        quantity?: number | null;
        sku?: string | null;
        variantTitle?: string | null;
      };
    }>;
  } | null;
};

type ShopifyOrdersResponse = {
  orders: {
    edges: Array<{
      node: ShopifyOrderNode;
    }>;
  };
};

export type ImportOrdersSummary = {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
};

const DEFAULT_IMPORT_SINCE_DATE = "2026-06-24";

const ORDER_FIELDS = /* GraphQL */ `
  id
  name
  createdAt
  email
  phone
  displayFinancialStatus
  displayFulfillmentStatus
  currencyCode
  currentTotalPriceSet {
    shopMoney {
      amount
      currencyCode
    }
  }
  shippingAddress {
    name
    firstName
    lastName
    address1
    address2
    city
    province
    provinceCode
    country
    countryCodeV2
    zip
    phone
  }
  billingAddress {
    name
    firstName
    lastName
    address1
    address2
    city
    province
    provinceCode
    country
    countryCodeV2
    zip
    phone
  }
  lineItems(first: 100) {
    edges {
      node {
        discountedTotalSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        originalTotalSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        title
        quantity
        sku
        variantTitle
      }
    }
  }
`;

const RECENT_ORDERS_QUERY = /* GraphQL */ `
  query RecentOrders($first: Int!, $query: String) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true, query: $query) {
      edges {
        node {
          ${ORDER_FIELDS}
        }
      }
    }
  }
`;

const ORDER_BY_ID_QUERY = /* GraphQL */ `
  query OrderById($id: ID!) {
    order: node(id: $id) {
      ... on Order {
        ${ORDER_FIELDS}
      }
    }
  }
`;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeFabricSlug(value: string) {
  const slug = slugify(value);

  if (slug === "off" || slug === "off-white" || slug === "offwhite") {
    return "offwhite";
  }

  return slug;
}

function moduleFromText(value: string) {
  const text = value.toLowerCase();

  if (/\bcorner\b/.test(text)) return "corner";
  if (/\barmless\b/.test(text)) return "armless";
  if (/\bottoman\b|\bpouf\b|\bfootstool\b/.test(text)) return "ottoman";

  return null;
}

function extractFabricSlug(order: ShopifyOrderNode) {
  const lineItems = order.lineItems?.edges || [];
  const candidates = lineItems.flatMap(({ node }) =>
    [node.variantTitle, node.sku, node.title].filter((value): value is string => Boolean(value))
  );

  for (const candidate of candidates) {
    const parts = candidate
      .split(/[|/,-]/)
      .map((part) => part.trim())
      .filter(Boolean);
    const fabric = parts.find((part) => {
      const lower = part.toLowerCase();
      return (
        !moduleFromText(lower) &&
        !/\bsofa\b|\bluun\b|\bmodule\b|\bmodular\b|\bsectional\b/.test(lower)
      );
    });

    if (fabric) {
      return normalizeFabricSlug(fabric);
    }
  }

  return "";
}

function tallyModules(order: ShopifyOrderNode) {
  const counts = {
    corner_qty: 0,
    armless_qty: 0,
    ottoman_qty: 0
  };

  (order.lineItems?.edges || []).forEach(({ node }) => {
    const quantity = Math.max(Number(node.quantity || 0), 0);
    const text = [node.title, node.variantTitle, node.sku].filter(Boolean).join(" ");
    const moduleSlug = moduleFromText(text);

    if (moduleSlug === "corner") counts.corner_qty += quantity;
    if (moduleSlug === "armless") counts.armless_qty += quantity;
    if (moduleSlug === "ottoman") counts.ottoman_qty += quantity;
  });

  return {
    ...counts,
    total_modules: counts.corner_qty + counts.armless_qty + counts.ottoman_qty
  };
}

function compactName(address?: ShopifyMailingAddress | null) {
  if (!address) return "";
  return (
    address.name ||
    [address.firstName, address.lastName].filter(Boolean).join(" ").trim()
  );
}

function mapOrderToRow(order: ShopifyOrderNode) {
  const total = order.currentTotalPriceSet?.shopMoney;
  const shippingName = compactName(order.shippingAddress);
  const billingName = compactName(order.billingAddress);
  const moduleCounts = tallyModules(order);

  return {
    shopify_order_id: order.id,
    order_number: order.name || "",
    customer_name: shippingName || billingName || "",
    customer_email: order.email || "",
    customer_phone:
      order.phone ||
      order.shippingAddress?.phone ||
      order.billingAddress?.phone ||
      "",
    total_price: total?.amount ? Number(total.amount) : null,
    currency: total?.currencyCode || order.currencyCode || "",
    payment_status: order.displayFinancialStatus || "",
    fulfillment_status: order.displayFulfillmentStatus || "",
    shipping_address_json: order.shippingAddress || null,
    fabric_slug: extractFabricSlug(order),
    ...moduleCounts,
    raw_shopify_json: order,
    created_at: order.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function normalizeImportLimit(limit: unknown) {
  const parsed = Number(limit);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100;
  }

  return Math.min(Math.floor(parsed), 250);
}

export function normalizeImportSinceDate(sinceDate: unknown) {
  if (typeof sinceDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(sinceDate)) {
    return DEFAULT_IMPORT_SINCE_DATE;
  }

  return sinceDate;
}

async function upsertShopifyOrderRows(
  rows: ReturnType<typeof mapOrderToRow>[],
  summary: ImportOrdersSummary
) {
  if (rows.length === 0) {
    return summary;
  }

  const supabase = createAdminClient();
  const shopifyIds = rows.map((row) => row.shopify_order_id);
  const { data: existingRows, error: existingError } = await supabase
    .from("shopify_orders")
    .select("shopify_order_id")
    .in("shopify_order_id", shopifyIds);

  if (existingError) {
    throw new Error("Unable to check existing Shopify orders");
  }

  const existingIds = new Set(
    (existingRows || []).map((row) => row.shopify_order_id).filter(Boolean)
  );

  const { error: upsertError } = await supabase
    .from("shopify_orders")
    .upsert(rows, { onConflict: "shopify_order_id" });

  if (upsertError) {
    throw new Error("Unable to import Shopify orders");
  }

  summary.updated = rows.filter((row) => existingIds.has(row.shopify_order_id)).length;
  summary.imported = rows.length - summary.updated;

  return summary;
}

export function getShopifyGraphQLOrderId(payload: Record<string, unknown>) {
  const graphqlId = payload.admin_graphql_api_id;

  if (typeof graphqlId === "string" && graphqlId.startsWith("gid://shopify/Order/")) {
    return graphqlId;
  }

  const id = payload.id;

  if (typeof id === "number" || typeof id === "string") {
    return `gid://shopify/Order/${id}`;
  }

  return "";
}

export async function importShopifyOrderById(shopifyOrderId: string): Promise<ImportOrdersSummary> {
  const summary: ImportOrdersSummary = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  if (!shopifyOrderId) {
    summary.skipped = 1;
    summary.errors.push("Skipped a webhook without a Shopify order id");
    return summary;
  }

  const data = await shopifyAdminGraphQL<{ order: ShopifyOrderNode | null }>(ORDER_BY_ID_QUERY, {
    id: shopifyOrderId
  });

  if (!data.order?.id) {
    summary.skipped = 1;
    summary.errors.push("Shopify order was not found");
    return summary;
  }

  return upsertShopifyOrderRows([mapOrderToRow(data.order)], summary);
}

export async function importRecentShopifyOrders(
  limit: number,
  sinceDate = DEFAULT_IMPORT_SINCE_DATE
): Promise<ImportOrdersSummary> {
  const summary: ImportOrdersSummary = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  const data = await shopifyAdminGraphQL<ShopifyOrdersResponse>(
    RECENT_ORDERS_QUERY,
    {
      first: limit,
      query: `created_at:>=${sinceDate}`
    }
  );
  const orders = data.orders.edges.map((edge) => edge.node);
  const rows = orders.flatMap((order) => {
    if (!order.id) {
      summary.skipped += 1;
      summary.errors.push("Skipped an order without a Shopify id");
      return [];
    }

    return [mapOrderToRow(order)];
  });

  return upsertShopifyOrderRows(rows, summary);
}
