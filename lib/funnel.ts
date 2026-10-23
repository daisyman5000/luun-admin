export const FUNNEL_STAGES=['landing','product_view','configuration','checkout_start','purchase'] as const;
export type FunnelStage=typeof FUNNEL_STAGES[number];
export type FunnelEvent={id:string;session_id:string;stage:Exclude<FunnelStage,'purchase'>;occurred_at:string;channel:string;test:boolean};
export type FunnelPurchase={id:string;session_id:string|null;occurred_at:string;amount:number;currency:string;test:boolean};
export const SESSION_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function funnelSession(value:unknown){return typeof value==='string'&&SESSION_RE.test(value)?value:null;}
export function validateFunnelEvent(value:unknown,now=new Date()){
 const b=value as Record<string,unknown>;if(!b||!funnelSession(b.session_id)||!FUNNEL_STAGES.slice(0,4).includes(b.stage as FunnelStage))throw Error('Invalid tracking event');
 // No URL, referrer, names, email, IP address or arbitrary properties are retained.
 const channel=['direct','search','email','social','paid','other'].includes(String(b.channel))?String(b.channel):'other';
 const observed=typeof b.at==='number'&&Number.isFinite(b.at)&&b.at>=now.getTime()-1800000&&b.at<=now.getTime()+60000?new Date(b.at):now;
 return {id:b.session_id+':'+b.stage,session_id:String(b.session_id),stage:b.stage as FunnelEvent['stage'],occurred_at:observed.toISOString(),channel,test:b.test===true};
}
export function paidOrder(payload:Record<string,unknown>):FunnelPurchase|null{
 if(payload.test===true||payload.cancelled_at||!['paid','partially_paid'].includes(String(payload.financial_status)))return null;
 const id=String(payload.id||'');if(!/^\d+$/.test(id))return null;
 const amount=Number(payload.current_total_price??payload.total_price),currency=String(payload.currency||''),date=String(payload.created_at||'');
 if(!Number.isFinite(amount)||amount<0||!/^([A-Z]{3})$/.test(currency)||!Number.isFinite(Date.parse(date)))return null;
 const attrs=Array.isArray(payload.note_attributes)?payload.note_attributes:[];
 const session=attrs.find(a=>a?.name==='Luun funnel session')?.value;
 return {id:'shopify:'+id,session_id:funnelSession(session),occurred_at:new Date(date).toISOString(),amount,currency,test:false};
}
export function analyzeFunnel(events:FunnelEvent[],purchases:FunnelPurchase[],now=new Date()){
 const sessions=new Map<string,{events:Map<string,string>;channel:string;start:string}>();
 for(const e of events.filter(e=>!e.test)){let s=sessions.get(e.session_id);if(!s){s={events:new Map(),channel:e.channel,start:e.occurred_at};sessions.set(e.session_id,s);}const old=s.events.get(e.stage);if(!old||e.occurred_at<old)s.events.set(e.stage,e.occurred_at);if(e.occurred_at<s.start){s.start=e.occurred_at;s.channel=e.channel;}}
 const bought=new Map<string,FunnelPurchase[]>(),seenOrders=new Set<string>();for(const p of purchases.filter(p=>!p.test&&p.session_id&&!seenOrders.has(p.id)&&(seenOrders.add(p.id),true))){const a=bought.get(p.session_id!)||[];a.push(p);bought.set(p.session_id!,a);}
 const counts=FUNNEL_STAGES.map(()=>0),mature=FUNNEL_STAGES.map(()=>0),daily:Record<string,number[]>={},channels:Record<string,number[]>={};let revenue=0,cadOrders=0;
 for(const [sid,s] of sessions){const landing=s.events.get('landing');if(!landing)continue;const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(landing));const d=daily[day]||FUNNEL_STAGES.map(()=>0),c=channels[s.channel]||FUNNEL_STAGES.map(()=>0);let previous=landing;
  for(let i=0;i<FUNNEL_STAGES.length;i++){const stage=FUNNEL_STAGES[i];const p=stage==='purchase'?(bought.get(sid)||[]).filter(p=>p.occurred_at>=previous).sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at))[0]:null;const at=stage==='purchase'?p?.occurred_at:s.events.get(stage);if(!at||at<previous)break;counts[i]++;d[i]++;c[i]++;if(now.getTime()-Date.parse(landing)>=86400000)mature[i]++;previous=at;if(p){for(const order of (bought.get(sid)||[]).filter(o=>o.occurred_at>=s.events.get('checkout_start')!&&o.currency==='CAD')){revenue+=Number(order.amount);cadOrders++;}}}
  daily[day]=d;channels[s.channel]=c;
 }
 const steps=FUNNEL_STAGES.slice(1).map((stage,i)=>({from:FUNNEL_STAGES[i],to:stage,entered:counts[i],continued:counts[i+1],lost:counts[i]-counts[i+1],conversion:counts[i]?counts[i+1]/counts[i]:null,matureEntered:mature[i],matureContinued:mature[i+1],matureLost:mature[i]-mature[i+1]}));
 const bottleneck=steps.filter(s=>s.matureEntered>=100&&s.matureLost>0).sort((a,b)=>b.matureLost-a.matureLost)[0]||null;
 return {counts,steps,bottleneck,daily,channels,matchedOrderValueCAD:Math.round(revenue*100)/100,averageOrderValueCAD:cadOrders?Math.round(revenue/cadOrders*100)/100:null,unattributedPaidOrders:purchases.filter(p=>!p.test&&(!p.session_id||!sessions.has(p.session_id))).length,trackedSessions:counts[0],matureSessions:mature[0],basis:'Ordered same-session funnel. Cohorts use landing day (America/Vancouver). Bottleneck uses sessions at least 24 hours old and at least 100 entrants; ranking is lost sessions, not proven revenue opportunity.'};
}
export function improvementDraft(analysis:ReturnType<typeof analyzeFunnel>){
 const b=analysis.bottleneck;if(!b)return {stage:'measurement',title:'Collect enough evidence before changing the funnel',hypothesis:'There is not enough mature, linked tracking evidence to identify the largest measurable drop-off.',copy:null,actions:['Verify landing, visible product, configuration and checkout tracking with test traffic.','Wait for at least 100 entrants at a step and 24 hours for sessions to mature.','Check that paid orders carry the funnel session before interpreting checkout conversion.'],metric:'Tracking coverage',engine:'Evidence rules · no paid AI call'};
 const drafts={product_view:{title:'Make the first next step clear',copy:'Find your sofa configuration. Choose your modules and fabric, then see your price.',hypothesis:'Visitors may not see a clear route from the page to choosing a sofa.'},configuration:{title:'Make configuration easier to start',copy:'Build a sofa for your space. Start with a configuration, then choose your fabric.',hypothesis:'Product viewers may need a clearer starting point for configuration.'},checkout_start:{title:'Make the checkout handoff explicit',copy:'Review your configuration and price. Continue to checkout when you’re ready.',hypothesis:'People who configure a sofa may be uncertain about what happens next.'},purchase:{title:'Investigate checkout friction before changing the offer',copy:'Need help with your configuration or checkout? Contact Luun before placing your order.',hypothesis:'Checkout abandonment may reflect payment, delivery, price or technical friction; event counts alone cannot identify which.'}};
 const draft=drafts[b.to as keyof typeof drafts];return {stage:b.to,...draft,actions:['Treat this explanation as a hypothesis, not a verified cause.','Check the affected page and customer questions before using this copy.','Change one element, retain the original, and measure the same step over a comparable period.'],metric:b.from+' → '+b.to,engine:'Evidence rules · no paid AI call'};
}
