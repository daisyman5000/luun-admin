/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'founder-prompt-'));
execFileSync(process.execPath,[root+'/node_modules/typescript/bin/tsc','lib/content-video-creator-providers.ts','--strict','--module','commonjs','--target','es2020','--esModuleInterop','--skipLibCheck','--outDir',out],{cwd:root});
const prompt=require(out+'/content-video-script'),{OWNER_SCRIPT_PROMPT}=require(out+'/content-video-script-prompt'),artifact=require(out+'/content-video-script-artifact');
const response=body=>artifact.captureScriptArtifact({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(body)}]}]},prompt.SUPPORTED_SCRIPT_MODEL);
test('source requests use the replacement prompt and core/script/question schema without three-idea output',()=>{
 const input={founderScript:true,idea:'SOURCE NOTE 03: We improve one sofa.',targetSeconds:60,scriptOnly:true},r=prompt.openAIScriptRequest(input,prompt.SUPPORTED_SCRIPT_MODEL);
 assert.ok(r.instructions.startsWith(OWNER_SCRIPT_PROMPT));assert.match(r.instructions,/Others do X\. We do Y\./);assert.match(r.instructions,/written in first person, for the ear/);assert.match(r.instructions,/If the transcript lacks a concrete detail/);assert.match(r.instructions,/\[PASTE 3 OF YOUR BEST SCRIPTS HERE\]/);assert.match(r.instructions,/do not invent examples/);
 assert.deepEqual(r.text.format.schema.required,['coreIdea','script','clarificationQuestion']);assert.equal(r.text.format.schema.properties.ideaOptions,undefined);assert.equal(r.store,false);assert.match(r.input,/SOURCE NOTE 03/);
});
test('founder result retains a short core idea separately from finished spoken script',()=>{
 const script=Array(140).fill('dialogue').join(' '),value=artifact.validateScriptArtifact(response({coreIdea:'Others add products. We improve ours.',script,clarificationQuestion:''}),60,true,true);
 assert.equal(value.coreIdea,'Others add products. We improve ours.');assert.equal(value.script,script);assert.deepEqual(value.ideaOptions,[]);assert.equal(value.clarificationQuestion,'');
 assert.throws(()=>artifact.validateScriptArtifact(response({coreIdea:Array(12).fill('word').join(' '),script,clarificationQuestion:''}),60,true,true),/fewer than 12 words/);
});
test('missing detail returns a question and cannot be turned into an invented script',()=>{
 const value=artifact.validateScriptArtifact(response({coreIdea:'Others add products. We improve ours.',script:'',clarificationQuestion:'Which change improved the sofa?'}),60,true,true);
 assert.equal(value.script,'');assert.equal(value.clarificationQuestion,'Which change improved the sofa?');
 assert.throws(()=>artifact.validateScriptArtifact(response({coreIdea:value.coreIdea,script:'Invented proof.',clarificationQuestion:value.clarificationQuestion}),60,true,true),/before writing a script/);
});
