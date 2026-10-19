/* eslint-disable @typescript-eslint/no-require-imports -- Local in-memory SQL harness only. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('../.local-content/operator-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js');
test('draft controls SQL enforces roles, exact account, defaults, versioning and atomic audit locally',async()=>{
 const db=new PGlite();const owner='11111111-1111-4111-8111-111111111111',viewer='22222222-2222-4222-8222-222222222222',account='17841472352520052';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table public.profiles(id uuid primary key references auth.users(id),role text);insert into auth.users values('${owner}'),('${viewer}');insert into public.profiles values('${owner}','owner'),('${viewer}','viewer');grant select on public.profiles to service_role;`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../docs/instagram-operating-controls.sql'),'utf8'));
 const initial=(await db.query('select * from public.instagram_operating_settings')).rows[0];assert.equal(initial.version,0);for(const k of ['publishing','receive','send'])assert.equal(initial[k],false);
 const rls=await db.query("select relrowsecurity from pg_class where relname in ('instagram_operating_settings','instagram_operating_audit')");assert.equal(rls.rows.length,2);assert.ok(rls.rows.every(r=>r.relrowsecurity));
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);for(const table of ['instagram_operating_settings','instagram_operating_audit'])await assert.rejects(db.query('select * from public.'+table));await assert.rejects(db.query('select public.set_instagram_operating_control($1,$2,$3,$4,$5)',[owner,account,'send',true,0]));await assert.rejects(db.query('select public.observe_instagram_operation($1,$2)',[account,'worker']));await db.exec('reset role');}
 await db.exec('set role service_role');
 const set=(actor,acct,capability,enabled,version)=>db.query('select public.set_instagram_operating_control($1,$2,$3,$4,$5) as settings',[actor,acct,capability,enabled,version]);
 for(const args of [[viewer,account,'send',true,0],[null,account,'send',true,0],[owner,'1784147235520052','send',true,0],[owner,account,'all',true,0],[owner,account,'send',null,0],[owner,account,'send',true,null]])await assert.rejects(set(...args));
 assert.equal((await db.query('select count(*)::int as n from public.instagram_operating_audit')).rows[0].n,0);
 const saved=(await set(owner,account,'send',true,0)).rows[0].settings;assert.equal(saved.version,1);assert.equal(saved.send,true);assert.equal(saved.receive,false);assert.equal(saved.publishing,false);
 await assert.rejects(set(owner,account,'receive',true,0));
 const audit=(await db.query('select * from public.instagram_operating_audit')).rows;assert.equal(audit.length,1);assert.equal(audit[0].actor,owner);assert.deepEqual(audit[0].before_settings,{publishing:false,receive:false,send:false});assert.deepEqual(audit[0].after_settings,{publishing:false,receive:false,send:true});
 await set(owner,account,'send',true,1);assert.equal((await db.query('select count(*)::int as n from public.instagram_operating_audit')).rows[0].n,1);
 await set(owner,account,'send',false,1);assert.equal((await db.query('select version,send from public.instagram_operating_settings')).rows[0].version,2);
 await db.query('select public.observe_instagram_operation($1,$2)',[account,'worker']);await db.query('select public.observe_instagram_operation($1,$2)',[account,'webhook']);
 const observed=(await db.query('select worker_seen_at,webhook_verified_at from public.instagram_operating_settings')).rows[0];assert.ok(observed.worker_seen_at&&observed.webhook_verified_at);
 await assert.rejects(db.query('select public.observe_instagram_operation($1,$2)',[account,'arbitrary']));
 await db.exec('reset role');
 await db.exec("create function public.reject_control_audit() returns trigger language plpgsql as $$begin raise exception 'Synthetic audit failure';end$$;create trigger reject_control_audit before insert on public.instagram_operating_audit for each row execute function public.reject_control_audit();set role service_role;");
 await assert.rejects(set(owner,account,'publishing',true,2));const rolledBack=(await db.query('select publishing,version from public.instagram_operating_settings')).rows[0];assert.equal(rolledBack.publishing,false);assert.equal(rolledBack.version,2);
 }finally{await db.close();}
});
