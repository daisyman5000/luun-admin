import {createHmac} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preorderAuthorizeUrl,verifyPreorderCallback,PREORDER_SCOPES,missingPreorderScopes} from './oauth';
const config={clientId:'preorder-app',clientSecret:'test-only-secret',shop:'luun-test.myshopify.com',origin:'https://luun-admin.example.com'};
const state='a'.repeat(64);
function signed(){
 const params=new URLSearchParams({code:'test-code',shop:config.shop,state,timestamp:'1791250000'});
 const message=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('&');
 params.set('hmac',createHmac('sha256',config.clientSecret).update(message).digest('hex'));
 return params;
}
test('authorization uses isolated client, callback and bounded permissions',()=>{
 const url=new URL(preorderAuthorizeUrl(config,state));
 assert.equal(url.hostname,config.shop);
 assert.equal(url.searchParams.get('client_id'),config.clientId);
 assert.equal(url.searchParams.get('redirect_uri'),config.origin+'/api/preorders/callback');
 assert.equal(url.searchParams.get('scope'),[...PREORDER_SCOPES,'write_inventory','read_locations'].join(','));
 assert.throws(()=>preorderAuthorizeUrl({...config,shop:'attacker.example.com'},state));
 assert.throws(()=>preorderAuthorizeUrl({...config,origin:'http://luun-admin.example.com'},state));
});
test('callback rejects tampering, cross-app signatures, state replay and duplicate fields',()=>{
 assert.equal(verifyPreorderCallback(config,signed(),state),true);
 assert.equal(verifyPreorderCallback(config,signed(),undefined),false);
 assert.equal(verifyPreorderCallback(config,signed(),'b'.repeat(64)),false);
 assert.equal(verifyPreorderCallback({...config,clientSecret:'other-app'},signed(),state),false);
 const changed=signed();changed.set('code','attacker-code');
 assert.equal(verifyPreorderCallback(config,changed,state),false);
 const duplicate=signed();duplicate.append('shop',config.shop);
 assert.equal(verifyPreorderCallback(config,duplicate,state),false);
});
test('grant normalization accepts implied read without accepting insufficient write access',()=>{
 assert.deepEqual(missingPreorderScopes(PREORDER_SCOPES.join(',')),[]);
 assert.deepEqual(missingPreorderScopes('read_orders,write_products,write_purchase_options,write_payment_mandate'),[]);
 assert.ok(missingPreorderScopes('read_orders,write_products,write_purchase_options,read_payment_mandate').includes('write_payment_mandate'));
 assert.ok(missingPreorderScopes('read_orders,write_products').includes('write_payment_mandate'));
});
