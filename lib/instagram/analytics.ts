import {INSTAGRAM_INSIGHTS_SCOPE} from './core';
export type PostMetrics={likes:number|null;comments:number|null;reach:number|null;saves:number|null;shares:number|null;views:number|null};
export type PostAnalytics={metrics:PostMetrics;source:'Instagram';checkedAt:string;insights:'permission_required'|'available'|'partly_available'|'unavailable'};
const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
export function insightCount(value:unknown,metric:string){if(!value||typeof value!=='object')return null;const data=(value as {data?:unknown}).data;if(!Array.isArray(data))return null;const item=data.find(x=>x&&typeof x==='object'&&x.name===metric);if(!item)return null;if(item.total_value&&typeof item.total_value==='object')return count(item.total_value.value);return Array.isArray(item.values)&&item.values.length===1?count(item.values[0]?.value):null;}
export async function readPostAnalytics(mediaId:string,scopes:string[],ports:{basic:()=>Promise<Record<string,unknown>>;insight:(metric:string)=>Promise<unknown>},clock=()=>new Date()):Promise<PostAnalytics>{
 if(!/^[1-9]\d{0,39}$/.test(mediaId))throw Error('Confirmed published Instagram media required.');
 const basic=await ports.basic(),metrics:PostMetrics={likes:count(basic.like_count),comments:count(basic.comments_count),reach:null,saves:null,shares:null,views:null};
 let insights:PostAnalytics['insights']='permission_required';
 if(scopes.includes(INSTAGRAM_INSIGHTS_SCOPE)){const keys=['reach','saved','shares','views'] as const;const results=await Promise.allSettled(keys.map(k=>ports.insight(k)));let found=0;for(let i=0;i<keys.length;i++){const key=keys[i],r=results[i],value=r.status==='fulfilled'?insightCount(r.value,key):null;metrics[key==='saved'?'saves':key]=value;if(value!==null)found++;}insights=found===4?'available':found?'partly_available':'unavailable';}
 return {metrics,source:'Instagram',checkedAt:clock().toISOString(),insights};
}
