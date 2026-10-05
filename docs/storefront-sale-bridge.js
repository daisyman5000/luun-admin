/* Install once in Webflow after LUUN_CONFIG / LuunPricing. Keep it off until the admin is deployed. */
(function(){
 'use strict';
 var base='https://luun-admin-et42.vercel.app', pricing=window.LuunPricing;
 if(!pricing || window.__luunSaleBridge)return;
 window.__luunSaleBridge=1;
 var original=pricing.getConfigPrice, originalMoney=pricing.formatMoney;
 var state=null,lastChecked=0,pending=false,lastRenderedActive=false,expiryTimer;
 function active(){return state && state.active && (!state.endsAt || Date.now()<Date.parse(state.endsAt));}
 pricing.formatMoney=function(value){return active()?'$'+Number(value||0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2}):originalMoney(value);};
 pricing.getConfigPrice=function(counts){
  var old=original(counts);if(!active())return old;
  var units=state.moduleCents,rate=old.bundleDiscountRate;
  var regular=0,subtotal=0;
  ['corner','armless','ottoman'].forEach(function(k){var n=old[k],unit=units[k];subtotal+=unit*n;regular+=n*(unit-Math.floor(unit*Math.round(rate*100)/100));});
  var bps=rate===.15?4475:rate===.14?4410:rate===.11?4215:3500;
  var total=0;['corner','armless','ottoman'].forEach(function(k){total+=old[k]*(units[k]-Math.floor(units[k]*bps/10000));});
  return Object.assign({},old,{subtotal:subtotal/100,compareTotal:regular/100,regularTotal:regular/100,total:total/100,saleDiscountRate:.35,discountRate:1-(1-rate)*.65,discountAmount:(subtotal-total)/100});
 };
 var banner=document.createElement('div');banner.setAttribute('data-luun-sale-banner','');banner.hidden=true;
 banner.style.cssText='background:#243c2b;color:#fff;text-align:center;padding:12px 20px;font:500 13px/1.5 "DM Sans",sans-serif';
 // Place below the first hero/builder navigation area so it does not obscure fixed navigation.
 var section=document.querySelector('.luun-video-hero,.lmb');if(section)section.after(banner);else document.body.prepend(banner);
 var message=document.createElement('p');message.setAttribute('role','status');message.style.cssText='font:13px/1.5 "DM Sans",sans-serif;color:#243c2b';
 var buy=document.querySelector('.lmb-checkout,[data-lmb-modal-panel="pay-now"]');if(buy)buy.appendChild(message);
 function refresh(){
  pricing.updatePagePrices();
  var s=window.LuunBuilderBridge&&window.LuunBuilderBridge.getState();
  if(s){var p=pricing.getConfigPrice(s.counts);document.querySelectorAll('[data-lmb-price],[data-lmb-modal-total],[data-lmb-rbc-total],[data-lmb-shopify-total]').forEach(function(el){el.textContent=pricing.formatMoney(p.total);});
   document.querySelectorAll('[data-lmb-rbc-monthly]').forEach(function(el){el.textContent=pricing.formatMoney(Math.ceil(p.total/36))+'/mo';});
   document.querySelectorAll('[data-lmb-shopify-monthly]').forEach(function(el){el.textContent=pricing.formatMoney(Math.ceil(p.total/12))+'/mo';});
   var lines=document.querySelector('[data-lmb-cart-lines]');if(lines && (active() || lastRenderedActive)){
    lines.replaceChildren();
    function row(label,amount){var r=document.createElement('div');r.className='lmb-line';var l=document.createElement('span'),v=document.createElement('span');l.textContent=label;v.textContent=amount;r.append(l,v);lines.appendChild(r);}
    ['corner','armless','ottoman'].forEach(function(k){if(p[k])row(p[k]+' × '+k+' module',pricing.formatMoney((active()?state.moduleCents[k]/100:pricing.getRawModulePrice(k))*p[k]));});
    if(p.bundleDiscountRate)row(Math.round(p.bundleDiscountRate*100)+'% '+(active()?'quantity savings':'bundle discount'),'−'+pricing.formatMoney(p.subtotal-(active()?p.regularTotal:p.total)));
    if(active())row('Additional 35% sale savings','−'+pricing.formatMoney(p.regularTotal-p.total));
   }
  }
  lastRenderedActive=!!active();
  clearTimeout(expiryTimer);
  if(active() && state.endsAt)expiryTimer=setTimeout(refresh,Math.min(2147483647,Math.max(1,Date.parse(state.endsAt)-Date.now())));
  banner.hidden=!active();banner.textContent=active()?state.announcement:'';
  message.textContent=active()?state.deliveryMessage:'';
 }
 function sync(){return fetch(base+'/api/public-sale',{credentials:'omit',cache:'no-store'}).then(function(r){if(!r.ok)throw Error('Unable to confirm sale pricing. Please refresh before checkout.');return r.json();}).then(function(data){if(data.version!==1)throw Error('Sale connection needs an update.');state=data;lastChecked=Date.now();window.LUUN_CONFIG.sale=Object.assign({},window.LUUN_CONFIG.sale,{active:active(),showComparePrice:active(),name:data.name,endsAt:data.endsAt});refresh();}).catch(function(e){lastChecked=0;message.textContent=e.message;throw e;});}
 window.addEventListener('luun-builder-counts-changed',refresh);
 var priceNode=document.querySelector('[data-lmb-price]');
 if(priceNode)new MutationObserver(function(){
  if(!active())return;
  var s=window.LuunBuilderBridge&&window.LuunBuilderBridge.getState();
  if(s && priceNode.textContent!==pricing.formatMoney(pricing.getConfigPrice(s.counts).total))refresh();
 }).observe(priceNode,{childList:true,characterData:true,subtree:true});
 document.addEventListener('click',function(e){
  var button=e.target.closest('[data-lmb-checkout-btn]');if(!button || button.disabled)return;
  if(!state || Date.now()-lastChecked>45000){e.preventDefault();e.stopImmediatePropagation();sync().catch(function(){});return;}
  if(!active())return;
  e.preventDefault();e.stopImmediatePropagation();if(pending)return;
  var s=window.LuunBuilderBridge&&window.LuunBuilderBridge.getState();if(!s)return;
  pending=true;message.textContent='Confirming your Shopify checkout total…';
  fetch(base+'/api/sale-checkout',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({counts:s.counts,fabric:s.color})}).then(function(r){return r.json().then(function(b){if(!r.ok)throw Error(b.error);return b;});}).then(function(cart){
   var url=new URL(cart.checkoutUrl);if(url.protocol!=='https:' || !(url.hostname==='luunsofa.myshopify.com'||url.hostname==='1ec339-02.myshopify.com'||url.hostname==='checkout.luun.ca'))throw Error('Unexpected checkout destination');
   window.dispatchEvent(new CustomEvent('luun:checkout-start',{detail:{value:cart.totalCents/100,currency:'CAD',counts:s.counts}}));window.location.href=cart.checkoutUrl;
  }).catch(function(error){message.textContent=error.message;}).finally(function(){pending=false;});
 },true);
 sync().catch(function(){});setInterval(function(){if(!document.hidden)sync().catch(function(){});},30000);
 document.addEventListener('visibilitychange',function(){if(!document.hidden)sync().catch(function(){});});
})();
