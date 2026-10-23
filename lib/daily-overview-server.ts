import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import {buildDailyOverview,type Rows,type OverviewInput} from '@/lib/daily-overview';
export async function loadDailyOverview(){const db=createAdminClient();
 async function read<T>(table:string,columns:string,order='id'):Promise<Rows<T>>{const rows:T[]=[];for(let offset=0;offset<10000;offset+=1000){let q=db.from(table).select(columns).order(order);if(table==='operator_source_state')q=q.in('source',['wise_balances','shopify_orders']);const r=await q.range(offset,offset+999);if(r.error)return {rows:[],error:'Stored records unavailable',truncated:false};rows.push(...r.data as unknown as T[]);if((r.data?.length||0)<1000)return {rows,error:null,truncated:false};}return {rows,error:null,truncated:true};}
 const [orders,stock,containers,tickets,posts,plan,sources,actuals,expenses,debt,published]=await Promise.all([
 read<OverviewInput['orders']['rows'][number]>('shopify_orders','id,order_number,total_price,currency,payment_status,fulfillment_status,delivery_status,delivered_at,action_needed,created_at,updated_at,test:raw_shopify_json->test,cancelled_at:raw_shopify_json->cancelledAt,cancelled_legacy:raw_shopify_json->cancelled_at'),
 read<OverviewInput['stock']['rows'][number]>('inventory','id,fabric_slug,module_slug,available_qty,reserved_qty,incoming_qty,low_stock_threshold,updated_at'),
 read<OverviewInput['containers']['rows'][number]>('container_entries','id,container_number,status,eta,payment_due_at,amount_to_be_paid,updated_at'),
 read<OverviewInput['tickets']['rows'][number]>('job_tickets','id,title,status,category,inquiry_status,is_test,next_step,due_at,updated_at'),
 read<OverviewInput['posts']['rows'][number]>('operator_content_posts','id,package,updated_at'),
 read<OverviewInput['plan']['rows'][number]>('operator_business_plan','id,package,updated_at'),
 read<OverviewInput['sources']['rows'][number]>('operator_source_state','source,scope,status,last_success_at,read_complete,balances:payload->balances,cash_source:payload->sources->balances','source'),
 read<OverviewInput['actuals']['rows'][number]>('finance_actual_records','id,day,category,amount,currency'),
 read<OverviewInput['expenses']['rows'][number]>('major_expenses','id,label,status,due_date,updated_at'),
 read<OverviewInput['debt']['rows'][number]>('wayflyer_payments','id,label,status,due_date,updated_at'),
 read<OverviewInput['published']['rows'][number]>('instagram_publish_jobs','id,post_id,state')]);
 return buildDailyOverview({orders,stock,containers,tickets,posts,plan,sources,actuals,expenses,debt,published});
}
