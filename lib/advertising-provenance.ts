import {roundCash} from './forecast-money';
export type AdvertisingEvidence={kind:'owner-reported'|'provider-verified'|'receipt';date:string;amountCad:number;source:string;sourceAt:string;completeDay?:boolean;geo?:'canada'|'usa'};
export type AdvertisingContext={snapshotAt:string;evidence:AdvertisingEvidence[];ownerReports:{valueCad:number;periodEnds:string;reportedAt:string|null;basis:string}[]};
export function advertisingContext(b:{read_at:string;advertisingEvidence?:AdvertisingEvidence[];sourceHandoff?:{ownerReports?:AdvertisingContext['ownerReports']}}):AdvertisingContext{return {snapshotAt:b.read_at,evidence:b.advertisingEvidence||[],ownerReports:b.sourceHandoff?.ownerReports||[]};}
export function dailyAdvertising(context:AdvertisingContext,points:readonly {date:string;adSpend:number;geo?:Record<'canada'|'usa',{ads:number}>}[],index:number){
 const p=points[index],prior=points[index-1];const rows=context.evidence.filter(e=>e.date===p.date&&Number.isFinite(e.amountCad)&&e.amountCad>=0&&Number.isFinite(Date.parse(e.sourceAt))),daily=rows.filter(e=>e.kind!=='receipt'&&e.completeDay===true),whole=daily.filter(e=>!e.geo),provider=whole.filter(e=>e.kind==='provider-verified'),owner=whole.filter(e=>e.kind==='owner-reported');
 // A complete whole-account day can establish a total. Partial geographies, bills
 // and period-ending owner reports cannot establish a complete daily total.
 const chosen=provider.length===1?provider[0]:provider.length===0&&owner.length===1?owner[0]:null;
 return {date:p.date,forecast:roundCash(p.adSpend-(prior?.adSpend||0)),canada:roundCash(p.geo?p.geo.canada.ads-(prior?.geo?.canada.ads||0):p.adSpend-(prior?.adSpend||0)),usa:roundCash(p.geo?p.geo.usa.ads-(prior?.geo?.usa.ads||0):0),actual:chosen?.amountCad??null,status:chosen?.kind||'unknown' as const,source:chosen?.source||null,sourceAt:chosen?.sourceAt||null,billing:rows.filter(e=>e.kind==='receipt'),forecastSourceAt:context.snapshotAt};
}
