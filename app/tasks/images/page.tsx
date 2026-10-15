"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import './images.css';
import { FORMATS } from '@/lib/images/formats';
type SavedImage = {id:string; url:string; description:string; width:number; height:number; createdAt:string; timings:Record<string,number>};
const formats = Object.entries(FORMATS).map(([id, f]) => [id, f.label, f.width, f.height] as const);
export default function ImageWorkspace() {
  const [prompt,setPrompt] = useState(''), [format,setFormat] = useState('default');
  const [width,setWidth] = useState(1200), [height,setHeight] = useState(1800);
  const [images,setImages] = useState<SavedImage[]>([]), [service,setService] = useState({available:false,busy:false,message:'Checking image service…'});
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [page,setPage] = useState(1);
  const controller = useRef<AbortController|null>(null);
  const mounted = useRef(false);
  async function refresh(signal?:AbortSignal) {
    const response = await fetch('/api/images',{cache:'no-store',signal});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load images.');
    if (mounted.current) {setImages(data.images);setService(data.service);}
  }
  useEffect(() => {mounted.current=true;const c=new AbortController();void refresh(c.signal).catch(e=>{if (!c.signal.aborted)setError(e.message);});return()=>{mounted.current=false;c.abort();controller.current?.abort();};},[]);
  async function generate(event:React.FormEvent) {
    event.preventDefault();if(busy)return;
    setBusy(true);setError('');controller.current=new AbortController();
    try {
      const response=await fetch('/api/images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,width,height}),signal:controller.current.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.error || 'Generation failed.');
      if(mounted.current){setImages(previous=>[data,...previous]);setPage(1);}
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Generation failed.');}
    finally{if(mounted.current)setBusy(false);controller.current=null;}
  }
  return <AppShell activeView="tasks" title="Image generation service." description="Give an idea a visual form.">
    <div className="image-workspace">
      <div className="image-workspace-top"><Link className="btn btn-ghost" href="/tasks">← Tasks</Link><span className="badge badge-neutral" role="status">{busy?'Creating image…':service.message}</span><button className="btn btn-secondary" disabled={busy} onClick={()=>{setError('');void refresh().catch(e=>setError(e.message));}}>Refresh</button></div>
      <section className="panel image-create-panel"><header><span className="eyebrow">CREATE</span><h2>What do you imagine?</h2><p>Describe the scene, then choose a format for your image.</p></header>
      <form onSubmit={generate} className="image-create-form">
        <label htmlFor="image-prompt">Describe your image</label><textarea id="image-prompt" className="field" rows={4} maxLength={2000} value={prompt} onChange={e=>setPrompt(e.target.value)} disabled={busy} placeholder="A mountain cricket ground in Nepal at sunrise, editorial illustration…" required />
        <div className="image-format-fields"><div><label htmlFor="image-format">Output format</label><select id="image-format" className="field" disabled={busy} value={format} onChange={e=>{setFormat(e.target.value);const f=formats.find(f=>f[0]===e.target.value);if(f){setWidth(f[2]);setHeight(f[3]);}}}>{formats.map(f=><option key={f[0]} value={f[0]}>{f[1]} · {f[2]} × {f[3]}</option>)}<option value="custom">Custom dimensions</option></select></div>
        <div><label htmlFor="image-width">Width</label><input id="image-width" className="field" type="number" min={256} max={2400} value={width} disabled={busy || format!=='custom'} onChange={e=>setWidth(Number(e.target.value))}/></div>
        <div><label htmlFor="image-height">Height</label><input id="image-height" className="field" type="number" min={256} max={2400} value={height} disabled={busy || format!=='custom'} onChange={e=>setHeight(Number(e.target.value))}/></div></div>
        <div className="image-submit"><span>Illustrations are resized to your chosen output size. Exact lettering may be unreliable.</span><button className="btn btn-primary" disabled={busy || !service.available || service.busy || !prompt.trim()}>{busy?'Creating…':'Generate image'}</button></div>
      </form></section>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <section aria-labelledby="image-gallery-title"><div className="image-gallery-heading"><div><span className="eyebrow">YOUR IMAGES</span><h2 id="image-gallery-title">From ideas to artwork.</h2></div><span className="badge badge-neutral">{images.length} saved</span></div>
      {!images.length?<div className="panel image-empty"><h3>Your next idea belongs here.</h3><p>Images created here are saved to this workspace.</p></div>:<div className="image-gallery">{images.slice((page-1)*12,page*12).map(image=><article className="panel image-art-card" key={image.id}><a href={image.url} target="_blank" rel="noopener noreferrer"><img src={image.url} alt={image.description || 'Generated illustration'} loading="lazy"/></a><div><p>{image.description}</p><span>{image.width} × {image.height} · {new Date(image.createdAt).toLocaleString()}</span><a className="btn btn-secondary" href={image.url} download={`image-${image.id}.png`}>Download PNG</a></div></article>)}</div>}
      {images.length>12 && <nav className="image-pagination" aria-label="Image pages"><button className="btn btn-secondary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>{page} / {Math.ceil(images.length/12)}</span><button className="btn btn-secondary" disabled={page*12>=images.length} onClick={()=>setPage(p=>p+1)}>Next</button></nav>}</section>
    </div>
  </AppShell>;
}
