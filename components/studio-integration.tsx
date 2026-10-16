"use client";
import { useEffect,useState } from 'react';
import CreativeStudio from './creative-studio.jsx';
import './creative-studio.css';
export function StudioIntegration(){
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;fetch('/api/studio/status',{cache:'no-store'}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error);if(active)setReady(body.available===true);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 if(loading)return <p className="p-8 text-sm text-slate-500">Checking the existing image Studio connection…</p>;
 if(!ready)return <section className="m-5 rounded-2xl border border-line bg-white p-6 sm:m-10"><h1 className="text-2xl font-semibold">Image Studio</h1><p role="status" className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{error||'Studio is unavailable.'}</p><p className="mt-3 text-xs text-slate-500">No files were moved, no provider credentials were copied, and no generation was started. Saved animation/video work remains in the original app but is not part of this interface.</p></section>;
 return <div className="creative-studio"><CreativeStudio/></div>;
}
