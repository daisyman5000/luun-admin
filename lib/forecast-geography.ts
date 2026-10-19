export type ForecastGeo='canada'|'usa';
export type GeoAdLimits={canadaCad:number;usa:number;usaCurrency:'CAD'|'USD'};
export function geoAdCaps(limits:GeoAdLimits,usdCad:number){
 if(!Number.isFinite(limits.canadaCad)||limits.canadaCad<0||!Number.isFinite(limits.usa)||limits.usa<0||(limits.usaCurrency==='USD'&&(!Number.isFinite(usdCad)||usdCad<=0)))throw Error('Invalid geographic ad limits or FX');
 return {canada:limits.canadaCad,usa:limits.usa*(limits.usaCurrency==='USD'?usdCad:1)};
}
