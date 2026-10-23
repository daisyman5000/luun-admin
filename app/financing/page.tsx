import {loadFinancingBaseline} from '@/lib/financing-live-baseline';
import {headers} from 'next/headers';
import {readFile} from 'node:fs/promises';
import {cachedFinancingPlan} from '@/lib/financing-plan-cache';
import {financingDefaults} from '@/lib/financing-defaults';
import {applyForecastSettings} from '@/lib/forecast-settings';
import {FinancingChart} from '@/components/financing-chart';
import {localContentEnabled} from '@/lib/local-content';
import {requireUser,canViewFinancials} from '@/lib/auth';
import {emptyBaseline,type Baseline} from '@/lib/financing-baseline';
export const dynamic='force-dynamic';
export default async function FinancingPage(){
 let baseline:Baseline=emptyBaseline(),error='',scope='local';
 if(localContentEnabled((await headers()).get('host'))){try{baseline=JSON.parse(await readFile(process.cwd()+'/../evidence/financing-actual-baseline.json','utf8'));}catch{error='Local stock snapshot unavailable.';}}
 else{const {user,profile,supabase}=await requireUser();scope='user:'+user.id;if(!canViewFinancials(profile?.role))return <p className="p-8">Owner/admin access required.</p>;
 const loaded=await loadFinancingBaseline(supabase);baseline=loaded.baseline;error=loaded.error;}
 if(scope==='local')try{const response=await fetch('https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1',{next:{revalidate:3600},signal:AbortSignal.timeout(3000)});if(response.ok){const row=(await response.json()).observations?.at(-1),rate=Number(row?.FXUSDCAD?.v);if(rate>0)baseline.fx={rate,date:row.d,source:'Bank of Canada FXUSDCAD'};}}catch{}
 const choice=scope==='local'?applyForecastSettings(financingDefaults(baseline),JSON.parse(await readFile(process.cwd()+'/mcp/forecast-settings.json','utf8'))):financingDefaults(baseline),plan=cachedFinancingPlan(baseline,choice,scope);
 return <div className="p-4"><FinancingChart baseline={baseline} sourceError={error} initialPlan={plan} initialChoiceKey={JSON.stringify(choice)} initialChoice={choice}/></div>;
}
