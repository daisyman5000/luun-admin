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

export type WiseBalanceSummary = {
  amount: number;
  currency: string;
  id: number;
  name: string;
  type: string;
};

export type WiseSummary = {
  balances: WiseBalanceSummary[];
  configured: boolean;
  errors: string[];
  profileId: string | null;
};

function getWiseConfig() {
  const apiToken = process.env.WISE_API_TOKEN?.trim();
  const profileId = process.env.WISE_PROFILE_ID?.trim();
  const apiBaseUrl = process.env.WISE_API_BASE_URL?.trim() || WISE_API_BASE_URL;

  return {
    apiBaseUrl,
    apiToken,
    configured: Boolean(apiToken && profileId),
    profileId
  };
}

export function getWiseConfigStatus() {
  const config = getWiseConfig();

  return {
    apiTokenExists: Boolean(config.apiToken),
    profileIdExists: Boolean(config.profileId)
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

function toBalanceSummary(balance: WiseBalance): WiseBalanceSummary | null {
  if (!balance.id || !balance.currency) {
    return null;
  }

  const amount = balance.availableAmount?.value ?? balance.amount?.value ?? 0;

  return {
    amount: Number(amount),
    currency: balance.currency,
    id: balance.id,
    name: balance.name || `${balance.currency} balance`,
    type: balance.type || "STANDARD"
  };
}

export async function getWiseSummary(): Promise<WiseSummary> {
  const config = getWiseConfig();

  if (!config.configured || !config.profileId) {
    return {
      balances: [],
      configured: false,
      errors: [],
      profileId: config.profileId || null
    };
  }

  const errors: string[] = [];
  let balances: WiseBalanceSummary[] = [];

  try {
    const rawBalances = await wiseFetch<WiseBalance[]>(
      `/profiles/${config.profileId}/balances?types=STANDARD,SAVINGS`
    );
    balances = rawBalances
      .map(toBalanceSummary)
      .filter((balance): balance is WiseBalanceSummary => Boolean(balance));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unable to load Wise balances");
  }

  return {
    balances,
    configured: true,
    errors: Array.from(new Set(errors)),
    profileId: config.profileId
  };
}

export async function checkWiseConnection() {
  const config = getWiseConfig();

  if (!config.configured || !config.profileId) {
    return false;
  }

  try {
    await wiseFetch<WiseBalance[]>(`/profiles/${config.profileId}/balances?types=STANDARD,SAVINGS`);
    return true;
  } catch {
    return false;
  }
}
