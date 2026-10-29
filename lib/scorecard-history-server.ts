import type {SupabaseClient} from '@supabase/supabase-js';
import type {PlanSnapshot} from './forecast-actual';
import {datedScorecard,type DatedActual,type CoverageHistory,SCORECARD_ZONE,shiftedDay} from './scorecard-history';
export async function readHostedScorecardHistory(db:SupabaseClient,day:string,cutoff:string,pinnedPlanId?:string){
 const [plans,records,runs]=await Promise.all([
 db.from('finance_plan_snapshots').select('*',{count:'exact'}).lte('from_day',day).gte('through_day',day).lte('created_at',cutoff).order('created_at',{ascending:true}).limit(501),
 db.from('finance_actual_records').select('id,day,category,amount,currency,provider,description,source_ref,basis,recorded_at',{count:'exact'}).gte('day',shiftedDay(day,-1)).lte('day',shiftedDay(day,1)).lte('recorded_at',cutoff).order('id').limit(1001),
 db.from('finance_actual_runs').select('*',{count:'exact'}).lte('from_day',shiftedDay(day,1)).gte('through_day',shiftedDay(day,-1)).lte('observed_at',cutoff).order('observed_at',{ascending:false}).limit(1001)
 ]);
 if(plans.error||records.error||runs.error)throw Error('Hosted history unavailable');
 if((plans.count??Infinity)>500||(records.count??Infinity)>1000||(runs.count??Infinity)>1000||plans.count!==plans.data?.length||records.count!==records.data?.length||runs.count!==runs.data?.length)throw Error('Hosted history is truncated; no complete comparison asserted');
 return datedScorecard({day,zone:SCORECARD_ZONE,cutoff,plans:plans.data as PlanSnapshot[],records:records.data as DatedActual[],runs:runs.data as CoverageHistory[],pinnedPlanId});
}
