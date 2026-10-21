import 'server-only';
import {getUserContext} from './auth';
import {createAdminClient} from './supabase/admin';
import {createHostedVideoStore} from './content-video-hosted';
import {hostedHandoffDigest,hostedRenderPlan,transitionHosted,requireHostedApprovals,hostedBoardHash,videoDigest,type HostedProject} from './content-video-hosted-flow';
import {videoAudioType} from './content-video';
const privateRedirect=(url:string)=>new Response(null,{status:307,headers:{'Cache-Control':'private, no-store','Location':url}});
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
async function access(request:Request){const url=new URL(request.url),origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');if(site==='cross-site'||(origin&&origin!==url.origin)||(request.method==='POST'&&origin!==url.origin))throw Error('Same-origin Video access required');const {user,profile}=await getUserContext();if(!user||!['owner','admin'].includes(profile?.role||''))throw Error('Owner/admin access required');return createHostedVideoStore(createAdminClient(),{id:user.id,role:profile?.role});}
function error(e:unknown){const message=e instanceof Error?e.message:'Video unavailable';console.error('content_video_request_failed',{reason:message.slice(0,120)});return Response.json({error:message},{status:/access required/.test(message)?403:400,headers});}
async function body(request:Request){if(!request.body)throw Error('Empty video request');const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>32000){await reader.cancel();throw Error('Video metadata exceeds bound');}chunks.push(r.value);}return JSON.parse(Buffer.concat(chunks).toString()) as Record<string,unknown>;}
export async function hostedVideoGET(request:Request){try{const s=await access(request),q=new URL(request.url).searchParams;
 if(q.has('audio')){const p=(await s.project(q.get('audio')||'')).package as HostedProject;if(!p.voice)throw Error('No saved idea note');return privateRedirect((await s.readUrl(p.voice.file)).url);}
 if(q.has('preview')){const m=await s.media(q.get('preview')||'');if(m.project_id!==q.get('id')||!m.mime.startsWith('image/'))throw Error('Preview is not part of this video');return privateRedirect((await s.readUrl(m.id)).url);}
 if(q.has('download')){const p=(await s.project(q.get('download')||'')).package as HostedProject;requireHostedApprovals(p);if(!p.output)throw Error('Render is not ready');return privateRedirect((await s.readUrl(p.output)).url);}
 if(q.has('context')){const id=q.get('context')||'',p=(await s.project(id)).package;return Response.json({project:p,media:await s.listMedia(id)},{headers});}
 return Response.json({projects:(await s.list()).filter(p=>!p.hiddenFromList&&!p.demoLabel),hosted:true,capabilities:{providerCalls:false,browserRender:true}},{headers});
 }catch(e){return error(e);}}
export async function hostedVideoPOST(request:Request){try{const s=await access(request),b=await body(request);if(b.action==='create')return Response.json(await s.create(),{headers});const row=await s.project(String(b.id||'')),p=row.package as HostedProject;
 if(b.action==='upload-intent'){
  if(p.revision!==b.revision)throw Error('Video changed in another tab. Reload before uploading');let mime=String(b.mime||'');const kind=String(b.kind);if(['voice','narration'].includes(kind))mime=videoAudioType(mime,String(b.name||''));const metadata:Record<string,unknown>={expectedRevision:p.revision,name:String(b.name||'').slice(0,200)};
  if(kind==='source'){if(b.owned!==true)throw Error('Choose existing owned media');metadata.owned=true;metadata.seconds=Number(b.seconds)||0;if(mime.startsWith('video/')&&(!Number.isFinite(metadata.seconds)||Number(metadata.seconds)<=0||Number(metadata.seconds)>600))throw Error('Source video must be at most ten minutes');}
  if(kind==='preview'){const source=await s.media(String(b.sourceId||''));if(source.project_id!==p.id||source.kind!=='source'||source.state!=='ready'||!source.mime.startsWith('video/'))throw Error('Preview needs its existing video source');metadata.sourceId=source.id;metadata.offset=Number(b.offset);if(!Number.isFinite(metadata.offset)||Number(metadata.offset)<0||Number(metadata.offset)>Number(source.metadata.seconds))throw Error('Invalid source frame');}
  if(kind==='voice'||kind==='narration'){const seconds=Number(b.seconds);if(!Number.isFinite(seconds)||seconds<=0||seconds>(kind==='voice'?120:p.targetSeconds)+.05)throw Error('Audio exceeds its allowed duration');metadata.seconds=seconds;if(kind==='narration'){if(!p.scriptApproval||p.scriptApproval!==videoDigest(p.script)||b.confirmed!==true)throw Error('Approve the script and confirm final narration first');metadata.scriptHash=p.scriptApproval;}}
  if(kind==='export'){requireHostedApprovals(p);if(b.approval!==p.boardApproval||typeof b.renderKey!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(b.renderKey))throw Error('Render must match the approved edit');metadata.approval=p.boardApproval;metadata.renderKey=b.renderKey;}
  return Response.json({...await s.intent(p.id,{...b,mime},metadata),mime},{headers});
 }
 if(b.action==='upload-complete'){
  const m=await s.media(String(b.mediaId||''));if(m.project_id!==p.id)throw Error('Media belongs to another project');if(m.kind==='voice'&&p.voice?.file===m.id||m.kind==='narration'&&p.finalNarration?.id===m.id||m.kind==='export'&&p.output===m.id||m.kind==='source'&&p.sources?.includes(m.id))return Response.json(p,{headers});if(m.metadata.expectedRevision!==p.revision)throw Error('Video changed during upload. Reload before attaching media');await s.complete(m.id);
  if(m.kind==='voice'){p.voice={file:m.id,hash:m.sha256,type:m.mime};p.idea='';p.script='';p.scriptApproval=null;p.boardApproval=null;p.shots=[];p.roughCaptions=[];p.finalNarration=undefined;p.output=null;p.stage='awaiting-script';}
  if(m.kind==='narration'){if(m.metadata.scriptHash!==p.scriptApproval)throw Error('Script changed during narration upload');p.finalNarration={id:m.id,hash:m.sha256,scriptHash:String(m.metadata.scriptHash)};p.boardApproval=null;p.output=null;p.stage='storyboard';}
  if(m.kind==='source')p.sources=[...new Set([...(p.sources||[]),m.id])];
  if(m.kind==='export'){requireHostedApprovals(p);if(m.metadata.approval!==p.boardApproval||p.boardApproval!==hostedBoardHash(p))throw Error('Approved edit changed during render');p.output=m.id;p.stage='complete';p.requests||={};p.requests[String(m.metadata.renderKey)]={output:m.id};}
  return Response.json(m.kind==='preview'?p:await s.save(p.id,p.revision,p),{headers});
 }
 if(b.action==='render'){requireHostedApprovals(p);if(p.revision!==b.revision&&!p.requests?.[String(b.key)])throw Error('Video changed before rendering. Reload before continuing.');if(p.requests?.[String(b.key)]?.output===p.output&&p.output)return Response.json(p,{headers});return Response.json({...p,browserRender:await hostedRenderPlan(s,p)},{headers});}
 if(b.action==='handoff'&&p.handoffs?.[String(b.key)]){if(p.handoffs[String(b.key)]!==hostedHandoffDigest(b))throw Error('Handoff key already used for different content');return Response.json(p,{headers});}
 const updated=transitionHosted(structuredClone(p),b,await s.listMedia(p.id));return Response.json(await s.save(p.id,p.revision,updated),{headers});
 }catch(e){return error(e);}}
