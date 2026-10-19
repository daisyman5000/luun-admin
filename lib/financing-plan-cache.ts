import {createHash} from 'node:crypto';
import type {Baseline} from './financing-baseline';
import {operatingTimeline,type OperatingChoice} from './operating-timeline';
type Entry={expires:number;plan:ReturnType<typeof operatingTimeline>};
const entries=new Map<string,Entry>();
/** Bounded, user-scoped cache. Every financial input and option participates in the key. */
export function cachedFinancingPlan(baseline:Baseline,choice:OperatingChoice,scope:string){
 const key=createHash('sha256').update(JSON.stringify({scope,baseline:{...baseline,read_at:baseline.read_at.slice(0,10)},choice})).digest('hex'),now=Date.now(),hit=entries.get(key);
 if(hit&&hit.expires>now){entries.delete(key);entries.set(key,hit);return hit.plan;}
 const plan=operatingTimeline(baseline,choice);entries.delete(key);entries.set(key,{expires:now+60000,plan});
 while(entries.size>4)entries.delete(entries.keys().next().value!);
 return plan;
}
