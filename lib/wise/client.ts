import "server-only";
import { randomUUID } from "node:crypto";

const WISE_API_BASE_URL = "https://api.wise.com/2026Q3";

type WiseAmount = {
  currency?: string;
  value?: number;
};

type WiseBalance = {
  id?: number;
  currency?: string;
  amount?: WiseAmount;
  availableAmount?: WiseAmount;
  type?: string;
  name?: string;
};

type WiseStatementTransaction = {
  amount?: WiseAmount;
  date?: string;
  details?: {
    description?: string;
    merchant?: {
      name?: string;
    };
  };
  referenceNumber?: string;
  type?: string;
};

type WiseStatement = {
  transactions?: WiseStatementTransaction[];
};

type WiseProfile = {
  id?: number | string;
  type?: string;
  details?: {
    name?: string;
  };
};

export type WiseBalanceSummary = {
  amount: number;
  currency: string;
  id: string;
  name: string;
  profileId: string;
  profileName: string;
  profileType: string;
  type: string;
};

export type WiseMetaExpense = {
  amount: number;
  currency: string;
  date: string;
  description: string;
  profileName: string;
};

export type WiseMetaSpendSummary = {
  expenses: WiseMetaExpense[];
  firstDetectedAt: string | null;
  lookbackDays: number;
  monthlyTotals: {
    amount: number;
    currency: string;
    month: string;
  }[];
  totals: {
    amount: number;
    currency: string;
  }[];
};

export type WiseSummary = {
  balances: WiseBalanceSummary[];
  configured: boolean;
  errors: string[];
  metaSpend: WiseMetaSpendSummary;
  profiles: {
    id: string;
    name: string;
    type: string;
  }[];
};

function getWiseConfig() {
  const apiToken = process.env.WISE_API_TOKEN?.trim();
  const apiBaseUrl = process.env.WISE_API_BASE_URL?.trim() || WISE_API_BASE_URL;
  const metaLookbackDays = Number(process.env.WISE_META_LOOKBACK_DAYS || 469);

  return {
    apiBaseUrl,
    apiToken,
    configured: Boolean(apiToken),
    metaLookbackDays: Number.isFinite(metaLookbackDays)
      ? Math.max(1, Math.min(metaLookbackDays, 469))
      : 469
  };
}

export function getWiseConfigStatus() {
  const config = getWiseConfig();

  return {
    apiTokenExists: Boolean(config.apiToken)
  };
}

async function wiseFetch<T>(path: string) {
  const config = getWiseConfig();

  if (!config.apiToken) {
    throw new Error("Missing Wise API token");
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "X-External-Correlation-Id": randomUUID()
    }
  });

  if (!response.ok) {
    throw new Error(`Wise API request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function getProfileName(profile: WiseProfile) {
  return profile.details?.name || `${profile.type || "Wise"} profile`;
}

function toBalanceSummary(balance: WiseBalance, profile: WiseProfile): WiseBalanceSummary | null {
  if (!balance.id || !balance.currency) {
    return null;
  }

  const amount = balance.availableAmount?.value ?? balance.amount?.value ?? 0;
  const profileId = String(profile.id);
  const profileType = profile.type || "Profile";

  return {
    amount: Number(amount),
    currency: balance.currency,
    id: `${profileId}-${balance.id}`,
    name: balance.name || `${balance.currency} balance`,
    profileId,
    profileName: getProfileName(profile),
    profileType,
    type: balance.type || "STANDARD"
  };
}

function emptyMetaSpend(lookbackDays: number): WiseMetaSpendSummary {
  return {
    expenses: [],
    firstDetectedAt: null,
    lookbackDays,
    monthlyTotals: [],
    totals: []
  };
}

function isMetaExpense(transaction: WiseStatementTransaction) {
  const text = [
    transaction.details?.description,
    transaction.details?.merchant?.name,
    transaction.referenceNumber,
    transaction.type
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("meta") ||
    text.includes("facebook") ||
    text.includes("fb ads") ||
    text.includes("instagram")
  );
}

function getStatementWindow(days: number) {
  const intervalEnd = new Date();
  const intervalStart = new Date(intervalEnd);
  intervalStart.setDate(intervalStart.getDate() - days);

  return {
    intervalEnd: intervalEnd.toISOString(),
    intervalStart: intervalStart.toISOString()
  };
}

async function getMetaExpensesForBalance(balance: WiseBalanceSummary, lookbackDays: number) {
  const { intervalEnd, intervalStart } = getStatementWindow(lookbackDays);
  const params = new URLSearchParams({
    currency: balance.currency,
    intervalEnd,
    intervalStart,
    statementLocale: "en",
    type: "COMPACT"
  });
  const statement = await wiseFetch<WiseStatement>(
    `/profiles/${balance.profileId}/balance-statements/${balance.id.split("-").at(-1)}/statement.json?${params.toString()}`
  );

  return (statement.transactions || [])
    .filter(isMetaExpense)
    .map((transaction) => {
      const amount = Math.abs(Number(transaction.amount?.value || 0));
      const currency = transaction.amount?.currency || balance.currency;
      const description =
        transaction.details?.merchant?.name ||
        transaction.details?.description ||
        transaction.referenceNumber ||
        "Meta expense";

      if (!transaction.date || amount <= 0) {
        return null;
      }

      return {
        amount,
        currency,
        date: transaction.date,
        description,
        profileName: balance.profileName
      };
    })
    .filter((expense): expense is WiseMetaExpense => Boolean(expense));
}

async function getMetaSpendSummary(balances: WiseBalanceSummary[], lookbackDays: number) {
  const expenses = (
    await Promise.all(
      balances.map((balance) => getMetaExpensesForBalance(balance, lookbackDays).catch(() => []))
    )
  )
    .flat()
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
  const totalsByCurrency = new Map<string, number>();
  const monthlyTotalsByCurrency = new Map<string, number>();

  for (const expense of expenses) {
    totalsByCurrency.set(expense.currency, (totalsByCurrency.get(expense.currency) || 0) + expense.amount);
    const month = expense.date.slice(0, 7);
    const key = `${month}:${expense.currency}`;
    monthlyTotalsByCurrency.set(key, (monthlyTotalsByCurrency.get(key) || 0) + expense.amount);
  }

  return {
    expenses,
    firstDetectedAt: expenses[0]?.date || null,
    lookbackDays,
    monthlyTotals: Array.from(monthlyTotalsByCurrency.entries())
      .map(([key, amount]) => {
        const [month, currency] = key.split(":");

        return {
          amount,
          currency,
          month
        };
      })
      .sort((left, right) => right.month.localeCompare(left.month)),
    totals: Array.from(totalsByCurrency.entries()).map(([currency, amount]) => ({
      amount,
      currency
    }))
  };
}

async function getWiseProfiles() {
  const profiles = await wiseFetch<WiseProfile[]>("/profiles");
  const validProfiles = profiles.filter((profile) => profile.id);

  if (validProfiles.length === 0) {
    throw new Error("Wise token worked, but no Wise profiles were returned.");
  }

  return validProfiles;
}

export async function getWiseSummary(): Promise<WiseSummary> {
  const config = getWiseConfig();

  if (!config.configured) {
    return {
      balances: [],
      configured: false,
      errors: [],
      metaSpend: emptyMetaSpend(config.metaLookbackDays),
      profiles: []
    };
  }

  const errors: string[] = [];
  let balances: WiseBalanceSummary[] = [];
  let profiles: WiseSummary["profiles"] = [];

  try {
    const wiseProfiles = await getWiseProfiles();
    profiles = wiseProfiles.map((profile) => ({
      id: String(profile.id),
      name: getProfileName(profile),
      type: profile.type || "Profile"
    }));

    const balanceResults = await Promise.all(
      wiseProfiles.map(async (profile) => {
        const profileId = String(profile.id);
        const rawBalances = await wiseFetch<WiseBalance[]>(
          `/profiles/${profileId}/balances?types=STANDARD,SAVINGS`
        );

        return rawBalances
          .map((balance) => toBalanceSummary(balance, profile))
          .filter((balance): balance is WiseBalanceSummary => Boolean(balance));
      })
    );

    balances = balanceResults.flat();

    try {
      const metaSpend = await getMetaSpendSummary(balances, config.metaLookbackDays);

      return {
        balances,
        configured: true,
        errors: Array.from(new Set(errors)),
        metaSpend,
        profiles
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unable to load Meta expenses from Wise");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unable to load Wise balances");
  }

  return {
    balances,
    configured: true,
    errors: Array.from(new Set(errors)),
    metaSpend: emptyMetaSpend(config.metaLookbackDays),
    profiles
  };
}

export async function checkWiseConnection() {
  const config = getWiseConfig();

  if (!config.configured) {
    return false;
  }

  try {
    const profiles = await getWiseProfiles();
    await Promise.all(
      profiles.map((profile) =>
        wiseFetch<WiseBalance[]>(`/profiles/${String(profile.id)}/balances?types=STANDARD,SAVINGS`)
      )
    );
    return true;
  } catch {
    return false;
  }
}
