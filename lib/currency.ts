import "server-only";

type FrankfurterResponse = {
  rates?: Record<string, number>;
};

export type CadRateMap = Record<string, number | null>;

export async function getCadRates(currencies: string[]) {
  const uniqueCurrencies = Array.from(new Set(currencies.map((currency) => currency.toUpperCase()))).filter(
    (currency) => currency && currency !== "CAD"
  );
  const rates: CadRateMap = { CAD: 1 };

  await Promise.all(
    uniqueCurrencies.map(async (currency) => {
      try {
        const response = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=CAD`, {
          next: { revalidate: 3600 }
        });

        if (!response.ok) {
          rates[currency] = null;
          return;
        }

        const body = (await response.json()) as FrankfurterResponse;
        const rate = body.rates?.CAD;
        rates[currency] = typeof rate === "number" && Number.isFinite(rate) ? rate : null;
      } catch {
        rates[currency] = null;
      }
    })
  );

  return rates;
}

export function convertToCad(amount: number, currency: string | null | undefined, rates: CadRateMap) {
  const normalizedCurrency = (currency || "CAD").toUpperCase();
  const rate = rates[normalizedCurrency];

  if (normalizedCurrency === "CAD") return amount;
  if (typeof rate !== "number") return null;
  return amount * rate;
}
