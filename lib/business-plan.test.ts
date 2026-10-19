import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBusinessPlanStore, emptyBusinessPlan } from './business-plan';
import { createContentStore } from './content-store';
import { emptyPost } from './content';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'luun-plan-test-'));
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));
const plans=createBusinessPlanStore(root);
test('shared objective, promise and dated commitment persist, with conflict protection',()=>{
 assert.equal(plans.read().version,0);
 const body={...emptyBusinessPlan,objective:'Test objective only',targetDate:'2026-11-01',promotionFocus:'Verified stock only',customerPromise:'No unconfirmed delivery promises',constraints:'No external actions',commitments:[{id:'review',title:'Review content batch',dueDate:'2026-10-28',status:'open',evidence:''}]};
 const saved=plans.save(body);assert.equal(saved.version,1);assert.equal(createBusinessPlanStore(root).read().customerPromise,body.customerPromise);
 assert.throws(()=>plans.save(body),/changed/);
 assert.throws(()=>plans.save({...saved,commitments:[{...saved.commitments[0],status:'done'}]}),/completion evidence/);
 assert.equal(plans.save({...saved,commitments:[{...saved.commitments[0],status:'done',evidence:'Reviewed local test fixture'}]}).commitments[0].status,'done');
 assert.equal(fs.statSync(path.join(root,'plan.json')).mode&0o777,0o600);
});
test('changed shared objective requires fresh content review; old records remain readable',()=>{
 const posts=createContentStore(root);const plan=plans.read();let post=posts.save({...emptyPost,title:'Test package',objective:plan.objective,caption:'Test caption',assetReference:'test-only-reference',status:'approved'},plan);
 assert.equal(post.planVersion,plan.version);
 const next=plans.save({...plan,objective:'Changed test objective'});
 assert.throws(()=>posts.save({...post,status:'planned',plannedAt:'2026-11-01T10:00:00Z'},next),/shared plan changed/);
 post=posts.save({...post,status:'needs_review'},next);assert.equal(post.approvedAt,null);assert.equal(post.planVersion,next.version);
 post=posts.save({...post,objective:next.objective,plannedAt:'2026-11-01T10:00:00.000Z',status:'needs_review'},next);post=posts.save({...post,status:'approved'},next);
 assert.equal(posts.save({...post,status:'planned',plannedAt:'2026-11-01T10:00:00Z'},next).status,'planned');
});
