import type { InventoryRow } from "@/lib/types";

type PublicInventorySource = Pick<
  InventoryRow,
  "fabric_slug" | "module_slug" | "available_qty" | "reserved_qty"
>;

function normalizeBuilderFabricSlug(value: string | null | undefined) {
  const slug = (value || "").trim().toLowerCase();

  if (slug === "off" || slug === "offwhite") return "off-white";
  if (slug === "dark-gray") return "dark-grey";
  if (slug === "aqua") return "skyblue";
  if (slug === "bamboo") return "jade";

  return slug;
}

function normalizeBuilderModuleSlug(value: string | null | undefined) {
  const slug = (value || "").trim().toLowerCase();

  if (slug === "side") return "armless";
  if (slug === "cor") return "corner";
  if (slug === "ott") return "ottoman";

  return slug;
}

export function buildPublicInventory(rows: PublicInventorySource[]) {
  return rows.reduce<Record<string, Record<string, number>>>((acc, row) => {
    const fabricSlug = normalizeBuilderFabricSlug(row.fabric_slug);
    const moduleSlug = normalizeBuilderModuleSlug(row.module_slug);

    if (!fabricSlug || !moduleSlug) return acc;

    const available = Number(row.available_qty || 0) - Number(row.reserved_qty || 0);
    acc[fabricSlug] = acc[fabricSlug] || {};
    acc[fabricSlug][moduleSlug] = (acc[fabricSlug][moduleSlug] || 0) + Math.max(available, 0);

    return acc;
  }, {});
}
