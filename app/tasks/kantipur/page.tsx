"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/shell/AppShell';
import type { Store, Article } from '../../../lib/news/store.mjs';
import '../tasks.css';

const date = (value: string) => new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' });
export default function TasksPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    const response = await fetch('/api/news', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load articles');
    setStore(data);
  }
  useEffect(() => {
    let live = true;
    setSelected(new URLSearchParams(window.location.search).get('article'));
    const controller = new AbortController();
    fetch('/api/news', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load articles');
      if (live) setStore(data);
    }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; controller.abort(); };
  }, []);
  async function collect() {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/news', { method: 'POST' });
      const run = await response.json(); if (!response.ok) throw new Error(run.error || 'Collection failed');
      setNotice(`Saved or updated ${run.saved} articles. ${run.failed} failed.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Collection failed'); }
    finally {
      try { await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not refresh'); }
      setBusy(false);
    }
  }
  const articles = [...(store?.articles ?? [])].sort((a, b) => (b.publishedAt || b.publishedDate || '').localeCompare(a.publishedAt || a.publishedDate || ''));
  const shown = articles.filter(a => `${a.headline} ${a.body} ${a.category}`.toLowerCase().includes(filter.toLowerCase()));
  const article: Article | undefined = articles.find(a => a.id === selected);
  return <AppShell activeView="tasks" title="Kantipur News." description="Kantipur News · an original Nepali article collection">
    <Link href="/tasks" className="btn btn-ghost task-back">← Back to Tasks</Link>
    <section className="panel news-task">
      <header className="news-task-header"><div><span className="eyebrow">COLLECTION TASK</span><h2>Kantipur News</h2><p>Save original articles from Kantipur. No AI summaries.</p></div>
        <button className="btn btn-primary" onClick={collect} disabled={busy || loading}>{busy ? 'Collecting…' : 'Collect articles'}</button></header>
      <div className="news-task-status"><span>{articles.length} saved articles</span><span>{store?.lastRun?.finishedAt ? `Last completed: ${date(store.lastRun.finishedAt)} (Nepal time)` : 'No completed collection yet'}</span></div>
      <p className="news-help">Each run checks up to 10 homepage articles. Collection can take a few minutes. Use “Refresh saved articles” to see changes made by the terminal worker.</p>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {store?.lastAttempt?.error && <p className="alert alert-error">Last collection error: {store.lastAttempt.error}</p>}
      {!!store?.lastAttempt?.errors.length && <details><summary>Collection warnings ({store.lastAttempt.errors.length})</summary>{store.lastAttempt.errors.map(e => <p key={e.url}>{e.message} — {e.url}</p>)}</details>}
    </section>
    <div className="news-workspace">
      <section className="panel news-library" aria-label="Saved articles"><div className="news-library-tools"><label htmlFor="news-filter" className="eyebrow">SEARCH SAVED ARTICLES</label><input id="news-filter" className="field" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Headline, keyword or category" />
        <button className="btn btn-secondary" disabled={busy || loading} onClick={() => { setError(''); void load().catch(e => setError(e.message)); }}>Refresh saved articles</button></div>
        {loading ? <p role="status">Loading articles…</p> : !shown.length ? <p className="news-empty">{articles.length ? 'No matching articles.' : 'Collect articles to start your library.'}</p> : <div className="news-list">{shown.map(a => <button key={a.id} className={`news-list-item ${selected === a.id ? 'is-selected' : ''}`} onClick={() => {
          setSelected(a.id); const url = new URL(window.location.href); url.searchParams.set('article', a.id); window.history.replaceState(null, '', url);
        }} aria-pressed={selected === a.id}><span className="eyebrow">{a.category} · {a.publishedDate || 'Date unknown'}</span><strong lang="ne">{a.headline}</strong><span lang="ne">{a.body.slice(0, 110)}…</span></button>)}</div>}
      </section>
      <article className="panel news-reader" aria-label="Article reader">{article ? <><span className="eyebrow">KANTIPUR · {article.category}</span><h2 lang="ne">{article.headline}</h2><div className="news-reader-meta"><p>Publication: {article.publishedAt ? `${date(article.publishedAt)} (Nepal time)` : article.publishedDate ? `${article.publishedDate} (date from URL; time unknown)` : 'Unknown'}</p><p>Collected: {date(article.collectedAt)} (Nepal time)</p></div><a className="btn btn-secondary" href={article.url} target="_blank" rel="noopener noreferrer">Original source ↗</a><div className="news-body" lang="ne">{article.body.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</div></> : <div className="news-empty">{selected && !loading ? 'This saved article was not found. Choose another article.' : 'Select an article to read its original Nepali text.'}</div>}</article>
    </div>
  </AppShell>;
}
