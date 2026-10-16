import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {calculateAcquisition,validateAcquisitionPeriod,latestCoveredAdMonth,unknownAcquisitionCoverage,validAcquisitionMonth,type AcquisitionPeriod,type AcquisitionOrder} from './acquisition';
import {getWiseMonthlyAdPayments} from './wise/client';
export function defaultAcquisitionMonth(now=new Date()) {const year=now.getUTCFullYear();return `${now.getUTCMonth()>=7?year:year-1}-07`;}
export async function preferredAcquisitionMonth(db:SupabaseClient){const {data,error}=await db.from('acquisition_period_evidence').select('package').order('month',{ascending:false}).limit(24);return !error&&data?latestCoveredAdMonth(data.map(row=>row.package),defaultAcquisitionMonth()):defaultAcquisitionMonth();}
export async function loadAcquisition(db:SupabaseClient,month:string,readWise=false){
 if(!validAcquisitionMonth(month)||month>new Date().toISOString().slice(0,7))throw Error('Choose a valid completed or current month.');
 const oldest=new Date();oldest.setUTCMonth(oldest.getUTCMonth()-24);if(month<oldest.toISOString().slice(0,7))throw Error('Monthly read limited to the last 24 months.');
 const readAt=new Date().toISOString();let latestOrderUpdate:string|null=null;
 const start=new Date(month+'-01T00:00:00Z');start.setUTCDate(start.getUTCDate()-1);const end=new Date(month+'-01T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(end.getUTCDate()+1);
 const period:AcquisitionPeriod={month,currency:'CAD',timeZone:'America/Vancouver',evidence:[],coverage:unknownAcquisitionCoverage()};
 const {data:stored,error:evidenceError}=await db.from('acquisition_period_evidence').select('package').eq('month',month).eq('currency','CAD').maybeSingle<{package:AcquisitionPeriod}>();
 if(!evidenceError&&stored?.package){const value=validateAcquisitionPeriod(stored.package);if(value.month!==month||value.currency!=='CAD'||value.timeZone!=='America/Vancouver'||!Array.isArray(value.evidence)||!value.coverage)throw Error('Stored evidence needs reconciliation.');Object.assign(period,value);}
 else period.coverage.notes.push('No reconciled monthly evidence package is installed; no monthly total or zero spend is asserted.');
 let candidates:Awaited<ReturnType<typeof getWiseMonthlyAdPayments>>['candidates']=[],bankRetrievedAt:string|null=null;
 if(readWise){const bank=await getWiseMonthlyAdPayments(month);period.evidence=[...period.evidence.filter(e=>e.source!=='wise'),...bank.evidence];period.coverage.notes.push(...bank.warnings);if(!bank.complete)period.coverage.fundingSourcesComplete=false;candidates=bank.candidates;bankRetrievedAt=bank.retrievedAt;}
 // Page explicitly: PostgREST default row caps are not treated as a full month.
 const orders:AcquisitionOrder[]=[];let queriedAll=false;const warnings:string[]=[];
 for(let offset=0;offset<10000;offset+=500){const {data,error}=await db.from('shopify_orders').select('shopify_order_id,id,created_at,currency,payment_status,raw_shopify_json,updated_at').gte('created_at',start.toISOString()).lt('created_at',end.toISOString()).order('created_at').order('id').range(offset,offset+499);
  if(error){warnings.push('Stored Shopify orders could not be read.');break;}
  for(const row of data||[]){if(row.updated_at&&(!latestOrderUpdate||row.updated_at>latestOrderUpdate))latestOrderUpdate=row.updated_at;const raw=(row.raw_shopify_json||{}) as Record<string,unknown>;const customer=raw.customer as {id?:string}|undefined;
   orders.push({id:String(row.shopify_order_id||raw.id||row.id),createdAt:row.created_at,currency:row.currency||'',paymentStatus:row.payment_status||'',cancelled:!!raw.cancelledAt,test:raw.test===true,customerId:customer?.id||null,firstPaidOrderId:typeof raw.firstPaidOrderId==='string'?raw.firstPaidOrderId:null});}
  if((data||[]).length<500){queriedAll=true;break;}
 }
 if(!queriedAll){period.coverage.ordersComplete=false;warnings.push('Shopify query failed or reached its 10,000-row safety cap.');}
 period.coverage.notes.push(...warnings);
 // Reading imported rows is not proof the Shopify import itself covers the month.
 return {result:calculateAcquisition(period,orders),candidates,bankRetrievedAt,sources:{orders:{source:'Stored Shopify orders',readAt,latestRowUpdatedAt:latestOrderUpdate,syncFreshness:'Import completeness and upstream sync watermark are unverified unless separately reconciled.'},receipts:{source:'Reconciled financial receipts and explicit settlement links',checkedAt:period.coverage.evidenceCheckedAt},bank:{source:'Existing Wise statement integration',retrievedAt:bankRetrievedAt,scope:'Returned balance accounts only; TD Visa and PayPal internal balances are not covered by this API.'}},automaticExecution:false};
}

export async function storedAcquisitionContext(db:SupabaseClient){const {data,error}=await db.from('acquisition_period_evidence').select('package').order('month',{ascending:false}).limit(24);if(error||!data?.length)return null;const month=latestCoveredAdMonth(data.map(row=>row.package),defaultAcquisitionMonth());try{return (await loadAcquisition(db,month,false)).result;}catch{return null;}}
