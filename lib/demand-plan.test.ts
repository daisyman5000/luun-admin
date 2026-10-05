import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlan, EMPTY_PLANNING, type PlanInput } from './demand-plan';
const now=Date.parse('2026-10-05T20:00:00Z'), day=86400000;
const base: PlanInput={now, rows:[{key:'jade:corner',stock:100,dailyModules:2}],incoming:[{eta:'2026-11-04',stock:{'jade:corner':100}}],dailyOrders:1,settings:{leadDays:40,bufferDays:5,costPerPaidOrder:100,organicOrders:0.2,saleLift:2,maxBudget:500}};
test('budget converts replenishment pace into incremental paid orders',()=>{
 const p=calculatePlan(base);assert.equal(p.budget,130);assert.equal(p.saleStart,null);assert.equal(p.saleEnd,null);
});
test('container deadline includes a confirmed arrival exactly once',()=>{
 const p=calculatePlan(base); // 200 modules / 2 per day - 5 buffer - 40 lead
 assert.equal(p.orderDate,new Date(now+(190/3-40)*day).toISOString());
});
test('stockout before shipment cannot be concealed by that shipment',()=>{
 const p=calculatePlan({...base,rows:[{key:'jade:corner',stock:20,dailyModules:2}]});
 assert.equal(p.orderDate,new Date(now-15*day).toISOString());assert.equal(p.saleStart,null);assert.equal(p.budget,0);
});
test('a missing demanded colour is a bottleneck despite abundant other stock',()=>{
 const p=calculatePlan({...base,rows:[...base.rows,{key:'grey:corner',stock:0,dailyModules:1}],incoming:[...base.incoming,{eta:'2026-11-04',stock:{'grey:corner':100}}]});
 assert.equal(p.budget,0);assert.equal(p.limiting,'grey:corner');assert.equal(p.saleStart,null);
});
test('unknown and overdue arrivals cannot produce a budget recommendation',()=>{
 for(const eta of [null,'2026-10-01','invalid']) {const p=calculatePlan({...base,incoming:[{eta,stock:{'jade:corner':100}}]});assert.equal(p.budget,null);assert.equal(p.orderDate,new Date(now+5*day).toISOString());}
});
test('missing evidence blocks affected outputs without invented assumptions',()=>{
 const p=calculatePlan({...base,settings:EMPTY_PLANNING});assert.equal(p.budget,null);assert.equal(p.orderDate,null);
 const noLift=calculatePlan({...base,settings:{...base.settings,saleLift:null}});assert.equal(noLift.budget,130);assert.equal(noLift.saleStart,null);
 const noCAC=calculatePlan({...base,settings:{...base.settings,costPerPaidOrder:null}});assert.equal(noCAC.budget,null);assert.notEqual(noCAC.orderDate,null);
 assert.equal(calculatePlan({...base,blocked:true}).orderDate,null);
});
test('budget respects spending ceiling and weak sale results give no dates',()=>{
 assert.equal(calculatePlan({...base,settings:{...base.settings,maxBudget:50}}).budget,50);
 assert.equal(calculatePlan({...base,settings:{...base.settings,saleLift:1.1}}).saleStart,null);
});

test('incomplete or malformed saved settings cannot produce invalid dates',()=>{
 const p=calculatePlan({...base,settings:{} as PlanInput['settings']});assert.equal(p.orderDate,null);
 assert.equal(calculatePlan({...base,settings:{...base.settings,leadDays:NaN}}).orderDate,null);
});

test('sale only closes the gap left by capped ads and moves the container deadline',()=>{const p=calculatePlan({...base,settings:{...base.settings,maxBudget:100}});assert.equal(p.budget,100);assert.equal(p.saleStart,new Date(now).toISOString());assert.equal(p.saleEnd,new Date(now+7.5*day).toISOString());assert.equal(p.orderDate,new Date(now+(190/2.4-7.5-40)*day).toISOString());});
