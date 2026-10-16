import type {WiseSummary} from './client';
export type BalanceRefresh={summary:WiseSummary;refreshed:boolean;retryAfterSeconds:number;coalesced:boolean};
// A single server runtime coalesces concurrent reads and spaces refresh attempts, including failures.
// This is not a distributed account-wide rate limiter across independent serverless instances.
export function createBalanceRefresh(read:()=>Promise<WiseSummary>,clock=()=>Date.now(),cooldownMs=60000){
 let pending:Promise<WiseSummary>|null=null,lastAttempt:number|null=null,last:WiseSummary|null=null,lastFailure=false;
 return async function refresh():Promise<BalanceRefresh>{
  if(pending)return {summary:await pending,refreshed:false,retryAfterSeconds:Math.ceil(cooldownMs/1000),coalesced:true};
  const remaining=lastAttempt===null?0:Math.max(0,cooldownMs-(clock()-lastAttempt));
  if(remaining>0){if(lastFailure)throw new Error('A balance refresh failed recently. Wait before trying again.');if(last)return {summary:last,refreshed:false,retryAfterSeconds:Math.ceil(remaining/1000),coalesced:false};throw new Error(lastFailure?'A balance refresh failed recently. Wait before trying again.':'A balance refresh is already cooling down.');}
  lastAttempt=clock();pending=read();
  try{last=await pending;lastFailure=false;return {summary:last,refreshed:true,retryAfterSeconds:Math.ceil(cooldownMs/1000),coalesced:false};}catch{lastFailure=true;throw new Error('Balance refresh failed; no zero balance is assumed.');}finally{pending=null;}
 };
}
