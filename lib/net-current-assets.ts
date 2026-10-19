import {cashSnapshot,incomingReadiness,type Baseline} from './financing-baseline';
import type {CashEvent} from './operating-timeline';
import type {ContainerCampaign,ScenarioSale} from './sale-clearance';
type CapitalPlan={ownerCosts?:{delgateCad:number}|null;start:string;fx:number;events:CashEvent[];points:{date:string;cash:number;adSpend:number}[];forecast:{cycles:ContainerCampaign[];salesLedger?:ScenarioSale[]};plannedOrders:{container:Baseline['containers'][number];orderDate:string;landing:string}[]};
export function netAssetSnapshot(b:Baseline,floor:number){
 const input=b.netAssetsInputs,fx=b.fx?.rate||0,cash=cashSnapshot(b,true),modules=b.inventory.filter(r=>['corner','armless','ottoman'].includes(r.module_slug||'')).reduce((n,r)=>n+Math.max(0,Number(r.available_qty)||0),0)+incomingReadiness(b,0).reduce((n,a)=>n+(a.container.manifest_json||[]).filter(m=>['corner','armless','ottoman'].includes(m.module)).reduce((v,m)=>v+m.quantity,0),0);
 const usd=input?.inventoryUsdPer144||0,inventoryAtCost=usd&&fx?modules/144*usd*fx:null;
 const supplier=incomingReadiness(b,0).reduce((n,a)=>n+Number(a.container.amount_to_be_paid||0)*(a.container.amount_currency==='USD'?fx:a.container.amount_currency==='CAD'?1:0),0);
 const debt=b.debt.filter(d=>d.due_date&&d.due_date>=b.read_at.slice(0,10)).reduce((n,d)=>n+Number(d.amount)*(d.currency==='USD'?fx:d.currency==='CAD'?1:0),0);
 const bills=b.expenses.filter(e=>!/freight|shipping|delgate/i.test(e.label)).reduce((n,e)=>n+Number(e.amount)*(e.currency==='USD'?fx:e.currency==='CAD'?1:0),0);
 const deposits=input?.customerDepositsCad??null,receivables=input?.receivablesCad??null,currentLiabilities=supplier+debt+bills+(deposits||0),currentAssets=cash===null||inventoryAtCost===null||receivables===null?null:cash+inventoryAtCost+receivables;
 const missing=!input?['PO inventory cost assumption','Opening receivables','Customer deposits / historical fulfillment status']:cash===null||!fx?['Cash balance or CAD conversion']:[];
 const value=currentAssets===null||missing.length?null:currentAssets-currentLiabilities;
 return {metric:'net-current-assets' as const,floor,value,status:value===null?'unverified' as const:'estimated' as const,missing,cash,modules,inventoryAtCost,receivables,supplier,debt,bills,customerDeposits:deposits,currentAssets,currentLiabilities,unitCostUsd:usd/144,assumptions:['PO-cost estimate; historical landed-cost adjustments are not verified.','Opening receivables are zero, per owner.','Owner confirms May–September paid orders were delivered; stale fulfillment flags excluded.','Current 20% preorder deposits are liabilities, not earned sales.','Assumes recorded inbound containers are owned current inventory; historical landed-cost adjustments remain unverified.','Other unrecorded liabilities and future profit taxes remain unverified.']};
}
export function netAssetForecast(b:Baseline,plan:CapitalPlan,floor:number){
 const snapshot=netAssetSnapshot(b,floor),daily=new Map<string,number>(),usd=b.netAssetsInputs?.inventoryUsdPer144||0;
 const add=(date:string,amount:number)=>daily.set(date,(daily.get(date)||0)+amount);
 for(const c of plan.forecast.cycles){
  const container=plan.plannedOrders.find(p=>p.container.id===c.id)?.container||b.containers.find(p=>p.id===c.id);
  const grossUnits=c.id==='on-hand'?b.inventory.filter(r=>['corner','armless','ottoman'].includes(r.module_slug||'')).reduce((n,r)=>n+Number(r.available_qty||0),0):(container?.manifest_json||[]).filter(m=>['corner','armless','ottoman'].includes(m.module)).reduce((n,m)=>n+m.quantity,0);
  const reserved=b.reservations.flatMap(r=>r.allocations).filter(a=>a.source===(c.id==='on-hand'?'stock':c.id)).reduce((n,a)=>n+a.quantity,0),freeUnits=Math.max(0,grossUnits-reserved);
  const cost=freeUnits/144*(usd+(c.id==='on-hand'?0:4500))*plan.fx;
  // Presales are earned only at readiness; full orders at the later of order/ready.
  // A preorder's deposit and its 80% balance describe ONE sale, not two.
  const sold=plan.forecast.salesLedger?.filter(s=>s.containerId===c.id);
  if(sold?.length){for(const sale of sold)add(sale.fulfilmentDate,sale.value-sale.modules/144*(usd+(c.id==='on-hand'?0:4500))*plan.fx);}
  else for(const receipt of c.receipts){if(receipt.kind==='balance')continue;const sale=receipt.kind==='deposit'?receipt.amount/.2:receipt.amount,order=receipt.orderDate||new Date(Date.parse(receipt.date+'T12:00:00Z')-2*86400000).toISOString().slice(0,10),earned=order<c.arrival?c.arrival:order;add(earned,sale-(c.sales?cost*sale/c.sales:0));}
  // DelGate is accrued at readiness; paying the accrued bill later has no second NCA impact.
  if(c.id!=='on-hand')add(c.arrival,-(plan.ownerCosts?.delgateCad??16000));
 }
 for(const event of plan.events)if(event.id==='hypothetical-loan-fee')add(event.date,event.amount);
 for(const event of plan.events)if(event.id.startsWith('onhand-delgate:')&&event.serviceDate)add(event.serviceDate,event.amount);
 for(const order of b.netAssetsInputs?.openPreorders||[]){const sources=order.allocations.filter(a=>a.source!=='stock').map(a=>incomingReadiness(b,0).find(r=>r.container.id===a.source)?.ready).filter((s):s is string=>!!s),ready=[plan.start,...sources].sort().at(-1)!,cost=order.allocations.reduce((n,a)=>n+a.quantity/144*(usd+(a.source==='stock'?0:4500))*plan.fx,0);add(ready,order.netSaleCad-cost);}
 let earned=0;const points=plan.points.map(p=>{earned+=daily.get(p.date)||0;return {date:p.date,value:snapshot.value===null?null:snapshot.value+earned-p.adSpend,cash:p.cash};});
 return {snapshot,points,minimum:snapshot.value===null?null:Math.min(...points.map(p=>p.value!)),basis:'Estimated accrual NCA: PO inventory cost, revenue/COGS at readiness, ads as spent and DelGate accrued at readiness. Existing principal/bill payments settle opening liabilities; they are not expensed twice.'};
}
