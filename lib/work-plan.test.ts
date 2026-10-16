import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkPlan } from './work-plan';
import { emptyBusinessPlan } from './business-plan';
import { emptyPost, type ContentPost } from './content';
test('work agenda uses only saved dates, excludes completed work and exposes dependencies',()=>{
 const plan={...emptyBusinessPlan,version:2,commitments:[{id:'open',title:'Review batch',dueDate:'2026-10-20',status:'open' as const,evidence:''},{id:'done',title:'Complete fixture',dueDate:'2026-10-18',status:'done' as const,evidence:'Done'}]};
 const post:ContentPost={...emptyPost,id:'post',version:1,title:'Unapproved fixture',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',approvedAt:null,dueDate:'2026-10-19',planVersion:1};
 const items=buildWorkPlan(plan,[post,{...post,id:'published',status:'published'}]);
 assert.equal(items.length,2);assert.equal(items[0].id,'post');assert.equal(items[0].plannedAt,null);assert.ok(items[0].blockedBy.includes('Select an asset'));assert.ok(items[0].blockedBy.includes('Shared plan changed; review again'));assert.equal(items[1].id,'open');
 assert.deepEqual(buildWorkPlan(emptyBusinessPlan,[]),[]);
});
