import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quote,quantityRate,validateCounts,CHECK_CONFIGS,saleBasisPoints} from './pricing';
import {cleanSale,DEFAULT_SALE,isSaleActive} from './types';
test('quantity tiers preserve every boundary',()=>{assert.deepEqual([1,2,3,4,5,6,7].map(quantityRate),[0,0,.11,.14,.14,.15,.15]);});
test('four module regular total matches observed Shopify checkout',()=>{assert.equal(quote({corner:2,armless:1,ottoman:1},false).totalCents,400895);});
test('targeted tiers preserve quantity savings with an additional 35%',()=>{
 assert.deepEqual([1,2,3,4,5,6,7].map(saleBasisPoints),[3500,3500,4215,4410,4410,4475,4475]);
 for(const c of CHECK_CONFIGS){const off=quote(c,false),on=quote(c,true);assert.equal(on.regularCents,off.totalCents);assert.ok(Math.abs(on.totalCents-off.totalCents*.65)<=on.pieces);}
 assert.equal(quote({corner:2,armless:0,ottoman:0},true).totalCents,193002);
 assert.equal(quote({corner:2,armless:1,ottoman:1},true).totalCents,260582);
});
test('counts reject negative, fractional, missing and excessive values',()=>{for(const c of [{corner:-1,armless:0,ottoman:0},{corner:1.5,armless:0,ottoman:0},{corner:101,armless:0,ottoman:0},{corner:0,armless:0,ottoman:0},{}])assert.throws(()=>validateCounts(c));});
test('sale only active when confirmed and inside the time window',()=>{const s={...DEFAULT_SALE,enabled:true,status:'ready' as const,starts_at:'2026-11-27T00:00:00Z',ends_at:'2026-11-28T00:00:00Z'};assert.equal(isSaleActive(s,Date.parse(s.starts_at)),true);assert.equal(isSaleActive(s,Date.parse(s.ends_at)),false);assert.equal(isSaleActive({...s,status:'error'},Date.parse(s.starts_at)),false);});
test('invalid sale windows are rejected',()=>{assert.throws(()=>cleanSale({...DEFAULT_SALE,starts_at:'2026-11-28',ends_at:'2026-11-27'}));});
