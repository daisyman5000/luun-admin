'use client';

import {useEffect,useState} from 'react';
import {ContentAdReferences} from './content-ad-references';
import {videoJSON} from '../lib/content-video-hosted-client';
import type {CreatorState} from '../lib/content-video-creator';
import type {VideoProject} from '../lib/content-video';

type ReferenceProject=CreatorState&VideoProject;

export function ContentReferenceAdsPage(){
 const [project,setProject]=useState<ReferenceProject|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;
  fetch('/api/content/video',{cache:'no-store'}).then(async response=>{
   const data=await response.json();if(!response.ok)throw Error(data.error||'Reference ads could not load');
   const collections=(data.projects as ReferenceProject[]).filter(p=>p.sourceBank);
   const selected=collections.find(p=>p.adReferences?.ads.length)||collections[0];
   if(live)setProject(selected||null);
  }).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[]);
 async function save(body:Record<string,unknown>){
  if(!project)throw Error('Saved source notes are unavailable');
  try{
   const result=await videoJSON({id:project.id,revision:project.revision,...body});
   if(body.action==='start-script-video'){
    localStorage.setItem('luun-content-video',result.id);
    window.location.assign('/content?view=video');
   }else setProject(result);
   return result;
  }catch(e){
   const response=await fetch('/api/content/video?context='+encodeURIComponent(project.id),{cache:'no-store'});
   if(response.ok){const data=await response.json();setProject(data.project);}
   throw e;
  }
 }
 return <main className="mx-auto max-w-4xl px-5 py-8 sm:p-10">
  <h1 className="mb-5 text-3xl font-semibold">Reference ads</h1>
  {loading&&<p role="status" className="text-sm text-slate-600">Loading reference ads…</p>}
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {project&&<ContentAdReferences key={project.id} standalone project={project} busy={false} onSave={save} onProject={value=>setProject(value as ReferenceProject)}/>}
  {!loading&&!error&&!project&&<p className="text-sm text-slate-600">Save source notes in the Video tab to start your reference library.</p>}
 </main>;
}
