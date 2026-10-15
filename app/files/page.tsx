"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { Icon } from '@/components/ui/Icon';
import type { WorkspaceFile } from '@/lib/files';
import './files.css';
const types={image:'Images',document:'Documents',audio:'Audio',video:'Video',other:'Other'};
type Result={files:WorkspaceFile[];total:number;totalFiles:number;counts:Record<string,number>;page:number;pages:number};
export default function FilesWorkspace(){
  const [query,setQuery]=useState(''),[type,setType]=useState('all'),[sort,setSort]=useState('newest'),[page,setPage]=useState(1),[refresh,setRefresh]=useState(0);
  const [result,setResult]=useState<Result|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    const timer=setTimeout(()=>{
      const params=new URLSearchParams({q:query,type,sort,page:String(page)});
      fetch(`/api/files?${params}`,{cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load files.');setResult(data);})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },200);
    return()=>{clearTimeout(timer);controller.abort();};
  },[query,type,sort,page,refresh]);
  return <AppShell activeView="files" title="Your files." description="Everything you create, with room for what comes next.">
    <section className="files-workspace" aria-label="File library">
      <header className="files-heading"><div><span className="eyebrow">WORKSPACE LIBRARY</span><h2>Keep your creations close.</h2><p>Browse saved files by type and origin.</p></div><button className="btn btn-secondary" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>Refresh</button></header>
      <div className="files-categories" aria-label="File categories"><button className={`btn ${type==='all'?'btn-primary':'btn-secondary'}`} aria-pressed={type==='all'} onClick={()=>{setType('all');setPage(1);}}>All files <span>{result?.totalFiles??'—'}</span></button>{Object.entries(types).filter(([id])=>(result?.counts[id]||0)>0||type===id).map(([id,label])=><button key={id} className={`btn ${type===id?'btn-primary':'btn-secondary'}`} aria-pressed={type===id} onClick={()=>{setType(id);setPage(1);}}>{label} <span>{result?.counts[id]||0}</span></button>)}</div>
      <div className="panel files-toolbar"><div><label className="eyebrow" htmlFor="file-search">FIND A FILE</label><input className="field" id="file-search" type="search" value={query} placeholder="Search descriptions or names…" onChange={e=>{setQuery(e.target.value);setPage(1);}}/></div><div><label className="eyebrow" htmlFor="file-sort">SORT BY</label><select className="field" id="file-sort" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name</option></select></div></div>
      {error&&<p className="alert alert-error" role="alert">{error}</p>}
      <div className="files-results" role="status">{loading?'Loading files…':`${result?.total??0} files shown`}</div>
      <div className="files-grid" aria-busy={loading}>{result?.files.map(file=><article className="panel file-card" key={file.id}>
        <a href={file.url} target="_blank" rel="noopener noreferrer" className="file-preview" aria-label={`Open ${file.name}`}>{file.type==='image'&&file.thumbnailUrl?<img src={file.thumbnailUrl} alt={file.description||file.name} loading="lazy"/>:<Icon name="files" size={36}/>}</a>
        <div className="file-card-body"><div className="file-card-label"><span className="badge badge-neutral">{file.type==='image'?'Image':file.type==='document'?'Document':file.type==='audio'?'Audio':file.type==='video'?'Video':'Other'}</span><span>{file.mimeType==='image/png'?'PNG':file.mimeType}</span></div><h3>{file.name}</h3><p className="file-description" title={file.description}>{file.description}</p><div className="file-details">{file.width&&file.height&&<span>{file.width} × {file.height}</span>}<time dateTime={file.createdAt}>{new Date(file.createdAt).toLocaleDateString()}</time></div><span className="file-origin">{file.source}</span><a className="btn btn-secondary" href={file.url} download={file.downloadName}>Download</a></div>
      </article>)}</div>
      {!loading&&!error&&!result?.files.length&&<div className="panel files-empty"><Icon name="files" size={28}/><h3>{query||type!=='all'?'No matching files':'Your library starts here.'}</h3><p>{query||type!=='all'?'Try a different search or category.':'Create an image and it will appear here automatically.'}</p><Link className="btn btn-secondary" href="/tasks/images">Open image generation</Link></div>}
      {result&&result.pages>1&&<nav className="files-pagination" aria-label="File pages"><button className="btn btn-secondary" disabled={loading||result.page===1} onClick={()=>setPage(result.page-1)}>Previous</button><span>Page {result.page} of {result.pages}</span><button className="btn btn-secondary" disabled={loading||result.page===result.pages} onClick={()=>setPage(result.page+1)}>Next</button></nav>}
    </section>
  </AppShell>;
}
