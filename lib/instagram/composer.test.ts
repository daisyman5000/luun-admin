import test from 'node:test';import assert from 'node:assert/strict';
import {composerPayload,saveComposer,composerLabel,publishNowPlacement} from './composer';
import {localDateKey} from '../content-calendar';
import {emptyPost,type ContentPost} from '../content';
const image='instagram-media:11111111-1111-4111-8111-111111111111',future=new Date(Date.now()+86400000).toISOString();
const draft={...emptyPost,caption:'A sofa for tonight.',assetReference:image,plannedAt:future};
const previous:ContentPost={...draft,id:'22222222-2222-4222-8222-222222222222',version:4,title:'Existing title',objective:'Retained objective',brief:'Retained brief',dueDate:'2026-12-01',status:'approved',completionEvidence:'Retained evidence',approvedAt:new Date().toISOString(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
test('composer hides legacy bookkeeping without erasing existing records and retains calendar day',()=>{
 const body=composerPayload({...draft,caption:'Changed caption'},'draft',previous);assert.equal(body.objective,previous.objective);assert.equal(body.brief,previous.brief);assert.equal(body.completionEvidence,previous.completionEvidence);assert.equal(body.title,previous.title);assert.equal(body.status,'draft');assert.equal(body.id,previous.id);assert.equal(body.version,4);
 const fresh=composerPayload({...draft,dueDate:'2026-12-02',plannedAt:''},'draft',null);assert.equal(fresh.dueDate,'2026-12-02');assert.equal(fresh.plannedAt,'');assert.equal(fresh.title,draft.caption);assert.equal(fresh.assetReference,image);
});
test('day-only placement never fabricates an hour or approves an unuploaded Creative Lab reference',()=>{
 for(const changed of [{plannedAt:''},{plannedAt:'invalid'},{plannedAt:new Date(Date.now()-1000).toISOString()},{assetReference:'creative-lab:local-only'},{caption:''}])assert.throws(()=>composerPayload({...draft,...changed},'approved',null));
});
test('Save draft does not approve or schedule; Schedule approves and queues the exact saved revision',async()=>{
 const calls:string[]=[],saved:ContentPost[]=[];let version=0;
 const ports={save:async(body:ReturnType<typeof composerPayload>)=>{calls.push('save:'+body.status);return {...previous,...body,id:previous.id,version:++version};},queue:async(p:ContentPost)=>{calls.push('queue:'+p.version);assert.equal(p.caption,draft.caption);assert.equal(p.assetReference,image);assert.equal(p.plannedAt,future);assert.equal(p.status,'approved');},saved:(p:ContentPost)=>saved.push(p)};
 await saveComposer(draft,null,false,ports);assert.deepEqual(calls,['save:draft']);calls.length=0;
 await saveComposer(draft,saved[0],true,ports);assert.deepEqual(calls,['save:draft','save:approved','queue:3']);
});
test('save/approval failures never enqueue; unconfirmed enqueue never returns success',async()=>{
 for(const fail of ['draft','approved','queue']){let queue=0;await assert.rejects(saveComposer(draft,null,true,{save:async body=>{if(body.status===fail)throw Error('synthetic failure');return {...previous,...body,version:5};},queue:async()=>{queue++;throw Error('synthetic queue unavailable');},saved:()=>{}}));assert.equal(queue,fail==='queue'?1:0);}
});
test('calendar labels never imply scheduling just because a time or approval exists',()=>{
 assert.equal(composerLabel(previous,true),'Draft');assert.equal(composerLabel({...previous,delivery:{status:'Scheduled',state:'queued',permalink:null,errorCode:null}},false),'Paused');assert.equal(composerLabel({...previous,delivery:{status:'Scheduled',state:'queued',permalink:null,errorCode:null}},true),'Scheduled');
});

test('Publish now uses explicit today action; future days never acquire an invented publication hour',()=>{
 const now=new Date(2026,9,19,17,0).getTime(),today=localDateKey(new Date(now));
 assert.equal(publishNowPlacement({...draft,plannedAt:'',dueDate:today},now).plannedAt,new Date(now+30000).toISOString());
 assert.throws(()=>publishNowPlacement({...draft,plannedAt:'',dueDate:'2027-04-12'},now));
 assert.equal(publishNowPlacement(draft,now).plannedAt,draft.plannedAt);
 const midnight=new Date(2026,9,19,23,59,30).getTime();assert.throws(()=>publishNowPlacement({...draft,plannedAt:'',dueDate:localDateKey(new Date(midnight))},midnight));
});

test('an existing today draft uses a fresh explicit Publish now placement without needing cron',()=>{
 const now=new Date(2026,9,19,17,0).getTime(),oldTime=new Date(2026,9,19,16,0).toISOString();
 const placed=publishNowPlacement({...draft,plannedAt:oldTime,dueDate:'2027-01-01'},now);assert.equal(placed.plannedAt,new Date(now+30000).toISOString());
});
