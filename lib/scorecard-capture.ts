import {businessDate,shiftedDay,LEGACY_ZONE} from './scorecard-history';
import type {SourceJobReport} from './source-sync';
type Capture=(from:string,through:string)=>Promise<{records:number;warnings:string[]}>;
/** Reuse existing bounded, read-only provider ingestion; only existing finance evidence/checkpoints are saved. */
export async function captureExistingActuals(reports:SourceJobReport[],collect:Capture,expenses:Capture,now:number){if(!['wise_balances','shopify_orders'].every(source=>reports.some(r=>r.source===source&&r.status==='ok')))return reports;const day=shiftedDay(businessDate(now,LEGACY_ZONE),-1),results=await Promise.allSettled([collect(day,day),expenses(day,day)]);return [...reports,...results.map((r,i):SourceJobReport=>({source:i?'reviewed_expense_observations':'shopify_collection_observations',status:r.status==='fulfilled'?'partial':'error',...(r.status==='fulfilled'?{records:r.value.records}:{phase:'read'})}))];}
