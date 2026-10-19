import type {Baseline} from './financing-baseline';
type Sale={containerId:string;modules:number;fulfilmentDate:string;collectionDate:string|null};
type Event={id:string;date:string;amount:number};
export type ExistingContainerPurchaseGate={threshold:number;allowedFrom:string|null;containers:{name:string;totalModules:number;requiredModules:number;collectedOn:string|null}[]};
/** Gate purchases on collected and fulfilled C7 AND C8 modules, never pooled targets. */
export function existingContainerPurchaseGate(b:Baseline,sales:readonly Sale[],events:readonly Event[],threshold:number):ExistingContainerPurchaseGate{
 const ratio=Math.min(1,Math.max(0,threshold));
 const containers=[7,8].map(number=>{
  const c=b.containers.find(c=>Number(c.container_number.match(/(\d+)$/)?.[1])===number),name='C'+number;
  if(!c)return {name,totalModules:0,requiredModules:0,collectedOn:null};
  const totalModules=(c.manifest_json||[]).filter(m=>['corner','armless','ottoman'].includes(m.module)).reduce((n,m)=>n+m.quantity,0),requiredModules=Math.ceil(totalModules*ratio-0.000001),daily=new Map<string,number>();
  for(const s of sales){if(s.containerId!==c.id||!s.collectionDate)continue;const date=s.collectionDate>s.fulfilmentDate?s.collectionDate:s.fulfilmentDate;daily.set(date,(daily.get(date)||0)+s.modules);}
  for(const order of b.netAssetsInputs?.openPreorders||[]){const quantity=order.allocations.filter(a=>a.source===c.id).reduce((n,a)=>n+a.quantity,0),collection=events.find(e=>e.id==='existing-preorder:'+order.id&&e.amount>0);if(quantity&&collection)daily.set(collection.date,(daily.get(collection.date)||0)+quantity);}
  let collected=0,collectedOn:string|null=null;
  for(const [date,quantity] of [...daily].sort(([a],[c])=>a.localeCompare(c))){collected+=quantity;if(totalModules>0&&collected>=requiredModules){collectedOn=date;break;}}
  return {name,totalModules,requiredModules,collectedOn};
 });
 return {threshold:ratio,allowedFrom:containers.every(c=>c.collectedOn)?containers.map(c=>c.collectedOn!).sort().at(-1)!:null,containers};
}
