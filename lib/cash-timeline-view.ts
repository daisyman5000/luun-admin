import {roundCash} from './forecast-money';
import type {ForecastGeo} from './forecast-geography';
import type {operatingTimeline, CashEvent} from './operating-timeline';
type Plan=ReturnType<typeof operatingTimeline>;
export type PaymentGroup={date:string;kind:'order'|'landing'|'dock'|'debt'|'stockDelivery';label:string;quantity:number;amount:number;events:CashEvent[]};
export function majorPaymentGroups(events:CashEvent[]):PaymentGroup[]{
 const groups=new Map<string,PaymentGroup>();
 for(const event of events){
  if(event.amount>=0)continue;
  const kind=event.kind==='order'?'order':event.kind==='supplier'||event.kind==='shipping'?'landing':event.kind==='dock'?(event.id.startsWith('onhand-delgate:')?'stockDelivery':'dock'):event.kind==='debt'?'debt':null;
  if(!kind)continue;
  const key=event.date+kind;
  const group=groups.get(key)||{date:event.date,kind,label:kind==='order'?'30% deposits':kind==='landing'?'Supplier balance + ocean freight':kind==='stockDelivery'?'Current stock · DelGate':kind==='dock'?'DelGate':/wayflyer/i.test(event.label)?'Wayflyer':'Debt repayment',quantity:0,amount:0,events:[]};
  group.amount-=event.amount;group.events.push(event);
  // Supplier and freight are two charges for the same physical containers.
  if(kind==='stockDelivery')group.quantity+=event.moduleQuantity||0;else if(kind!=='landing'||event.kind==='supplier')group.quantity++;
  groups.set(key,group);
 }
 return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind));
}
export type SaleBand={geo?:ForecastGeo;from:string;to:string;kind:'presale'|'sale';quantity:number;estimatedOrders:number;names:string[]};
export function saleBands(plan:Plan):SaleBand[]{
 const groups=new Map<string,SaleBand>();
 const add=(from:string,to:string,kind:SaleBand['kind'],name:string,estimatedOrders:number,geo?:ForecastGeo)=>{
  const key=kind+from+to+(geo||''),group=groups.get(key)||{geo,from,to,kind,quantity:0,estimatedOrders:0,names:[]};
  group.quantity++;group.estimatedOrders+=estimatedOrders;group.names.push(name);groups.set(key,group);
 };
 for(const cycle of plan.forecast.cycles){
  if(!cycle.firstOrder||!cycle.lastOrder)continue;
  const name=plan.plannedOrders.find(p=>p.container.id===cycle.id)?.container.container_number||plan.forecast.arrivals.find(a=>a.container.id===cycle.id)?.container.container_number||(cycle.id==='on-hand'?'On-hand inventory':cycle.id);
  const orders=cycle.budget/250,preFraction=cycle.sales?cycle.receipts.filter(r=>r.kind==='deposit').reduce((n,r)=>n+r.amount,0)/.2/cycle.sales:0,preOrders=Math.min(orders,Math.max(0,orders*preFraction)),inStockOrders=Math.max(0,orders-preOrders);
  if(plan.saleEvents.length>2||plan.forecast.salesLedger.length>0){for(const window of plan.saleEvents){const count=plan.forecast.salesLedger.length?plan.forecast.salesLedger.filter(s=>s.containerId===cycle.id&&s.orderDate>=window.ordersFrom&&s.orderDate<=window.ordersTo).reduce((n,s)=>n+s.value,0)/cycle.sales*orders:cycle.receipts.filter(r=>r.kind!=='balance'&&(r.orderDate||new Date(Date.parse(r.date+'T12:00:00Z')-2*86400000).toISOString().slice(0,10))>=window.ordersFrom&&(r.orderDate||new Date(Date.parse(r.date+'T12:00:00Z')-2*86400000).toISOString().slice(0,10))<=window.ordersTo).reduce((n,r)=>n+r.amount/(r.kind==='deposit'?.2:1),0)/cycle.sales*orders;if(count>.000001)add(window.saleFrom,window.to,'sale',name,count,cycle.geo);}}else add(cycle.firstOrder,cycle.lastOrder,'sale',name,preOrders+inStockOrders,cycle.geo);
 }
 return [...groups.values()].sort((a,b)=>a.from.localeCompare(b.from));
}

export function collectionsOnDate(plan:Plan,date:string){
 const rows=plan.forecast.cycles.map(c=>{
  const amount=c.receipts.filter(r=>r.date===date).reduce((n,r)=>n+r.amount,0);
  const name=plan.plannedOrders.find(o=>o.container.id===c.id)?.container.container_number||plan.forecast.arrivals.find(a=>a.container.id===c.id)?.container.container_number;
  const number=name?.match(/(\d+)$/)?.[1];
  return {id:c.id,label:c.id==='on-hand'?'Current stock':number?'Container '+Number(number)+(c.geo?' · '+(c.geo==='usa'?'USA':'Canada'):''):name||c.id,amount};
 }).filter(r=>r.amount>.000001);
 for(const e of plan.events.filter(e=>e.date===date&&e.kind==='collection'&&e.amount>0))rows.push({id:e.id,label:'Existing customer balance',amount:e.amount});
 return rows;
}

/** Calendar-month collections; retain forecast coverage and zero months. */
export function monthlyCollections(points:readonly {date:string;receipt:number}[]){
 const months:{month:string;from:string;to:string;firstIndex:number;lastIndex:number;total:number}[]=[];
 for(const [index,point] of points.entries()){
  const month=point.date.slice(0,7);let bucket=months.at(-1);
  if(!bucket||bucket.month!==month){bucket={month,from:point.date,to:point.date,firstIndex:index,lastIndex:index,total:0};months.push(bucket);}
  bucket.total=roundCash(bucket.total+point.receipt);bucket.to=point.date;bucket.lastIndex=index;
 }
 return months;
}

/** Dated bank movements only. Reservations are not cash payments. */
export function cashMovementOnDate(plan:Plan,date:string){
 const index=plan.points.findIndex(p=>p.date===date);if(index<0)return null;
 const point=plan.points[index],opening=index?plan.points[index-1].cash:plan.opening??0,ads=point.adSpend-(plan.points[index-1]?.adSpend||0),events=plan.events.filter(e=>e.date===date),financing=events.filter(e=>e.kind==='loan').reduce((n,e)=>n+e.amount,0),payments=-events.filter(e=>e.amount<0).reduce((n,e)=>n+e.amount,0);
 const cents=(amount:number)=>Math.sign(amount)*Math.round((Math.abs(amount)+Number.EPSILON)*100),displayRounding=(cents(point.cash)-cents(opening)-cents(point.receipt)-cents(financing)+cents(payments)+cents(ads))/100;
 return {date,opening,collections:point.receipt,financing,payments,ads,closing:point.cash,calculated:opening+point.receipt+financing-payments-ads,displayRounding};
}
