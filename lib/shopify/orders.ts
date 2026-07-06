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

const RECENT_ORDERS_QUERY = /* GraphQL */ `
  query RecentOrders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
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
        }
      }
    }
  }
`;

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
    raw_shopify_json: order,
    created_at: order.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function normalizeImportLimit(limit: unknown) {
  const parsed = Number(limit);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }

  return Math.min(Math.floor(parsed), 100);
}

export async function importRecentShopifyOrders(limit: number): Promise<ImportOrdersSummary> {
  const summary: ImportOrdersSummary = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  const data = await shopifyAdminGraphQL<ShopifyOrdersResponse>(RECENT_ORDERS_QUERY, {
    first: limit
  });
  const orders = data.orders.edges.map((edge) => edge.node);
  const rows = orders.flatMap((order) => {
    if (!order.id) {
      summary.skipped += 1;
      summary.errors.push("Skipped an order without a Shopify id");
      return [];
    }

    return [mapOrderToRow(order)];
  });

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
