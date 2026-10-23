/* Luun first-party funnel. No advertising APIs, pixels or paid services. */
(function(){
 'use strict';if(window.__luunFunnelV1)return;window.__luunFunnelV1=true;
 var base='https://luun-admin-et42.vercel.app',key='luun-funnel-v1',state,now=Date.now();
 function permitted(){return navigator.doNotTrack!=='1'&&!navigator.globalPrivacyControl&&window.luunAnalyticsConsent!==false;}
 if(!permitted())return;
 try{state=JSON.parse(sessionStorage.getItem(key)||'null');}catch(e){}
 if(!state||now-state.at>1800000){state={id:crypto.randomUUID(),at:now,sent:{},channel:'direct',test:new URLSearchParams(location.search).get('luun_test')==='1'};var p=new URLSearchParams(location.search),m=p.get('utm_medium')||'';state.channel=/^(cpc|ppc|paid|paid_social)$/.test(m)?'paid':m==='email'?'email':/social/.test(m)?'social':document.referrer?/google\.|bing\.|duckduckgo\./.test(document.referrer)?'search':'other':'direct';}
 function persist(){try{sessionStorage.setItem(key,JSON.stringify(state));}catch(e){}}
 persist();var originalFetch=window.fetch.bind(window);
 function track(stage){if(!permitted()||state.sent[stage])return;state.sent[stage]=true;state.at=Date.now();persist();originalFetch(base+'/api/funnel/events',{method:'POST',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:state.id,stage:stage,at:Date.now(),channel:state.channel,test:state.test})}).catch(function(){});}
 track('landing');
 function start(){var nodes=document.querySelectorAll('[data-lcr-card],[data-lmb-root]');if(typeof IntersectionObserver==='function'){var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){track('product_view');io.disconnect();}});},{threshold:.25});nodes.forEach(function(n){io.observe(n);});}
 document.addEventListener('click',function(e){if(!e.isTrusted)return;var t=e.target;if(!(t instanceof Element))return;if(t.closest('[data-lmb-color],[data-lmb-go],.lmb-modules button,[data-lmb-checkout-btn]')){var s=window.LuunBuilderBridge&&window.LuunBuilderBridge.getState();if(s&&s.counts&&Object.values(s.counts).some(function(n){return n>0;})){track('product_view');track('configuration');}}},true);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 // Add only an anonymous session to Luun's existing checkout requests. Never inspect other requests.
 window.fetch=function(input,init){try{var url=new URL(typeof input==='string'?input:input.url,location.href);if(permitted()&&url.origin===base&&/^\/api\/(sale-checkout|preorder-checkout)$/.test(url.pathname)&&init&&init.method==='POST'&&typeof init.body==='string'){var body=JSON.parse(init.body);body.funnelSession=state.id;body.funnelTest=state.test;init=Object.assign({},init,{body:JSON.stringify(body)});return originalFetch(input,init).then(function(response){if(response.ok)response.clone().json().then(function(cart){if(cart.checkoutUrl)track('checkout_start');}).catch(function(){});return response;});}}catch(e){}return originalFetch(input,init);};
})();
