import {accountGroup} from './account-groups';
import type {WiseSummary,WiseMetaSpendSummary,WiseBalanceSummary} from './client';
export type WiseSourceStatus='offline'|'unconfigured'|'ok'|'partial'|'error'|'blocked';
export type WiseSource={status:WiseSourceStatus;attemptedAt:string|null;retrievedAt:string|null;successfulReads:number;failedReads:number};
export type WiseSources={balances:WiseSource;statements:WiseSource};
type Profile={id?:string|number;type?:string;details?:{name?:string}};
type Balance={id?:string|number;currency?:string;availableAmount?:{value?:number};amount?:{value?:number};name?:string;type?:string};
type Transaction={amount?:{value?:number;currency?:string};date?:string;details?:{description?:string;merchant?:{name?:string}};referenceNumber?:string;type?:string};
const emptySpend=(lookbackDays:number):WiseMetaSpendSummary=>({expenses:[],firstDetectedAt:null,lookbackDays,monthlyTotals:[],totals:[]});
const state=(status:WiseSourceStatus,attemptedAt:string|null=null,retrievedAt:string|null=null,successfulReads=0,failedReads=0):WiseSource=>({status,attemptedAt,retrievedAt,successfulReads,failedReads});
function aggregate(spend:WiseMetaSpendSummary){
 spend.expenses.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));spend.firstDetectedAt=spend.expenses[0]?.date||null;
 const totals=new Map<string,number>(),months=new Map<string,number>();
 for(const e of spend.expenses){totals.set(e.currency,(totals.get(e.currency)||0)+e.amount);const key=e.date.slice(0,7)+':'+e.currency;months.set(key,(months.get(key)||0)+e.amount);}
 spend.totals=[...totals].map(([currency,amount])=>({currency,amount}));spend.monthlyTotals=[...months].map(([key,amount])=>({month:key.slice(0,7),currency:key.slice(8),amount})).sort((a,b)=>b.month.localeCompare(a.month));return spend;
}
export async function readWiseSummary({configured,lookbackDays,read,requestsAllowed=true,includeStatements=true,clock=()=>Date.now()}:{configured:boolean;lookbackDays:number;requestsAllowed?:boolean;includeStatements?:boolean;read:<T>(path:string)=>Promise<T>;clock?:()=>number}):Promise<WiseSummary>{
 const now=()=>new Date(clock()).toISOString();const asOf=now();const result:WiseSummary={configured,asOf,statementWindow:null,balances:[],profiles:[],metaSpend:emptySpend(lookbackDays),errors:[],sources:{balances:state('unconfigured'),statements:state('unconfigured')}};
 if(!requestsAllowed){result.sources={balances:state('offline'),statements:state('offline')};result.errors.push('Upstream Wise requests are disabled. No current bank balance or spending is asserted.');return result;}
 if(!configured)return result;
 result.sources.balances=state('error',asOf);result.sources.statements=state('blocked');
 let profiles:Profile[];try{const raw=await read<Profile[]>('/profiles');if(!Array.isArray(raw)||!raw.length||raw.some(p=>!p.id||!/^\d+$/.test(String(p.id))))throw new Error();profiles=raw;}catch{result.errors.push('Wise profiles could not be read; balances and spending are unavailable.');return result;}
 result.profiles=profiles.map(p=>({id:String(p.id),name:p.details?.name||`${p.type||'Wise'} profile`,type:p.type||'Profile'}));
 let good=0,bad=0;
 await Promise.all(profiles.map(async(profile)=>{try{const rows=await read<Balance[]>(`/profiles/${String(profile.id)}/balances?types=STANDARD,SAVINGS`);if(!Array.isArray(rows))throw new Error();good++;
  for(const b of rows){const amount=b.availableAmount?.value??b.amount?.value;if(!b.id||!/^\d+$/.test(String(b.id))||!b.currency||!(/^[A-Z]{3}$/.test(b.currency))||!Number.isFinite(amount)){bad++;continue;}result.balances.push({id:String(profile.id)+'-'+String(b.id),currency:b.currency,amount:amount!,name:b.name||b.currency+' balance',profileId:String(profile.id),profileName:profile.details?.name||`${profile.type||'Wise'} profile`,profileType:profile.type||'Profile',type:b.type||'STANDARD'});}
 }catch{bad++;}}));
 result.sources.balances=state(bad?(good?'partial':'error'):'ok',asOf,good?now():null,good,bad);
 if(bad)result.errors.push('Some Wise balance reads failed or had missing amounts. Returned balances are incomplete, not a complete cash total.');
 if(!result.balances.length){result.sources.statements=state('blocked');result.errors.push('No usable balances were returned to identify statement sources; spending is unavailable.');return result;}
 if(!includeStatements){result.sources.statements=state('blocked');return result;}
 const attemptedAt=now();const windowEnd=new Date(clock()),windowStart=new Date(windowEnd);windowStart.setDate(windowStart.getDate()-lookbackDays);result.statementWindow={from:windowStart.toISOString(),to:windowEnd.toISOString()};let statementGood=0,statementBad=0;
 await Promise.all(result.balances.map(async(balance:WiseBalanceSummary)=>{try{
  const params=new URLSearchParams({currency:balance.currency,intervalStart:windowStart.toISOString(),intervalEnd:windowEnd.toISOString(),statementLocale:'en',type:'COMPACT'});
  const statement=await read<{transactions?:Transaction[]}>(`/profiles/${balance.profileId}/balance-statements/${balance.id.split('-').at(-1)}/statement.json?${params}`);if(!Array.isArray(statement.transactions))throw new Error();
  const records:WiseMetaSpendSummary['expenses']=[];
  for(const t of statement.transactions){const text=[t.details?.description,t.details?.merchant?.name,t.referenceNumber,t.type].filter(Boolean).join(' ').toLowerCase();if(!['meta','facebook','fb ads','instagram'].some(v=>text.includes(v)))continue;
   if(!t.date||!Number.isFinite(Date.parse(t.date))||!Number.isFinite(t.amount?.value))throw new Error();if(t.date.slice(5,7)==='05')continue; // Preserve the existing report's May exclusion.
   const amount=Math.abs(Number(t.amount!.value));if(amount<=0)continue;
   records.push({amount:Math.abs(amount),currency:t.amount?.currency||balance.currency,date:t.date,description:t.details?.merchant?.name||t.details?.description||t.referenceNumber||'Meta expense',profileName:balance.profileName});
  }result.metaSpend.expenses.push(...records);statementGood++;
 }catch{statementBad++;}}));
 const incomplete=statementBad>0||bad>0;result.sources.statements=state(incomplete?(statementGood?'partial':'error'):'ok',attemptedAt,statementGood?now():null,statementGood,statementBad);
 if(incomplete)result.errors.push('Wise statements are incomplete. Missing transactions must not be interpreted as zero spending.');
 aggregate(result.metaSpend);return result;
}
export function wiseOperationalData(summary:WiseSummary|null,now:number,maxAgeMs=300000){
 const balance=summary?.sources?.balances,statement=summary?.sources?.statements;
 const stale=(source:WiseSource|undefined)=>!source?.retrievedAt||!Number.isFinite(Date.parse(source.retrievedAt))||now-Date.parse(source.retrievedAt)>maxAgeMs||Date.parse(source.retrievedAt)>now+60000;
 const balanceUsable=!!summary?.configured&&!!balance&&['ok','partial'].includes(balance.status)&&!stale(balance);
 const spendingUsable=!!summary?.configured&&statement?.status==='ok'&&balance?.status==='ok'&&!stale(statement)&&!stale(balance);
 const warnings:string[]=[];
 if(balance?.status==='offline')warnings.push('Wise requests are disabled. No current balances or spending are asserted.');
 else if(!summary?.configured)warnings.push('This runtime has no Wise configuration; the hosted connection state is unknown.');
 else{if(!balance||balance.status==='error'||balance.status==='blocked')warnings.push('Wise balances could not be read.');if(balance?.status==='partial')warnings.push('Wise returned partial balances; cash coverage is provisional.');if(balance?.retrievedAt&&stale(balance))warnings.push('Wise balance snapshot is stale; refresh before relying on cash coverage.');if(!spendingUsable)warnings.push('Wise statement spending is unavailable, partial or stale; no zero spending or acquisition cost is assumed.');}
 const businessRows=balanceUsable?summary!.balances.filter(row=>accountGroup(row.profileType)==='corporate'):[];
 if(balanceUsable&&summary!.balances.some(row=>accountGroup(row.profileType)!=='corporate'))warnings.push('Personal or unclassified account balances are displayed separately and excluded from the business reserve calculation.');
 return {businessBalances:businessRows.length?businessRows.map(row=>({currency:row.currency,amount:row.amount})):null,balances:balanceUsable&&summary!.balances.length?summary!.balances.map(b=>({currency:b.currency,amount:b.amount})):null,cashComplete:balanceUsable&&balance?.status==='ok',cashRetrievedAt:balance?.retrievedAt||null,cashStatus:balance?.status==='offline'?'offline':!summary?.configured?'unconfigured':balance?.retrievedAt&&stale(balance)?'stale':balance?.status||'error',spendingStatus:statement?.status==='offline'?'offline':!summary?.configured?'unconfigured':statement?.retrievedAt&&stale(statement)?'stale':statement?.status||'blocked',spendingRetrievedAt:statement?.retrievedAt||null,spendingUsable,warnings,spendCADSince(since:number){return spendingUsable&&summary?.statementWindow&&since>=Date.parse(summary.statementWindow.from)?summary!.metaSpend.expenses.filter(e=>e.currency==='CAD'&&Date.parse(e.date)>=since&&Date.parse(e.date)<=now).reduce((sum,e)=>sum+e.amount,0):null;}};
}
