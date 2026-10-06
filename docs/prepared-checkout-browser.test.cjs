const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'builder-preorder-footer.html'),'utf8').replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '');
function harness(){
 let open=false;const listeners={},frames=[],intervals=[],observers=[],requests=[],events=[],location={href:''};let response;
 const button={disabled:false,textContent:'Checkout',setAttribute(){}};
 const note={style:{},textContent:'',setAttribute(){}};
 const panel={appendChild(){},classList:{toggle(){}}};
 const root={classList:{contains:()=>open},contains:()=>true,querySelector:s=>s.includes('modal-panel')?panel:s.includes('checkout-btn')?button:null,querySelectorAll:s=>s.includes('checkout-btn')?[button]:[]};
 const ctx={Date,URL,Intl,Math,Number,JSON,Error,Promise,location,document:{querySelector:()=>root,createElement:()=>note},requestAnimationFrame:fn=>frames.push(fn),setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval(){},MutationObserver:class{constructor(fn){this.fn=fn}observe(target){observers.push({target,fn:this.fn})}},fetch:(url,options)=>{requests.push(options);return options.method==='DELETE'?Promise.resolve({ok:true,json:async()=>({released:true})}):new Promise(resolve=>response=resolve)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}};
 ctx.window=ctx;ctx.addEventListener=(event,fn)=>{(listeners[event]??=[]).push(fn)};ctx.dispatchEvent=e=>events.push(e);
 ctx.LuunPricing={getConfigPrice:()=>({total:2340.72,saleDiscountRate:.35})};ctx.LUUN_CONFIG={sale:{active:true}};
 ctx.LuunBuilderBridge={getState:()=>({color:'dark-grey',counts:{corner:2,armless:1,ottoman:0}})};
 ctx.__luunPreorderSupply={current:{'dark-grey':{corner:7,armless:0,ottoman:7}},shipments:[],planIds:{'luun-deposit-4215':'gid://shopify/SellingPlan/1'}};
 vm.runInNewContext(source,ctx);
 const flush=async()=>{for(let i=0;i<12;i++){while(frames.length)frames.shift()();await Promise.resolve()}};
 return {requests,events,button,note,location,flush,open:()=>{open=true;observers.filter(x=>x.target===root).forEach(x=>x.fn())},close:()=>{open=false;observers.filter(x=>x.target===root).forEach(x=>x.fn())},boot:()=>intervals[0](),complete:()=>response({ok:true,json:async()=>({cartId:'gid://shopify/Cart/test?key=secret',checkoutUrl:'https://luunsofa.myshopify.com/cart/c/test?key=secret',totalCents:234072,depositCents:46814,preorder:true})}),click:()=>listeners.click[0]({target:{closest:()=>button},preventDefault(){},stopImmediatePropagation(){}})};
}
test('opening does not reserve; one click makes one checkout request and redirects automatically',async()=>{
 const x=harness();x.boot();await x.flush();x.open();await x.flush();assert.equal(x.requests.length,0);assert.equal(x.button.disabled,false);
 x.click();await x.flush();assert.equal(x.requests.length,1);assert.equal(x.button.disabled,true);assert.equal(x.button.textContent,'Opening checkout…');
 const payload=JSON.parse(x.requests[0].body);assert.equal(payload.fastCheckout,true);assert.equal(payload.preorder,true);assert.equal(payload.planId,'gid://shopify/SellingPlan/1');
 x.boot();await x.flush();assert.equal(x.requests.length,1);x.complete();await x.flush();assert.match(x.location.href,/luunsofa/);assert.equal(x.requests.length,1);assert.equal(x.events.filter(e=>e.type==='luun:checkout-start').length,1);
});
test('closing during the clicked request cancels its exact cart and never redirects',async()=>{
 const x=harness();x.open();await x.flush();x.click();await x.flush();x.close();await x.flush();x.complete();await x.flush();assert.equal(x.requests.length,2);assert.equal(x.requests[1].method,'DELETE');assert.equal(JSON.parse(x.requests[1].body).cartId,'gid://shopify/Cart/test?key=secret');assert.equal(x.location.href,'');
});

const factoryContext={};vm.runInNewContext(source.slice(source.indexOf('function createPreparedCheckout'),source.indexOf('var root='))+';this.factory=createPreparedCheckout;',factoryContext);const createController=factoryContext.factory;
function deferred(){let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)}}
function setup(custom={}){let now=1000;const created=[],released=[];const c=createController({now:()=>now,create:async s=>{created.push(s.key);return {key:s.key,cartId:s.key,expiresAt:now+5400000}},release:async cart=>{released.push(cart.key)},...custom});return {c,created,released,setNow:n=>now=n};}
test('repeated preparation and stock refresh reuse one verified cart',async()=>{const x=setup(),s={key:'same',expiresAt:Infinity};const a=x.c.prepare(s),b=x.c.prepare(s);assert.equal(a,b);const cart=await a;assert.equal(x.c.ready('same'),cart);assert.equal(await x.c.prepare(s),cart);assert.deepEqual(x.created,['same']);});
test('configuration/price change empties the old cart before creating the next',async()=>{const x=setup();await x.c.prepare({key:'old'});const next=await x.c.prepare({key:'new'});assert.equal(next.key,'new');assert.deepEqual(x.released,['old']);assert.equal(x.c.ready('old'),null);});
test('closing during preparation releases its eventual reservation',async()=>{const d=deferred(),released=[];const x=setup({create:()=>d.promise,release:async c=>released.push(c.cartId)});const p=x.c.prepare({key:'old'});await Promise.resolve();await Promise.resolve();const closing=x.c.cancel();d.resolve({cartId:'old'});await assert.rejects(p,e=>e.superseded===true);await closing;assert.deepEqual(released,['old']);assert.equal(x.c.ready('old'),null);});
test('failed cancellation blocks replacement and retains the cart for retry',async()=>{let fail=true,created=0;const x=setup({create:async s=>({cartId:s.key,key:s.key}),release:async()=>{if(fail)throw Error('release failed')}});await x.c.prepare({key:'old'});await assert.rejects(x.c.prepare({key:'new'}),/release failed/);assert.equal(x.c.ready('new'),null);fail=false;assert.equal((await x.c.prepare({key:'new'})).key,'new');});
test('expiry and sale-end timestamps prevent using stale checkout URLs',async()=>{const x=setup();await x.c.prepare({key:'sale',expiresAt:1500});x.setNow(1500);assert.equal(x.c.ready('sale'),null);await x.c.prepare({key:'regular'});assert.deepEqual(x.released,['sale']);x.setNow(301501);assert.equal(x.c.ready('regular'),null);});
