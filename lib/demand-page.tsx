import { LiveCashSummary } from '@/components/live-cash-summary';
import {refreshWiseBalances} from '@/lib/wise/balance-service';
import { readWiseSummary,wiseOperationalData } from '@/lib/wise/summary';
import { strategyAIConfiguration } from '@/lib/strategy-ai';
import { StrategyAIAdvice } from '@/components/strategy-ai-advice';
import { OperatingStrategy } from '@/components/operating-strategy';
import { buildOperatingStrategy,type CashCommitment } from '@/lib/operating-strategy';
import { readOperatorContext } from '@/lib/content-database';
import { DemandDecisions } from '@/components/demand-decisions';
import { readPlanningSettings, type StockDemand } from '@/lib/demand-plan';
import { DemandWorkspace } from '@/components/demand-workspace';
import { canManageInventory, canViewFinancials, requireUser } from '@/lib/auth';
import { readSale } from '@/lib/sales/store';
import type { Counts } from '@/lib/sales/pricing';
import type { ContainerEntry, InventoryRow, ShopifyOrder, MajorExpense, WayflyerPayment } from '@/lib/types';

const empty = (): Counts => ({ corner: 0, armless: 0, ottoman: 0 });
const fabricKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
function moduleKey(value: string | null | undefined): keyof Counts | null {
  const text = (value || '').toLowerCase();
  return text.includes('corner') || text === 'cor' ? 'corner' : text.includes('armless') || text.includes('side') ? 'armless' : text.includes('ottoman') || text === 'ott' ? 'ottoman' : null;
}
type RawOrder = {
  cancelledAt?: string | null;
  lineItems?: { edges?: { node?: { discountedTotalSet?: { shopMoney?: { amount?: string; currencyCode?: string } }; originalTotalSet?: { shopMoney?: { amount?: string; currencyCode?: string } } } }[] };
};
function productRevenue(order: ShopifyOrder): number | null {
  const lines = (order.raw_shopify_json as RawOrder | null)?.lineItems?.edges;
  if (!lines?.length) return null;
  let total = 0;
  for (const line of lines) {
    const money = line.node?.discountedTotalSet?.shopMoney || line.node?.originalTotalSet?.shopMoney;
    if (money?.currencyCode !== 'CAD' || !Number.isFinite(Number(money.amount))) return null;
    total += Number(money.amount);
  }
  return total;
}
export async function renderDemandPage(planOnly: boolean) {
  const { profile, supabase } = await requireUser();
  if (!canViewFinancials(profile?.role)) return <main className="p-8"><h1 className="text-2xl font-semibold">Demand &amp; Sales</h1><p className="mt-3 text-sm text-slate-500">Owner/admin access is required to view revenue forecasting.</p></main>;
  const {now,orderResult,wise,saleResult,planningResult,contextNote,inventory,orders,modules,spend,recordedSpend,revenueValues,incoming,stockRows,planningIncoming,coreDataUnavailable,strategy}=await loadDemandData(supabase);
  if (planOnly) return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8"><h1 className="text-2xl font-semibold tracking-tight">Daily Plan</h1><p className="mb-6 mt-1 text-sm text-slate-500">Daily ads, sale dates and your next container.</p><DemandDecisions canEdit={canManageInventory(profile?.role)} initialError={planningResult.error ? 'Planning settings need the database migration before they can be saved.' : null} input={{ now, rows: [...stockRows.values()], incoming: planningIncoming, dailyOrders: orders.length ? orders.length / 30 : null, settings: readPlanningSettings(planningResult.data?.settings), blocked: (orderResult.data || []).length === 1000 || orders.some(order => !order.fabric_slug) }} /></main>;
  return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
    <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Demand &amp; Sales</h1>
    <p className="mt-1 mb-6 text-sm text-slate-500">Control your website sale. Check the numbers before deciding what comes next.</p>
    <LiveCashSummary initialSummary={wise}/>
    {contextNote ? <p className="mb-4 rounded-xl border border-line bg-white p-4 text-sm text-slate-600">Shared promotion focus: {contextNote} <span className="text-xs text-slate-400">· Confirm against current stock and offer before acting.</span></p> : null}
    <OperatingStrategy strategy={strategy}/><StrategyAIAdvice configuration={strategyAIConfiguration(process.env)}/>
    {coreDataUnavailable?<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Detailed demand modelling is paused because stock, orders or arrivals could not be read. The situation above shows only available records.</p>:<DemandWorkspace planning={{ now, rows: [...stockRows.values()], incoming: planningIncoming, dailyOrders: orders.length ? orders.length / 30 : null, settings: readPlanningSettings(planningResult.data?.settings), blocked: (orderResult.data || []).length === 1000 || orders.some(order => !order.fabric_slug) }} planningError={planningResult.error ? "Planning settings are not installed yet. Apply the planning migration to save settings." : null} canEdit={canManageInventory(profile?.role)} initialSale={saleResult.sale} saleError={saleResult.error} input={{ now, days: 30, inventory, incoming, modulesPerOrder: orders.length ? modules / orders.length : null, dailyOrders: orders.length ? orders.length / 30 : null, dailyBudget: spend / 30, acquisitionCost: recordedSpend!==null && spend > 0 && orders.length > 0 ? spend / orders.length : null, sale: saleResult.sale }} history={{ revenue: revenueValues.every(value => value !== null) ? revenueValues.reduce<number>((sum, value) => sum + (value || 0), 0) : null, orders: orders.length, modules, adSpend: spend, budgetAvailable: recordedSpend!==null, truncated: (orderResult.data || []).length === 1000 }} />}
  </main>;
}

export async function loadDemandData(supabase:Awaited<ReturnType<typeof requireUser>>['supabase'],options:{suppressWise?:boolean}={}){
  const now = Date.now();
  const since = now - 30 * 86400000;
  const [inventoryResult, orderResult, containerResult, wise, saleResult, planningResult, businessContext, expensesResult, financingResult] = await Promise.all([
    supabase.from('inventory').select('available_qty,module_slug,reserved_qty,fabric_slug,updated_at').returns<Pick<InventoryRow, 'available_qty' | 'module_slug' | 'reserved_qty' | 'fabric_slug' | 'updated_at'>[]>(),
    supabase.from('shopify_orders').select('created_at,fabric_slug,total_modules,total_price,payment_status,currency,corner_qty,armless_qty,ottoman_qty,raw_shopify_json').gte('created_at', new Date(since).toISOString()).order('created_at', { ascending: false }).limit(1000).returns<ShopifyOrder[]>(),
    supabase.from('container_entries').select('*').order('eta', { ascending: true, nullsFirst: false }).returns<(ContainerEntry & {amount_currency?:string|null})[]>(),
    (options.suppressWise?readWiseSummary({configured:false,requestsAllowed:false,lookbackDays:469,read:async()=>{throw new Error('Wise disabled for this brief');}}):refreshWiseBalances().then(result=>result.summary)).catch(() => null),
    readSale().then(sale => ({ sale, error: null })).catch(() => ({ sale: null, error: 'Sale status is unavailable. Refresh before relying on the forecast.' })),
    supabase.from('demand_planning_settings').select('settings').eq('id', 1).maybeSingle(),
    readOperatorContext(supabase),
    supabase.from("major_expenses").select("*").eq("status","open").returns<MajorExpense[]>(),
    supabase.from("wayflyer_payments").select("*").eq("status","scheduled").returns<WayflyerPayment[]>()
  ]);
  const coreDataUnavailable=!!(inventoryResult.error||orderResult.error||containerResult.error);
  // Shared context is advisory; it never changes sale, budget or stock calculations.
  const contextNote = businessContext.available ? businessContext.promotionFocus : null;
  const inventory = (inventoryResult.data || []).reduce((stock, row) => {
    const key = moduleKey(row.module_slug);
    if (key) stock[key] += Math.max(0, Number(row.available_qty || 0) - Number(row.reserved_qty || 0));
    return stock;
  }, empty());
  const orders = (orderResult.data || []).filter(order => order.currency === 'CAD' && order.payment_status?.toUpperCase() === 'PAID' && Number(order.total_modules) > 0 && !(order.raw_shopify_json as RawOrder | null)?.cancelledAt && Date.parse(order.created_at) <= now);
  const modules = orders.reduce((sum, order) => sum + Number(order.total_modules || 0), 0);
  const wiseData=wiseOperationalData(wise,now);
  const recordedSpend=wiseData.spendCADSince(since);
  const spend=recordedSpend??0; // Internal model placeholder only; availability flags withhold presentation and CAC.
  const revenueValues = orders.map(productRevenue);
  const incoming = (containerResult.data || []).filter(container => container.status === 'in_transit' || container.status === 'production').map(container => ({
    eta: container.eta,
    modules: (container.manifest_json || []).reduce((stock, item) => { const key = moduleKey(item.module); if (key) stock[key] += Math.max(0, Number(item.quantity || 0)); return stock; }, empty())
  }));
  const stockRows = new Map<string, StockDemand>();
  for (const row of inventoryResult.data || []) {
    const key = moduleKey(row.module_slug);
    if (!key || !row.fabric_slug) continue;
    const id = `${fabricKey(row.fabric_slug)}:${key}`;
    const current = stockRows.get(id) || { key: id, stock: 0, dailyModules: 0 };
    current.stock += Math.max(0, Number(row.available_qty || 0) - Number(row.reserved_qty || 0));
    stockRows.set(id, current);
  }
  for (const order of orders) for (const key of ['corner', 'armless', 'ottoman'] as const) {
    if (!order.fabric_slug) continue;
    const id = `${fabricKey(order.fabric_slug)}:${key}`;
    const current = stockRows.get(id) || { key: id, stock: 0, dailyModules: 0 };
    current.dailyModules += Number(order[`${key}_qty`] || 0) / 30;
    stockRows.set(id, current);
  }
  const planningIncoming = (containerResult.data || []).filter(c => c.status === 'production' || c.status === 'in_transit').map(c => ({ eta: c.eta, stock: (c.manifest_json || []).reduce<Record<string,number>>((result,item) => {
    const key = moduleKey(item.module); if (key) { const id = `${fabricKey(item.color)}:${key}`; result[id] = (result[id] || 0) + Math.max(0, Number(item.quantity || 0)); } return result;
  }, {}) }));
  const planningInput={now,rows:[...stockRows.values()],incoming:planningIncoming,dailyOrders:orders.length?orders.length/30:null,settings:readPlanningSettings(planningResult.data?.settings),blocked:(orderResult.data||[]).length===1000||orders.some(order=>!order.fabric_slug)};
  const forecastInput={now,days:30,inventory,incoming,modulesPerOrder:orders.length?modules/orders.length:null,dailyOrders:orders.length?orders.length/30:null,dailyBudget:spend/30,acquisitionCost:recordedSpend!==null&&spend>0&&orders.length>0?spend/orders.length:null,sale:saleResult.sale};
  const cashCommitments:CashCommitment[]=[...(expensesResult.data||[]).map(item=>({id:item.id,title:item.label,amount:item.amount,currency:item.currency,dueDate:item.due_date,source:'invoice' as const})),...(financingResult.data||[]).map(item=>({id:item.id,title:item.label,amount:item.amount,currency:item.currency,dueDate:item.due_date,source:'financing' as const})),...(containerResult.data||[]).filter(item=>item.status!=='closed'&&Number(item.amount_to_be_paid)>0).map(item=>({id:item.id,title:'Container '+item.container_number,amount:item.amount_to_be_paid,currency:item.amount_currency||'USD',dueDate:item.payment_due_at,source:'container' as const}))];
  const strategy=buildOperatingStrategy({now,saleStatusAvailable:!saleResult.error,objective:businessContext.available?businessContext.objective:'',targetDate:businessContext.available?businessContext.targetDate:'',goal:businessContext.available?businessContext.goal:null,dailyAdBudget:businessContext.available?businessContext.dailyAdBudget:null,planUpdatedAt:businessContext.available?businessContext.updatedAt:null,planCommitments:businessContext.available?businessContext.commitments:[],balances:wiseData.businessBalances,cashComplete:wiseData.cashComplete,cashRetrievedAt:wiseData.cashRetrievedAt,cashStatus:wiseData.cashStatus,cashWarnings:[...wiseData.warnings,...(wiseData.spendingUsable&&recordedSpend===null?['Wise statement coverage does not include the requested thirty-day window; spending is unavailable.']:[])],statementStatus:wiseData.spendingStatus,statementRetrievedAt:wiseData.spendingRetrievedAt,commitments:cashCommitments,commitmentsComplete:!expensesResult.error&&!financingResult.error&&!containerResult.error,inventoryAvailable:!inventoryResult.error,ordersAvailable:!orderResult.error,arrivalsAvailable:!containerResult.error,inventory:(inventoryResult.data||[]).map(row=>({key:(row.fabric_slug||'unknown')+':'+(row.module_slug||'unknown'),available:Math.max(0,Number(row.available_qty||0)-Number(row.reserved_qty||0)),updatedAt:row.updated_at})),incoming:(containerResult.data||[]).filter(item=>item.status==='in_transit'||item.status==='production').map(item=>({id:item.id,eta:item.eta,modules:(item.manifest_json||[]).reduce((sum,module)=>sum+Number(module.quantity||0),0)})),paidOrders:orders.length,forecast:forecastInput,planning:planningInput});

 return {now,inventoryResult,orderResult,containerResult,wise,saleResult,planningResult,businessContext,contextNote,inventory,orders,modules,spend,recordedSpend,wiseData,revenueValues,incoming,stockRows,planningIncoming,coreDataUnavailable,strategy};
}
