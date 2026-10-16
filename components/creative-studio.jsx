/* eslint-disable @typescript-eslint/no-unused-vars, @next/next/no-img-element -- Adapted existing JS image interface; original library remains the source of truth. */
/* Existing Creative Lab image interface, adapted only for scoped routes and image-only embedding. Original app/data remain untouched. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { Images, Library, SlidersHorizontal, Plus, Check, X, Download, ArrowUpRight, ArrowLeft, ArrowRight, LoaderCircle, ImagePlus, Trash2, RotateCcw, CircleAlert, Maximize2, SquarePen } from 'lucide-react';

const url = file => `/api/studio/media/${file}`;
async function api(path, method = 'GET', body) {
  const res = await fetch(`/api/studio/${path}`, { method, ...(body instanceof FormData ? { body } : body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Something went wrong.'); return data;
}
function IconButton({ title, children, ...props }) { return <button className="icon-button" title={title} aria-label={title} {...props}>{children}</button>; }
export default function Studio() {
  const [data, setData] = useState(null), [view, setView] = useState('studio'), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const brief = 'Create a realistic photograph of the sofa in Image 2 inside the room in Image 1. Make the couch the main subject and visual focus of the photograph. Preserve the sofa’s design, proportions, configuration, fabric, and colour. Replace the room’s existing sofa and match the room’s perspective, lighting, and shadows. Make it look naturally photographed there, not pasted in.';
  const [filter, setFilter] = useState('kept'), [photosOpen,setPhotosOpen]=useState(false);
  const [settings, setSettings] = useState(false), [draft, setDraft] = useState({}), [key, setKey] = useState(''), [preview, setPreview] = useState(null);
  const upload = useRef(null), uploadRole = useRef('product'), mounted = useRef(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const [refining, setRefining] = useState(null), [editBrief, setEditBrief] = useState('');
  const [roomLoading,setRoomLoading]=useState(false);
  async function refresh() { const next = await api('state'); if (mounted.current) setData(next); }
  useEffect(() => { mounted.current = true; refresh().catch(e => setError(e.message)); const timer = setInterval(() => refresh().catch(() => {}), 2500); return () => { mounted.current = false; clearInterval(timer); }; }, []);
  useEffect(() => { const close = e => { if (e.key === 'Escape') { setPreview(null); setSettings(false); setRefining(null); setPhotosOpen(false); } }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  useEffect(() => { setShowOriginal(false); }, [preview?.id]);
  async function act(fn) { setBusy(true); setError(''); try { await fn(); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  function openSettings() { setDraft(data.settings); setKey(''); setSettings(true); }
  async function uploadFiles(files, role = uploadRole.current) { if (!files.length) return; const form = new FormData(); form.append('role', role); [...files].forEach(f => form.append('files', f)); await act(() => api('references', 'POST', form)); }
  const refs = data?.references || [], assets = data?.assets || [], jobs = data?.jobs || [], activeJob = jobs.find(j => j.status === 'running');
  const selected = refs.filter(r => (r.role || 'product') === 'product'), latest = jobs[0];
  const chosenSofa=selected.find(r=>r.id===data?.settings.sourceReferenceId)||selected[0];
  const benchmark = !latest?.collectionId && (latest?.variants?.[0]?.productReference || latest?.referenceInputs?.find(r => (r.role || 'product') === 'product'));
  const comparisonLabel = 'Original LUUN product';
  const chosenRoom=data?.roomBrowser?.history?.[data.roomBrowser.index] || jobs.flatMap(j=>j.variants||[]).find(v=>v.roomReference?.sourceType==='real-estate-listing')?.roomReference;
  async function changeRoom(direction,total=1) {
    setRoomLoading(true);
    const collectionId=total>1?crypto.randomUUID():undefined;
    try {await act(async()=>{
      for(let i=0;i<total;i++) {
      const room=await api('rooms','POST',{direction});
      if(direction!=='next') return;
      if(!room?.sofaMatch?.productId) throw new Error('Room found. Upload a sofa reference before generating.');
      const job=await api('generate','POST',{brief,prompt:brief,count:1,roomId:room.id,productReferenceId:room.sofaMatch.productId,...(collectionId?{collectionId,collectionCount:total}:{} )});
      if(i<total-1) {
        while(true) {
          await new Promise(resolve=>setTimeout(resolve,2500));
          const state=await api('state');
          if(mounted.current) setData(state);
          const current=state.jobs.find(j=>j.id===job.id);
          if(!current) throw new Error('Generation could not be found. Batch stopped.');
          if(current.status==='running') continue;
          if(current.status!=='complete') throw new Error(current.error||'Generation stopped. Completed images are saved.');
          break;
        }
      }
      }
    });} finally {setRoomLoading(false);}
  }
  const collectionJobs=latest?.collectionId?jobs.filter(j=>j.collectionId===latest.collectionId):latest?[latest]:[];
  const collectionJobIds=new Set(collectionJobs.map(j=>j.id));
  const shown = view === 'library' ? assets.filter(a => filter === 'all' || a.status === filter) : assets.filter(a => collectionJobIds.has(a.jobId)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const inspected = assets.find(a => a.id === preview?.id) || preview;
  const inspectedJob = jobs.find(j => j.id === inspected?.jobId);
  const inspectedSource = inspectedJob?.variants?.[inspected?.variantIndex]?.productReference || inspectedJob?.referenceInputs?.find(r => (r.role || 'product') === 'product');
  function decision(asset, status) { return act(() => api(`assets/${asset.id}`, 'PATCH', { status })); }
  if (!data) return <div className="loading"><LoaderCircle className="spin"/><p>{error || 'Opening LUUN Creative Lab...'}</p>{error && <button onClick={() => refresh().catch(e => setError(e.message))}>Try again</button>}</div>;
  return <>
    <div className="studio-connection-note">Existing Creative Lab image engine · files stay in the original library. Image creation uses its existing paid provider only when you request it.</div>
    <main>
      <div className="page-heading"><h1>{view === 'studio' ? 'Image studio' : 'Creative library'}</h1><nav className="studio-view-tabs" aria-label="Image workspace"><button aria-pressed={view==='studio'} onClick={()=>setView('studio')}><Images size={17}/>Studio</button><button aria-pressed={view==='library'} onClick={()=>setView('library')}><Library size={17}/>Saved images</button></nav></div>
      {error && <div className="notice error" role="alert"><CircleAlert size={18}/><span>{error}</span><IconButton title="Dismiss error" onClick={() => setError('')}><X size={16}/></IconButton></div>}
      {!data.connected && <div className="notice"><CircleAlert size={18}/><span>OpenAI API key needed for image generation.</span><span>Use the original Creative Lab app for provider settings; this interface never stores credentials.</span></div>}
      <div>
      {view === 'studio' ? <div className="workspace">
        <aside className="generation-panel" aria-label="New images">
          <section className="sofa-summary"><div className="section-heading"><h2>Your sofa</h2><IconButton title="Manage sofa photos" onClick={()=>setPhotosOpen(true)}><SquarePen size={17}/></IconButton></div>
            <div className="sofa-photo-strip" role="radiogroup" aria-label="Sofa reference">{selected.map(r=><button key={r.id} role="radio" aria-checked={r.id===chosenSofa?.id} aria-label={`Use ${r.name}`} title={r.name} className={`sofa-choice ${r.id===chosenSofa?.id?'chosen':''}`} disabled={busy||!!activeJob} onClick={()=>act(()=>api(`references/${r.id}`,'PATCH',{primary:true}))}><img src={url(r.file)} alt={r.name}/>{r.id===chosenSofa?.id && <span className="selection-mark"><Check size={13}/></span>}</button>)}{!selected.length && <button onClick={()=>setPhotosOpen(true)}><Plus size={20}/>Add sofa photos</button>}</div>
            <div className="sofa-photo-count">{chosenSofa ? `Selected: ${chosenSofa.name}` : 'No sofa selected'}</div>
          </section>
        </aside>
        <section className="results">
          <section className="room-picker" aria-label="Real living room"><div className="section-heading"><h2>Real living room</h2><div className="room-navigation" style={{flexDirection:'column',alignItems:'stretch'}}><button disabled={busy||!!activeJob||!selected.length} onClick={()=>changeRoom('next')}>{roomLoading?<LoaderCircle className="spin" size={17}/>:<ArrowRight size={17}/>}Next room</button><button disabled={busy||!!activeJob||!selected.length} onClick={()=>changeRoom('next',5)}><ImagePlus size={17}/>Create 5</button></div></div>
            {chosenRoom ? <figure><img src={url(chosenRoom.file)} alt={`Selected real living room: ${chosenRoom.name}`}/><figcaption><strong>{chosenRoom.name}</strong><a href={chosenRoom.sourceUrl} target="_blank" rel="noreferrer">View property listing <ArrowUpRight size={13}/></a></figcaption></figure> : <div className="room-picker-empty">No room selected</div>}
            {(roomLoading||activeJob) && <p role="status" className="generation-stage">{activeJob?.stage||'Finding the next living room...'}</p>}
          </section>
          <div className="section-heading"><h2>{latest?.collectionId ? 'Latest collection' : latest ? 'Latest result' : 'Your next collection'}</h2><span>{latest?.collectionId ? `${shown.length} of ${latest.collectionCount} images${activeJob||roomLoading?' · In progress':''}` : activeJob ? 'In progress' : latest ? `${shown.length} ${shown.length === 1 ? 'image' : 'images'}` : 'Ready when you are'}</span></div>
          {latest?.error && <div className="notice error" role="alert">{latest.error}</div>}
          {latest?.status === 'partial' && <div className="notice">{latest.completed} of {latest.count} photographs completed. All completed images are saved.</div>}
          {shown.length ? <div className="image-grid">{shown.map((a, i) => renderAsset(a, i))}{latest?.count === 1 && benchmark && <figure className="benchmark"><img src={url(benchmark.file)} alt={comparisonLabel}/><figcaption>{comparisonLabel}</figcaption></figure>}</div> : activeJob ? <div className="image-grid">{Array.from({length:activeJob.count},(_,i) => <div className="generating-tile" key={i}><LoaderCircle className="spin" size={25}/><span>Developing image {i + 1}</span></div>)}</div> : <div className="empty-studio">{selected[0] ? <img src={url(selected[0].file)} alt="Selected LUUN sofa reference"/> : <div className="empty-art"><Images size={44}/></div>}<div className="empty-caption"><div><span className="eyebrow">{selected.length ? 'YOUR LUUN / SOURCE PHOTO' : 'PRODUCT REFERENCES'}</span><h3>{selected.length ? 'Same sofa. A different home.' : 'Start with your LUUN.'}</h3></div><span className="quiet">{selected.length ? 'No generated images yet' : 'No reference photos yet'}</span></div></div>}
        </section>
      </div> : <section className="library"><div className="library-toolbar"><div className="filter-tabs">{[['kept','Kept'],['pending','To review'],['rejected','Rejected'],['all','All images']].map(([value,label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}<span>{assets.filter(a => value === 'all' || a.status === value).length}</span></button>)}</div><span className="quiet">{shown.length} images</span></div>{shown.length ? <div className="library-grid">{shown.map((a,i) => renderAsset(a,i))}</div> : <div className="empty-library"><Library size={36}/><h2>{filter === 'kept' ? 'Nothing kept yet.' : 'No images here yet.'}</h2><button onClick={() => setView('studio')}>Back to studio <ArrowUpRight size={16}/></button></div>}</section>}
      </div>
      <footer><span>LUUN CREATIVE LAB</span><span>{refs.length} references · {assets.length} images · Saved locally</span></footer>
    </main>
    <input ref={upload} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={e => { uploadFiles(e.target.files); e.target.value = ''; }}/>
    {photosOpen && <dialog open className="modal photo-manager" aria-labelledby="photos-title"><div className="modal-heading"><h2 id="photos-title">Sofa photos</h2><IconButton title="Close sofa photos" onClick={()=>setPhotosOpen(false)}><X size={20}/></IconButton></div>
      <div className="reference-grid" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!activeJob && !busy) uploadFiles(e.dataTransfer.files,'product');}}>
        {selected.map(r=><div className="reference" key={r.id}><button className={`sofa-choice ${r.id===chosenSofa?.id?'chosen':''}`} aria-label={`Select ${r.name}`} aria-pressed={r.id===chosenSofa?.id} disabled={busy||!!activeJob} onClick={()=>act(()=>api(`references/${r.id}`,'PATCH',{primary:true}))}><img className="managed-photo" src={url(r.file)} alt={r.name}/>{r.id===chosenSofa?.id && <span className="selection-mark"><Check size={13}/></span>}</button><div className="reference-tools"><span>{r.name}</span></div></div>)}
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="photo-manager-actions"><button disabled={busy||!!activeJob} onClick={()=>{uploadRole.current='product';upload.current.click();}}><Plus size={18}/>Add photos</button><button onClick={()=>setPhotosOpen(false)}><Check size={18}/>Done</button></div>
    </dialog>}
    {inspected && <dialog open className="lightbox" aria-label="Image review"><div className="lightbox-bar"><span>{showOriginal ? 'Original LUUN product' : inspected.scene}</span>{inspectedSource && <div className="segmented"><button aria-pressed={!showOriginal} className={!showOriginal ? 'active' : ''} onClick={() => setShowOriginal(false)}>Generated</button><button aria-pressed={showOriginal} className={showOriginal ? 'active' : ''} onClick={() => setShowOriginal(true)}>Original</button></div>}<IconButton title="Close image" onClick={() => setPreview(null)}><X/></IconButton></div><img src={url(showOriginal && inspectedSource ? inspectedSource.file : inspected.file)} alt={showOriginal ? 'Original LUUN product' : `LUUN in ${inspected.scene}`}/><div className="lightbox-actions"><button disabled={busy || showOriginal} className={inspected.status === 'kept' ? 'kept' : ''} onClick={() => decision(inspected, 'kept')}><Check size={18}/>Keep</button><button disabled={busy || showOriginal} className={inspected.status === 'rejected' ? 'rejected' : ''} onClick={() => decision(inspected, 'rejected')}><X size={18}/>Reject</button><a href={`${url(inspected.file)}?download`} download><Download size={19}/>Download</a></div></dialog>}
    {refining && <dialog open className="modal" aria-labelledby="refine-title"><div className="modal-heading"><h2 id="refine-title">More shots · Same room</h2><IconButton title="Close shot options" onClick={() => setRefining(null)}><X size={20}/></IconButton></div><img src={url(refining.file)} alt="Selected scene" style={{width:'100%',height:180,objectFit:'contain',marginBottom:16}}/>{[['closeup','Close-up'],['left','Left angle'],['right','Right angle'],['wide','Wider view']].map(([shot,label]) => <button key={shot} className="generate" style={{marginBottom:8}} disabled={busy || !!activeJob} onClick={() => act(async () => {await api('generate','POST',{brief:'',shot,sourceAssetId:refining.id,count:1});setRefining(null);setPreview(null);setView('studio');})}><ImagePlus size={18}/>{label}</button>)}{error && <p role="alert" className="field-error">{error}</p>}</dialog>}
    {(settings || preview || refining || photosOpen) && <div className="backdrop" onClick={() => { setSettings(false); setPreview(null); setRefining(null); setPhotosOpen(false); }}/>} 
  </>;
  function renderAsset(a, i) {
    return <article className={`asset ${a.status}`} key={a.id}>
      <button className="asset-image" onClick={() => setPreview(a)} aria-label={`Enlarge image ${i + 1}`}><img src={url(a.file)} alt={`LUUN sofa in ${a.scene}, variation ${i + 1}`}/><span className="image-number">{String(i + 1).padStart(2, '0')}</span><span className="enlarge"><Maximize2 size={17}/></span></button>
      <div className="asset-meta"><span>{a.direction || a.scene}</span><button disabled={busy || !!activeJob} onClick={() => setRefining(a)}><ImagePlus size={16}/>More shots</button><a title="Download image" aria-label="Download image" href={`${url(a.file)}?download`} download><Download size={16}/></a></div>
      {a.roomReference && <p className="asset-credit">Room reference: <a href={a.roomReference.sourceUrl} target="_blank" rel="noreferrer">{a.roomReference.name}</a> · {a.roomReference.creator} · {a.roomReference.licenseUrl ? <a href={a.roomReference.licenseUrl} target="_blank" rel="noreferrer">{a.roomReference.license.toUpperCase()}</a> : a.roomReference.license} · AI-adapted</p>}
      <div className="decisions"><button disabled={busy} className={a.status === 'kept' ? 'kept' : ''} onClick={() => decision(a, 'kept')}><Check size={17}/>{a.status === 'kept' ? 'Kept' : 'Keep'}</button><button disabled={busy} className={a.status === 'rejected' ? 'rejected' : ''} onClick={() => decision(a, 'rejected')}><X size={17}/>{a.status === 'rejected' ? 'Rejected' : 'Reject'}</button>{a.status !== 'pending' && <IconButton disabled={busy} title="Undo decision" onClick={() => decision(a, 'pending')}><RotateCcw size={15}/></IconButton>}</div>
    </article>;
  }
}
