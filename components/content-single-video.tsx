'use client';
import {useRef,useState} from 'react';
import type {VideoProject} from '../lib/content-video';
import {makeSingleVideo,uploadOwnedVideoMedia} from '../lib/content-video-hosted-client';
const button='rounded-lg border border-line px-4 py-3 text-sm disabled:opacity-40';
export function ContentSingleVideo({project,busy,run,onProgress}:{project:VideoProject&{sources?:string[];performance?:{audioId:string};renderApproval?:string};busy:boolean;run:(fn:()=>Promise<VideoProject>)=>Promise<unknown>;onProgress:(p:VideoProject)=>void}){
 const upload=useRef<HTMLInputElement>(null),[status,setStatus]=useState('');
 return <section aria-label="AI video" className="mt-6 rounded-2xl border border-line bg-white p-6">
  <h2 className="text-lg font-semibold">Make video</h2>
  <p className="mt-2 text-sm text-slate-600">AI voice · your Luun footage · captions · vertical MP4. Private draft only.</p>
  <button className={button+' mt-4 mr-3'} disabled={busy||!!project.output||!!project.renderApproval} onClick={()=>upload.current?.click()}>Add Luun footage</button>
  <input ref={upload} hidden type="file" accept="video/mp4,video/webm,image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void run(()=>uploadOwnedVideoMedia(file,project));}}/>
  <button className={button+' mt-4 bg-slate-950 text-white'} disabled={busy||!!project.output||!project.sources?.length} onClick={()=>void run(()=>makeSingleVideo(project,onProgress,setStatus))}>{project.renderApproval?'Finish MP4':'Make video'}</button>
  <p className="mt-3 text-sm">{project.sources?.length||0} footage files saved{project.performance?.audioId?' · AI narration saved':''}.</p>
  {status&&<p role="status" className="mt-3 text-sm">{status}</p>}
  <p className="mt-3 text-xs text-slate-500">One test video · US$1 total maximum · no renewal. Reuses saved narration and edits after reload. Failed or uncertain calls retain their reservations.</p>
 </section>;
}
