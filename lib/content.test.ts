import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createContentStore } from './content-store';
import { emptyPost, validatePost } from './content';
import { localContentEnabled } from './local-content';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'luun-content-test-'));
test.after(() => fs.rmSync(directory, {recursive:true, force:true}));
const store = createContentStore(directory);
const draft = {...emptyPost, title:'Test package', objective:'Explain the modular configuration', caption:'Choose a configuration.', assetReference:'Creative Lab: test-asset-reference'};
test('draft survives reopening store; update increments version; stale tab cannot overwrite', () => {
 const post = store.save(draft);
 const reopened = createContentStore(directory).list().find(p => p.id === post.id)!;
 assert.equal(reopened.title, draft.title);
 const updated = store.save({...reopened, brief:'A real updated brief'});
 assert.equal(updated.version,2);
 assert.throws(() => store.save({...reopened, caption:'Stale write'}), /another tab/);
 assert.equal(store.list().find(p=>p.id===post.id)?.brief,'A real updated brief');
 assert.equal(fs.statSync(path.join(directory,'posts.json')).mode & 0o777,0o600);
});
test('review, approval, planning and manual publication require evidence', () => {
 let post = store.save({...draft,plannedAt:'2026-11-01T10:00:00.000Z',status:'needs_review'});
 assert.throws(() => store.save({...post,status:'planned',plannedAt:'2026-11-01T10:00:00Z'}), /Save approval/);
 post = store.save({...post,status:'approved'});
 assert.ok(post.approvedAt);
 assert.throws(() => validatePost({...draft,status:'planned',plannedAt:''},{...post,plannedAt:''}), /planned publication time/);
 post = store.save({...post,status:'planned',plannedAt:'2026-11-01T10:00:00Z'});
 assert.throws(() => store.save({...post,status:'published'}), /live Instagram/);
 post = store.save({...post,status:'published',completionEvidence:'https://www.instagram.com/p/manual-evidence/'});
 assert.equal(post.status,'published');
 assert.throws(() => store.save({...post,caption:'Revised after publication'}), /Content changed|locked/);
});
test('editorial changes invalidate approval; empty or invalid packages never become approved', () => {
 const approved=store.save({...draft,status:'approved'});
 assert.throws(()=>store.save({...approved,caption:'Edited',status:'planned',plannedAt:'2026-11-01T10:00:00Z'}),/Content changed/);
 const review=store.save({...approved,caption:'Edited',status:'needs_review'});
 assert.equal(review.approvedAt,null);
 assert.throws(()=>validatePost({...draft,status:'approved',assetReference:''}),/asset reference/);
 assert.throws(()=>validatePost({...draft,title:''}),/title/);
 assert.throws(()=>validatePost({...draft,dueDate:'2026-02-30'}),/valid due date/);
 assert.throws(()=>validatePost({...draft,status:'automatically_scheduled'}),/Invalid review/);
});
test('corrupt store is never overwritten; concurrent writer lock is respected', () => {
 const other=fs.mkdtempSync(path.join(directory,'corrupt-'));
 fs.writeFileSync(path.join(other,'posts.json'),'{invalid');
 assert.throws(()=>createContentStore(other).save(draft));
 assert.equal(fs.readFileSync(path.join(other,'posts.json'),'utf8'),'{invalid');
 fs.writeFileSync(path.join(directory,'posts.json.lock'),'');
 assert.throws(()=>store.save(draft),/Another save/);
 fs.unlinkSync(path.join(directory,'posts.json.lock'));
});
test('local persistence cannot be enabled on public or production hosts', () => {
 const old = {...process.env};
 process.env.LUUN_LOCAL_CONTENT='1';
 // NODE_ENV is intentionally assigned only inside an isolated test process.
 Object.assign(process.env,{NODE_ENV:'development'});
 assert.equal(localContentEnabled('127.0.0.1:4326'),true);
 assert.equal(localContentEnabled('luun-admin-et42.vercel.app'),false);
 Object.assign(process.env,{NODE_ENV:'production'});
 assert.equal(localContentEnabled('127.0.0.1:4326'),false);
 process.env=old;
});
test('local media blocks cross-site embedding and public hosts without changing existing auth',async()=>{
 const {localMediaRequestAllowed}=await import('./local-content');const old={...process.env};Object.assign(process.env,{NODE_ENV:'development',LUUN_LOCAL_CONTENT:'1'});
 assert.equal(localMediaRequestAllowed(new Request('http://127.0.0.1:4326/api/content/assets',{headers:{host:'127.0.0.1:4326','sec-fetch-site':'same-origin'}})),true);
 assert.equal(localMediaRequestAllowed(new Request('http://127.0.0.1:4326/api/content/assets',{headers:{host:'127.0.0.1:4326','sec-fetch-site':'cross-site'}})),false);
 assert.equal(localMediaRequestAllowed(new Request('http://127.0.0.1:4326/api/content/assets',{headers:{host:'127.0.0.1:4326',origin:'https://attacker.invalid'}})),false);
 Object.assign(process.env,{NODE_ENV:'production'});assert.equal(localMediaRequestAllowed(new Request('http://127.0.0.1:4326/api/content/assets',{headers:{host:'127.0.0.1:4326'}})),false);process.env=old;
});
