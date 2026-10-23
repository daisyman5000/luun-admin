import 'server-only';
import {createHash} from 'node:crypto';
import {createAdminClient} from '@/lib/supabase/admin';
import {analyzeFunnel,improvementDraft,paidOrder,type FunnelEvent,type FunnelPurchase} from '@/lib/funnel';
export async function recordFunnelPurchase(payload:Record<string,unknown>){const p=paidOrder(payload);if(!p)return;const r=await createAdminClient().from('funnel_purchases').upsert(p,{onConflict:'id',ignoreDuplicates:true});if(r.error)throw Error('Paid order funnel record failed');}
export async function funnelReport(from:string,through:string){const db=createAdminClient();const events:FunnelEvent[]=[];const purchases:FunnelPurchase[]=[];
 // UTC bounds include complete Vancouver days; narrow exactly by cohort day in memory.
 const since=new Date(Date.parse(from+'T00:00:00Z')-86400000).toISOString(),until=new Date(Date.parse(through+'T00:00:00Z')+2*86400000).toISOString();
 for(const [table,target] of [['funnel_events',events],['funnel_purchases',purchases]] as const){for(let offset=0;offset<=10000;offset+=1000){const r=await db.from(table).select('*').gte('occurred_at',since).lt('occurred_at',until).order('id').range(offset,offset+999);if(r.error)throw Error('Funnel tracking unavailable');if(offset===10000&&r.data?.length)throw Error('Choose a shorter period; tracking exceeds 10,000 records');(target as unknown[]).push(...r.data||[]);if((r.data?.length||0)<1000)break;}}
 const day=(at:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));const ids=new Set(events.filter(e=>e.stage==='landing'&&day(e.occurred_at)>=from&&day(e.occurred_at)<=through).map(e=>e.session_id));
 const selected=events.filter(e=>ids.has(e.session_id));const analysis=analyzeFunnel(selected,purchases);return {analysis,draft:improvementDraft(analysis),from,through,checkedAt:new Date().toISOString(),firstEvent:events.filter(e=>!e.test).sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at))[0]?.occurred_at||null};
}
export async function saveFunnelReview(from:string,through:string,actor:string){const report=await funnelReport(from,through);const fingerprint=createHash('sha256').update(JSON.stringify({from,through,analysis:report.analysis,draft:report.draft})).digest('hex');const r=await createAdminClient().from('funnel_reviews').upsert({id:fingerprint,created_by:actor,from_day:from,through_day:through,package:report},{onConflict:'id',ignoreDuplicates:true});if(r.error)throw Error('Review was not saved');return report;}
