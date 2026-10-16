import {buildDecisionPosition,commitmentStillAffectsSnapshot} from './decision-position';
import { forecastDemand,type ForecastInput } from './demand-forecast';
import { calculatePlan,type PlanInput } from './demand-plan';
import { readBusinessGoal,readDailyAdBudget,type BusinessGoal } from './business-goal';
export type CashCommitment={id:string;title:string;amount:number|null;currency:string|null;dueDate:string|null;source:'invoice'|'financing'|'container';settlement?:'unverified'|'verified_unpaid'|'confirmed_paid';settledAt?:string|null;evidenceDate?:string|null;evidenceRef?:string|null;recordStatus?:string|null;updatedAt?:string|null};
export type StrategyInput={recentSales?:{average:number|null;count:number;complete:boolean};containerRecords?:{id:string;status:string|null;eta:string|null;modules:number;updatedAt:string|null}[];acquisition?:import('./acquisition').AcquisitionResult|null;statementStatus?:string;statementRetrievedAt?:string|null;cashWarnings?:string[];cashComplete?:boolean;cashRetrievedAt?:string|null;cashStatus?:string;saleStatusAvailable?:boolean;inventoryAvailable?:boolean;ordersAvailable?:boolean;arrivalsAvailable?:boolean;now:number;objective:string;targetDate:string;goal:BusinessGoal|null;dailyAdBudget:number|null;planUpdatedAt:string|null;planCommitments:{id:string;title:string;dueDate:string;status:string;evidence:string}[];balances:{currency:string;amount:number}[]|null;commitments:CashCommitment[];commitmentsComplete:boolean;inventory:{key:string;available:number;updatedAt:string|null}[];incoming:{id:string;eta:string|null;modules:number}[];paidOrders:number;forecast:ForecastInput;planning:PlanInput};
export type StrategyAction={id:string;title:string;reason:string;dueDate:string|null;kind:'review'|'prepare'|'decide'};
const DAY=86400000;
export function buildOperatingStrategy(input:StrategyInput){
 const warnings:string[]=[...(input.cashWarnings||[]),'Spend and container decisions still need reconciled obligations including tax/debt, SKU landed and delivery costs, confirmed arrivals and operating capacity; these decision-changing inputs are not complete in this model.'],actions:StrategyAction[]=[];const goal=readBusinessGoal(input.goal),adBudget=readDailyAdBudget(input.dailyAdBudget);
 const end=input.targetDate?Date.parse(input.targetDate+'T23:59:59Z'):NaN;const horizon=Number.isFinite(end)&&end>=input.now?Math.ceil((end-input.now)/DAY):null;
 if(input.inventoryAvailable===false)warnings.push('Inventory could not be read; no stock quantity is assumed.');
 if(input.ordersAvailable===false)warnings.push('Paid orders could not be read; no sales pace is assumed.');
 if(input.arrivalsAvailable===false)warnings.push('Arrivals could not be read; replenishment assumptions are unavailable.');
 if(input.saleStatusAvailable===false)warnings.push('Current sale status is unavailable; no revenue scenario is presented.');
 if(input.planning.blocked)warnings.push('The paid-order sample is incomplete or has unmapped fabrics; scenarios are withheld.');
 if(!input.forecast.acquisitionCost)warnings.push('Measured acquisition cost is unavailable. Order scenarios follow historical pace; changing the ad plan does not establish a different sales outcome.');
 if(!input.objective)warnings.push('Save the business objective before choosing a strategy.');
 if(!goal)warnings.push('Choose a measurable outcome; no numeric business goal has been assumed.');
 if(!horizon)warnings.push('A future target date is needed to compare the situation with the goal.');
 if(horizon&&horizon>365)warnings.push('The target is beyond the one-year operational model; no long-range forecast is produced.');
 if(!input.balances)warnings.push('No usable cash balances were returned to this runtime. Cash coverage and affordability cannot be established.');
 if(!input.commitmentsComplete)warnings.push('Some commitment sources are unavailable; known bills are not a complete cashflow picture.');
 const unknown=input.commitments.filter(c=>c.amount===null||!Number.isFinite(c.amount)||!c.currency||!c.dueDate);
 if(unknown.length)warnings.push(`${unknown.length} commitments have missing amount, currency or due date; reconcile them before relying on cash coverage.`);
 const overdue=input.commitments.filter(c=>c.dueDate&&Date.parse(c.dueDate+'T23:59:59Z')<input.now);
 if(overdue.length){warnings.push(`${overdue.length} recorded commitments are past due but not marked settled. This does not prove non-payment.`);actions.push({id:'reconcile',title:'Reconcile the dated commitments',reason:'Confirm which past-due records are paid or still owed before treating their amounts as current obligations.',dueDate:overdue.map(x=>x.dueDate!).sort()[0],kind:'review'});}
 const staleStock=input.inventory.some(row=>!row.updatedAt||input.now-Date.parse(row.updatedAt)>7*DAY||!Number.isFinite(Date.parse(row.updatedAt)));
 if(staleStock)warnings.push('Some stock records are undated or older than seven days; verify availability before promoting a configuration.');
 const uncertainArrivals=input.incoming.filter(x=>!x.eta||!Number.isFinite(Date.parse(x.eta))||Date.parse(x.eta+'T23:59:59Z')<input.now);
 if(uncertainArrivals.length)warnings.push(`${uncertainArrivals.length} arrivals have unknown or overdue ETAs; they are not treated as dependable replenishment.`);
 if(adBudget===null)warnings.push('No daily ad plan is saved. Bank Meta payments are not being treated as a confirmed campaign budget.');
 if(input.planUpdatedAt&&input.now-Date.parse(input.planUpdatedAt)>14*DAY)warnings.push('The shared business plan is over fourteen days old; review its goal and promises.');
 const onHand=input.inventoryAvailable===false?null:input.inventory.reduce((sum,x)=>sum+Math.max(0,x.available),0);const depleted=input.inventory.filter(x=>x.available<=0).map(x=>x.key);
 const due=input.commitments.filter(c=>commitmentStillAffectsSnapshot(c,input.cashRetrievedAt)).filter(c=>c.dueDate&&Date.parse(c.dueDate+'T23:59:59Z')<=(horizon?end:input.now+30*DAY));
 const commitmentsByCurrency:Record<string,number>={};for(const item of due)if(item.currency&&item.amount!==null&&Number.isFinite(item.amount))commitmentsByCurrency[item.currency]=(commitmentsByCurrency[item.currency]||0)+Math.max(0,item.amount);
 const cashByCurrency:Record<string,number>={};for(const balance of input.balances||[])if(Number.isFinite(balance.amount))cashByCurrency[balance.currency]=(cashByCurrency[balance.currency]||0)+balance.amount;
 let comparison:{label:string;current:number|null;target:number;gap:number|null;currency:string|null;provisional:boolean}|null=null;
 const validHorizon=horizon!==null&&horizon<=365;
 const forecast=validHorizon&&input.inventoryAvailable!==false&&input.ordersAvailable!==false&&input.arrivalsAvailable!==false&&input.saleStatusAvailable!==false&&!input.planning.blocked&&adBudget!==null?forecastDemand({...input.forecast,days:horizon!,dailyBudget:adBudget??input.forecast.dailyBudget}):null;
 const promotion=calculatePlan(input.planning);
 if(goal&&validHorizon){
  if(goal.metric==='cash_reserve'){
   const cash=input.balances&&Object.prototype.hasOwnProperty.call(cashByCurrency,goal.currency)?cashByCurrency[goal.currency]:null;
   const plannedAds=goal.currency==='CAD'&&adBudget!==null?adBudget*horizon!:0;
   const current=cash===null?null:cash-(commitmentsByCurrency[goal.currency]||0)-plannedAds;
   const provisional=input.cashComplete===false||!input.commitmentsComplete||unknown.length>0||overdue.length>0||adBudget===null||(goal.currency!=='CAD'&&(adBudget||0)>0);
   comparison={label:'Cash remaining after recorded commitments and this ad plan',current,target:goal.amount,gap:current===null?null:goal.amount-current,currency:goal.currency,provisional};
   if(goal.currency!=='CAD'&&(adBudget||0)>0)warnings.push('CAD advertising is not deducted from a USD reserve. No exchange rate or currency transfer is assumed.');
   if(current!==null&&current<goal.amount)actions.push({id:'cash-gap',title:provisional?'Review cash coverage inputs before changing spend':'Reconcile the recorded funding gap before increasing spend',reason:`${provisional?'Provisional recorded inputs':'Recorded outflows'} leave less than the saved ${goal.currency} reserve target. Consider reducing the draft ad plan or reviewing payment timing; neither change is executed here.`,dueDate:input.targetDate,kind:'decide'});
  }else{
   const current=forecast?.ready?forecast.orders:null;
   comparison={label:'Modelled new paid orders by the target date',current,target:goal.amount,gap:current===null?null:goal.amount-current,currency:null,provisional:true};
   if(current===null)warnings.push(adBudget===null?'Confirm the daily ad plan before comparing an order scenario to the goal.':'Paid-order history, stock, arrivals or sale status are insufficient for an order scenario.');
  }
 }
 if(depleted.length||staleStock)actions.push({id:'stock',title:'Choose configurations that can actually be fulfilled',reason:depleted.length?`${depleted.length} fabric/module combinations have no unreserved stock. Avoid promising unavailable combinations; aggregate modules do not prove a complete sofa is available.`:'Verify the ageing stock snapshot before using it in content.',dueDate:null,kind:'review'});
 if(promotion.orderDate)actions.push({id:'container',title:'Review the next container decision',reason:'The existing SKU demand model places the replenishment decision at this date; it is not a purchase order.',dueDate:promotion.orderDate.slice(0,10),kind:'decide'});
 for(const commitment of input.planCommitments.filter(x=>x.status!=='done'))actions.push({id:'plan-'+commitment.id,title:commitment.title,reason:'Saved business-plan commitment.',dueDate:commitment.dueDate,kind:'prepare'});
 if(!input.objective||!goal||!horizon)actions.push({id:'goal',title:'Confirm one outcome and its target date',reason:'The shared plan needs the result this business should work toward, not just a list of incoming problems.',dueDate:null,kind:'decide'});
 const decisionView=buildDecisionPosition(input);if(decisionView.reconciliationRequired&&comparison){comparison={...comparison,current:null,gap:null,provisional:true};warnings.push('Reserve comparison is withheld until recorded open/scheduled obligations are reconciled as paid or verified unpaid.');}
 return {simulationSources:{inventory:input.inventory,recentSales:input.recentSales,balances:input.balances,commitments:input.commitments,commitmentsReadComplete:input.commitmentsComplete,cashComplete:input.cashComplete!==false,cashRetrievedAt:input.cashRetrievedAt||null},acquisition:input.acquisition||null,decisionView,asOf:new Date(input.now).toISOString(),cashRetrievedAt:input.cashRetrievedAt||null,cashStatus:input.cashStatus||'unknown',statementStatus:input.statementStatus||'unknown',statementRetrievedAt:input.statementRetrievedAt||null,objective:input.objective,targetDate:input.targetDate,onHand,depleted,cashByCurrency:input.balances?cashByCurrency:null,commitmentsByCurrency,comparison,forecast:forecast?.ready?{orders:forecast.orders,revenue:forecast.revenue,adSpend:forecast.adSpend,constrained:forecast.constrained}:null,adDailyBudget:adBudget,planning:{budget:promotion.budget,orderDate:promotion.orderDate,reason:promotion.reason},actions:actions.sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')),warnings,tradeoffs:['Protecting cash can slow the pace of paid acquisition.','Promoting only complete, available configurations limits choice but avoids unfulfillable promises.','Delaying a container commitment preserves cash now but can move replenishment behind demand.'],assumptions:['Deterministic calculations, not an AI-generated recommendation or a guarantee.','Cash comparison uses all owner-designated available Wise balances by currency, while legal accounts remain separate. Known obligations and planned ads are deducted separately; no transfer or exchange is assumed.', 'Cash comparison excludes future sales receipts, tax, unrecorded costs and currency conversion. It is not a profit forecast.', 'Successful reads do not prove that recorded bills, debt, inventory, arrivals or Shopify imports are complete and reconciled.','Recorded overdue bills require reconciliation; they are not automatically treated as unpaid facts.','Order scenarios reuse the existing demand model and its historical assumptions; bank payments do not establish causal ad performance.','No budget, sale, invoice, order or customer promise is changed.']};
}
