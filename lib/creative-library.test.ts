import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCreativeLibrary } from './creative-library';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'luun-creative-link-'));
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));
const media=path.join(root,'media');fs.mkdirSync(media);
const file='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png';fs.writeFileSync(path.join(media,file),'private test media');
const libraryFile=path.join(root,'library.json');
function fixture(){return {assets:[{id:'kept',file,status:'kept',scene:'Actual kept source',roomReference:{license:'Rights not cleared'}},{id:'pending',file,status:'pending'},{id:'rejected',file,status:'rejected'},{id:'missing',file:'bbbbbbbb.png',status:'kept'}],animations:[{id:'sample',file,status:'complete',sample:true,video:file}]};}
test('catalog lists only available kept media; examples and rejected assets are excluded',()=>{
 fs.writeFileSync(libraryFile,JSON.stringify(fixture()));const before=fs.readFileSync(libraryFile);const library=createCreativeLibrary(root);
 const assets=library.list();assert.equal(assets.length,1);assert.equal(assets[0].reference,'creative-lab:asset-kept');assert.match(assets[0].rightsStatus,/not publication approval/);
 assert.equal(library.resolve(assets[0].reference).file,fs.realpathSync(path.join(media,file)));assert.deepEqual(fs.readFileSync(libraryFile),before);
 assert.throws(()=>library.resolve('creative-lab:asset-pending'),/no longer kept/);
});
test('link is revoked when source is rejected; traversal and escaping symlinks cannot be streamed',()=>{
 const data=fixture();data.assets[0].status='rejected';fs.writeFileSync(libraryFile,JSON.stringify(data));assert.throws(()=>createCreativeLibrary(root).resolve('asset-kept'),/no longer kept/);
 const outside=path.join(root,'outside.png');fs.writeFileSync(outside,'not media');const symlink='cccccccc-cccc-cccc-cccc-cccccccccccc.png';fs.symlinkSync(outside,path.join(media,symlink));
 fs.writeFileSync(libraryFile,JSON.stringify({assets:[{id:'escape',file:'../outside.png',status:'kept'},{id:'symlink',file:symlink,status:'kept'}]}));assert.deepEqual(createCreativeLibrary(root).list(),[]);
});
