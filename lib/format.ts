export function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatMoney(amount?: number | null, currency = "USD") {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD"
  }).format(Number(amount));
}
