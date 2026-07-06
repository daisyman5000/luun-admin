export function normalizeFabricSlug(value: string | null | undefined) {
  const slug = (value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug === "bamboo") return "jade";
  if (slug === "aqua") return "skyblue";
  if (slug === "sky-blue") return "skyblue";
  if (slug === "dark-gray") return "dark-grey";
  if (slug === "off" || slug === "off-white") return "offwhite";

  return slug;
}

export function normalizeModuleSlug(value: string | null | undefined) {
  const slug = (value || "").trim().toLowerCase();

  if (slug === "cor" || slug === "corner-chair") return "corner";
  if (slug === "side" || slug === "side-chair") return "side";
  if (slug === "ott" || slug === "ottoman") return "ottoman";

  return slug.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
