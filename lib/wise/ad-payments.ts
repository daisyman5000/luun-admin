import type {AdEvidence} from '../acquisition';
import {validAcquisitionMonth} from '../acquisition';
export type WiseAdPaymentResult={evidence:AdEvidence[];candidates:{id:string;date:string;amount:number;currency:string;classification:'ad_merchant'|'unclassified_paypal';description:string}[];retrievedAt:string|null;attemptedAt:string;complete:boolean;warnings:string[]};
export async function readMonthlyWiseAdPayments(month:string,balances:{id:string;profileId:string;currency:string}[],read:<T>(path:string)=>Promise<T>,clock=()=>Date.now()):Promise<WiseAdPaymentResult>{
 if(!validAcquisitionMonth(month))throw Error('Invalid month');const start=new Date(month+'-01T00:00:00Z'),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
 // Include boundary settlement lag; service-month assignment still requires receipt evidence.
 start.setUTCDate(start.getUTCDate()-3);end.setUTCDate(end.getUTCDate()+7);
 const result:WiseAdPaymentResult={evidence:[],candidates:[],retrievedAt:null,attemptedAt:new Date(clock()).toISOString(),complete:balances.length>0,warnings:['Only currently returned Wise balance accounts are covered; closed accounts, PayPal balance and TD Visa are not established as covered.','Statement window includes three days before and seven days after the selected month for settlement matching.']};
 const seen=new Map<string,string>();let successfulReads=0;
 for(const balance of balances){try{
  if(!/^\d+$/.test(balance.profileId)||!/^\d+$/.test(balance.id.split('-').at(-1)||''))throw Error('Invalid account');
  const params=new URLSearchParams({currency:balance.currency,intervalStart:start.toISOString(),intervalEnd:end.toISOString(),statementLocale:'en',type:'COMPACT'});
  const statement=await read<{transactions?:{referenceNumber?:string;type?:string;date?:string;amount?:{value?:number;currency?:string};details?:{description?:string;merchant?:{name?:string}}}[]}>(`/profiles/${balance.profileId}/balance-statements/${balance.id.split('-').at(-1)}/statement.json?${params}`);
  if(!Array.isArray(statement.transactions))throw Error('Missing transactions');successfulReads++;
  for(const t of statement.transactions){const text=[t.details?.merchant?.name,t.details?.description].filter(Boolean).join(' ');const ad=/\b(?:facebook|fbads|fb\s*ads|meta\s*(?:ads|platforms|advertising))\b/i.test(text);const paypal=/\bpaypal\b/i.test(text);if(!ad&&!paypal)continue;
   const amount=t.amount?.value,currency=t.amount?.currency||balance.currency;
   if(!t.referenceNumber||!t.date||!Number.isFinite(Date.parse(t.date))||typeof amount!=='number'||!Number.isFinite(amount)||!(/^[A-Z]{3}$/.test(currency))){result.complete=false;continue;}if(amount===0)continue;
   const id=`wise:${balance.profileId}:${t.referenceNumber}`;const fingerprint=JSON.stringify([t.date,amount,currency]);if(seen.has(id)){if(seen.get(id)!==fingerprint){result.complete=false;result.warnings.push('Conflicting duplicate transaction references require reconciliation.');}continue;}seen.set(id,fingerprint);
   const direction=t.type?.toUpperCase();if((direction==='DEBIT'&&amount>0)||(direction==='CREDIT'&&amount<0)){result.complete=false;result.warnings.push('A statement amount conflicts with its debit/credit direction; review rather than reversing its meaning.');continue;}const kind=direction==='DEBIT'?'charge':direction==='CREDIT'?'credit':amount<0?'charge':'credit';result.evidence.push({id,source:'wise',verified:true,merchant:ad?'meta':'unknown',amount:Math.abs(amount),currency,kind,serviceMonth:null,settledAt:t.date,settlementIds:[]});
   result.candidates.push({id,date:t.date,amount:Math.abs(amount),currency,classification:ad?'ad_merchant':'unclassified_paypal',description:text.slice(0,180)});
  }
 }catch(error){result.complete=false;const message=error instanceof Error?error.message:'';result.warnings.push(message.includes('status 403')?'Wise statement access was rejected (403). An owner may need to resolve supported statement access; no security challenge is bypassed.':'A Wise account statement could not be read; missing transactions are not zero spending.');}}
 result.retrievedAt=successfulReads?new Date(clock()).toISOString():null;return result;
}
