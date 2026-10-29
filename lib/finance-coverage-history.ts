import {createHash} from 'node:crypto';
import type {ActualRun} from './forecast-actual';
import {ACTUAL_TIME_ZONE} from './forecast-actual';
function canonical(value:unknown):unknown{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value;}
export function immutableCoverageRun(run:ActualRun){if(run.id.startsWith('history:'))throw Error('Cannot archive an archive');const identity={...run,package:{...run.package,history:{version:1,legacyRunId:run.id,timeZone:ACTUAL_TIME_ZONE}}};return {...identity,id:'history:v1:'+createHash('sha256').update(JSON.stringify(canonical(identity))).digest('hex')};}
type HistoryDatabase={from:(table:string)=>{upsert:(rows:ActualRun,options:{onConflict:string;ignoreDuplicates:boolean})=>PromiseLike<{error:unknown}>}};
/** Existing mutable heads remain intact for legacy consumers; archive rows are insert-once. */
export async function appendCoverageHistory(db:HistoryDatabase,run:ActualRun){const row=immutableCoverageRun(run);if(Buffer.byteLength(JSON.stringify(row.package))>100000)throw Error('Coverage history exceeds storage bound');const r=await db.from('finance_actual_runs').upsert(row,{onConflict:'id',ignoreDuplicates:true});if(r.error)throw Error('Coverage head saved but immutable history is unavailable; no second write was attempted');return row.id;}
