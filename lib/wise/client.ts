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

export type WiseSummary = {
  balances: WiseBalanceSummary[];
  configured: boolean;
  errors: string[];
  profiles: {
    id: string;
    name: string;
    type: string;
  }[];
};

function getWiseConfig() {
  const apiToken = process.env.WISE_API_TOKEN?.trim();
  const apiBaseUrl = process.env.WISE_API_BASE_URL?.trim() || WISE_API_BASE_URL;

  return {
    apiBaseUrl,
    apiToken,
    configured: Boolean(apiToken)
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
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unable to load Wise balances");
  }

  return {
    balances,
    configured: true,
    errors: Array.from(new Set(errors)),
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
