import "server-only";
import { readWiseSummary,type WiseSources } from "./summary";
import {createBalanceRefresh} from './balance-refresh';
import { randomUUID } from "node:crypto";

const WISE_API_BASE_URL = "https://api.wise.com/2026Q3";

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
  asOf: string;
  sources: WiseSources;
  statementWindow: {from:string;to:string}|null;
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
  return {
    apiTokenExists: Boolean(process.env.WISE_API_TOKEN),
    requestsEnabled: process.env.LUUN_WISE_REQUESTS_ENABLED==='1'
  };
}

async function wiseFetch<T>(path: string) {
  if(process.env.LUUN_WISE_REQUESTS_ENABLED!=='1')throw new Error('Upstream Wise requests are disabled.');
  if(!/^\/profiles$|^\/profiles\/\d+\/balances\?types=STANDARD,SAVINGS$|^\/profiles\/\d+\/balance-statements\/\d+\/statement\.json\?/.test(path))throw new Error('Unsupported Wise read path.');
  if(path.includes('/balance-statements/')&&process.env.LUUN_WISE_STATEMENTS_ENABLED!=='1')throw new Error('Wise statement requests are disabled.');
  const config = getWiseConfig();

  if (!config.apiToken) {
    throw new Error("Missing Wise API token");
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
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

export async function getWiseSummary(): Promise<WiseSummary> {
 if(process.env.LUUN_WISE_REQUESTS_ENABLED!=='1')return readWiseSummary({configured:Boolean(process.env.WISE_API_TOKEN),requestsAllowed:false,lookbackDays:469,read:async()=>{throw new Error('Wise requests disabled');}});
 if(process.env.LUUN_WISE_STATEMENTS_ENABLED!=='1')return getWiseBalances();
 const config=getWiseConfig();return readWiseSummary({configured:config.configured,lookbackDays:config.metaLookbackDays,includeStatements:process.env.LUUN_WISE_STATEMENTS_ENABLED==='1',read:wiseFetch});
}

async function readWiseBalances():Promise<WiseSummary>{
 if(process.env.LUUN_WISE_REQUESTS_ENABLED!=='1')return readWiseSummary({configured:Boolean(process.env.WISE_API_TOKEN),requestsAllowed:false,includeStatements:false,lookbackDays:0,read:async()=>{throw new Error('Wise requests disabled');}});
 const config=getWiseConfig();return readWiseSummary({configured:config.configured,lookbackDays:0,includeStatements:false,read:wiseFetch});
}

const balanceRefresh=createBalanceRefresh(readWiseBalances);
export async function getWiseBalanceRefresh(){
 if(process.env.LUUN_WISE_REQUESTS_ENABLED!=='1')return {summary:await readWiseBalances(),refreshed:false,retryAfterSeconds:0,coalesced:false};
 return balanceRefresh();
}
export async function getWiseBalances():Promise<WiseSummary>{return (await getWiseBalanceRefresh()).summary;}
export async function checkWiseConnection(){
 if(process.env.LUUN_WISE_REQUESTS_ENABLED!=='1')return false;
 try{return (await getWiseBalances()).sources.balances.status==='ok';}catch{return false;}
}
