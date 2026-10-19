/* eslint-disable @typescript-eslint/no-require-imports -- Local in-memory PostgreSQL lease semantics only. */
const test=require('node:test'),assert=require('node:assert/strict');const {PGlite}=require('../.local-content/operator-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js');
test('specific foreground lease CAS has one winner, preserves unrelated jobs and rejects stale state',async()=>{
 const db=new PGlite();try{await db.exec("create table jobs(id text primary key,account_id text,post_id text,post_version int,state text,attempts int,lease_id text,lease_until timestamptz);insert into jobs values('target','approved','post',3,'queued',0,null,null),('unrelated','approved','other-post',3,'queued',0,null,null);");
 const claim=(lease,attempt=0,state='queued')=>db.query("update jobs set lease_id=$1,lease_until=now()+interval '4 minutes',attempts=attempts+1 where id='target' and account_id='approved' and post_id='post' and post_version=3 and state=$3 and attempts=$2 and (lease_until is null or lease_until<now()) returning id,lease_id",[lease,attempt,state]);
 const results=await Promise.all([claim('caller-one'),claim('caller-two')]);assert.equal(results.reduce((n,r)=>n+r.rows.length,0),1);const winner=results.flatMap(r=>r.rows)[0].lease_id;
 assert.equal((await db.query("select lease_id from jobs where id='unrelated'")).rows[0].lease_id,null);assert.equal((await claim('caller-three',1)).rows.length,0);
 assert.equal((await db.query("update jobs set lease_id=null,lease_until=null where id='target' and lease_id='wrong-owner' returning id")).rows.length,0);
 assert.equal((await db.query("update jobs set lease_id=null,lease_until=null where id='target' and lease_id=$1 returning id",[winner])).rows.length,1);
 await db.exec("update jobs set state='creating' where id='target'");assert.equal((await claim('stale-caller',1,'queued')).rows.length,0);assert.equal((await claim('explicit-continuation',1,'creating')).rows.length,1);
 }finally{await db.close();}
});
