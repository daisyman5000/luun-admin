import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {PGlite}=await import(process.env.LUUN_TEST_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const nullRole='55555555-5555-4555-8555-555555555555';
const owner='11111111-1111-4111-8111-111111111111',logistics='22222222-2222-4222-8222-222222222222',viewer='33333333-3333-4333-8333-333333333333',unknown='44444444-4444-4444-8444-444444444444';
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated;create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,role text check(role in ('owner','admin','logistics','viewer')));
grant select on public.profiles to authenticated;
insert into auth.users values('${owner}'),('${logistics}'),('${viewer}'),('${unknown}'),('${nullRole}');
insert into public.profiles values('${owner}','owner'),('${logistics}','logistics'),('${viewer}','viewer'),('${nullRole}',null);
alter table public.profiles enable row level security;
create policy own_profile_read on public.profiles for select to authenticated using(id=auth.uid());`);
await db.exec(await fs.readFile(new URL('../supabase/migrations/20261016160756_operator_workspace.sql',import.meta.url),'utf8'));
test.after(()=>db.close());
async function user(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
const draft={title:'SQL TEST ONLY',objective:'Review fixture',brief:'Synthetic fixture',caption:'Test caption',channel:'Instagram',assetReference:'https://example.invalid/private-test-media.png',dueDate:'2026-11-01',plannedAt:'',status:'draft',completionEvidence:''};
const plan={objective:'SQL TEST goal',targetDate:'2026-11-01',promotionFocus:'Confirmed test stock',customerPromise:'Do not infer delivery dates',constraints:'No external actions',commitments:[]};
const fields=Object.keys(draft);const clean=p=>Object.fromEntries(fields.map(k=>[k,p[k]]));
async function savePost(post,status=post.status,changes={}){const body={...clean(post),status,...changes};const r=await db.query('select public.save_operator_content_post($1::uuid,$2::integer,$3::jsonb,$4::integer) as package',[post.id||null,post.version||0,JSON.stringify(body),post.planVersion??0]);return r.rows[0].package;}
async function savePlan(version,changes={}){const r=await db.query('select public.save_operator_business_plan($1,$2::jsonb) as package',[version,JSON.stringify({...plan,...changes})]);return r.rows[0].package;}
let created;
test('anonymous has no read or RPC access; viewer has read-only access',async()=>{
 await db.exec('set role anon');await assert.rejects(db.query('select * from public.operator_business_plan'),/permission denied/);await assert.rejects(savePlan(0),/permission denied/);
 await user(viewer);assert.equal((await db.query('select * from public.operator_business_plan')).rows.length,1);
 await assert.rejects(savePlan(0),/Owner\/admin/);await assert.rejects(savePost(draft),/write access/);
 await assert.rejects(db.exec("update public.operator_business_plan set version=999 where id=1"),/permission denied/);
});
test('logistics can save drafts; forged approval is ignored and direct writes are denied',async()=>{
 await user(logistics);const forged=await db.query('select public.save_operator_content_post(null,0,$1::jsonb,0) as package',[JSON.stringify({...draft,approvedAt:'2026-10-01T00:00:00Z',approvedBy:owner})]);created=forged.rows[0].package;assert.equal(created.version,1);assert.equal(created.approvedAt,null);assert.equal(created.planVersion,0);
 await assert.rejects(savePost(created,'approved'),/Owner\/admin/);
 await assert.rejects(db.exec('delete from public.operator_content_posts'),/permission denied/);
});
test('owner plan changes are versioned, audited, and require completion evidence',async()=>{
 await user(owner);const saved=await savePlan(0);assert.equal(saved.version,1);
 await assert.rejects(savePlan(0),/version conflict/);
 await assert.rejects(savePlan(1,{commitments:[{id:'x',title:'Test',dueDate:'2026-11-01',status:'done',evidence:''}]}),/evidence required/);
 assert.equal((await db.query("select * from public.operator_workspace_events where entity='plan'")).rows.length,1);
});
test('approval, planning, publication evidence and published-record locks are enforced in SQL',async()=>{
 await user(owner);created=await savePost({...created,planVersion:1},'needs_review');created=await savePost(created,'approved');assert.ok(created.approvedAt);assert.equal(created.approvedBy,owner);
 await assert.rejects(savePost(created,'planned'),/Planned time required/);
 created=await savePost(created,'planned',{plannedAt:'2026-11-01T12:00:00Z'});
 await assert.rejects(savePost(created,'published'),/evidence URL required/);
 await assert.rejects(savePost(created,'published',{completionEvidence:'https://instagram.com.evil.invalid/p/test/'}),/evidence URL required/);
 created=await savePost(created,'published',{completionEvidence:'https://www.instagram.com/p/sql-test-only/'});
 assert.equal(created.status,'published');await assert.rejects(savePost(created,'published',{caption:'Changed'}),/locked/);
});
test('shared plan changes invalidate existing approval and local assets cannot be approved in database',async()=>{
 await user(owner);let post=await savePost({...draft,planVersion:1},'approved');await savePlan(1,{objective:'Changed test goal'});
 await assert.rejects(savePost({...post,planVersion:2},'planned',{plannedAt:'2026-11-01T12:00:00Z'}),/Shared plan changed/);
 post=await savePost({...post,planVersion:2},'needs_review');assert.equal(post.approvedAt,null);post=await savePost(post,'approved');assert.equal(post.planVersion,2);
 await assert.rejects(savePost({...draft,planVersion:2,assetReference:'creative-lab:asset-private'},'approved'),/Local media/);
 await user(logistics);await assert.rejects(savePost(post,'draft'),/Owner\/admin/);
});
test('unprofiled users see no rows; audit history is owner/admin-only',async()=>{
 await user(unknown);assert.equal((await db.query('select * from public.operator_business_plan')).rows.length,0);assert.equal((await db.query('select * from public.operator_content_posts')).rows.length,0);await assert.rejects(savePost({...draft,planVersion:2}),/write access/);
 await user(viewer);assert.equal((await db.query('select * from public.operator_workspace_events')).rows.length,0);
 await user(owner);assert.ok((await db.query('select * from public.operator_workspace_events')).rows.length>0);
});

test('verified nullable profile role is denied; exposed RPCs are invokers with private guarded implementations',async()=>{
 await user(nullRole);assert.equal((await db.query('select * from public.operator_business_plan')).rows.length,0);await assert.rejects(savePlan(2),/Owner\/admin/);
 await db.exec('reset role');const functions=(await db.query("select n.nspname,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('save_operator_business_plan','save_operator_content_post')")).rows;
 assert.equal(functions.length,4);for(const f of functions){assert.equal(f.prosecdef,f.nspname==='operator_private');assert.ok(f.proconfig.some(item=>item.startsWith('search_path=')));}
 await db.exec('set role anon');await assert.rejects(db.query('select operator_private.save_operator_business_plan(2, $1::jsonb)',[JSON.stringify(plan)]),/permission denied/);
});
test('existing JSON plan RPC persists work area/decision references and evidenced completion without new schema',async()=>{await user(owner);const current=(await db.query('select version from public.operator_business_plan where id=1')).rows[0].version;const commitment={id:'synthetic-loop',title:'SYNTHETIC customer review',dueDate:'2026-11-01',status:'open',evidence:'',area:'customers',kind:'decision',sourceId:'synthetic_ticket'};const saved=await savePlan(current,{commitments:[commitment]});assert.equal(saved.commitments[0].area,'customers');assert.equal(saved.commitments[0].kind,'decision');assert.equal(saved.commitments[0].sourceId,'synthetic_ticket');await assert.rejects(savePlan(saved.version,{commitments:[{...commitment,status:'done'}]}),/evidence required/);const done=await savePlan(saved.version,{commitments:[{...commitment,status:'done',evidence:'Synthetic reviewed decision'}]});assert.equal(done.commitments[0].evidence,'Synthetic reviewed decision');});
