"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/shell/AppShell';
import { Icon } from '../../components/ui/Icon';
import { TASKS } from '../../lib/tasks/registry';
import type { Store } from '../../lib/news/store.mjs';
import './tasks.css';

const PAGE_SIZE = 12;
export default function TasksOverview() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    // Preserve links generated before the workspace was moved.
    const article = new URLSearchParams(window.location.search).get('article');
    if (article && /^[a-f0-9]{24}$/.test(article)) {
      window.location.replace(`/tasks/kantipur?article=${article}`); return;
    }
    const controller = new AbortController();
    fetch('/api/news', {cache:'no-store', signal:controller.signal}).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load task status');
      setStore(data);
    }).catch(e => {if (!controller.signal.aborted) setError(e.message);})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, []);
  function status(id: string) {
    if (id !== 'kantipur') return 'Available';
    if (loading) return 'Loading';
    if (error) return 'Unavailable';
    if (store?.lastAttempt?.error || store?.lastAttempt?.failed) return 'Needs attention';
    return store?.lastRun ? 'Ready' : 'Not collected';
  }
  const filtered = TASKS.filter(task => `${task.name} ${task.description} ${task.category}`.toLowerCase().includes(query.toLowerCase()))
    .filter(task => category === 'All' || task.category === category)
    .filter(task => statusFilter === 'All' || status(task.id) === statusFilter);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  return <AppShell activeView="tasks" title="Your tasks." description="A home for the work your AI workspace helps you manage.">
    <section className="task-overview" aria-label="Task directory">
      <div className="task-directory-heading"><div><span className="eyebrow">WORKSPACE DIRECTORY</span><h2>Everything in its place.</h2><p>Choose a task to open its tools and results.</p></div><span className="badge badge-neutral">{TASKS.length} {TASKS.length === 1 ? 'task' : 'tasks'}</span></div>
      <div className="task-directory-tools panel">
        <div className="task-search"><label className="eyebrow" htmlFor="task-search">FIND A TASK</label><input className="field" id="task-search" placeholder="Search tasks…" value={query} onChange={e => {setQuery(e.target.value);setPage(1);}} /></div>
        <div><label className="eyebrow" htmlFor="task-category">CATEGORY</label><select className="field" id="task-category" value={category} onChange={e => {setCategory(e.target.value);setPage(1);}}><option value="All">All categories</option>{[...new Set(TASKS.map(t => t.category))].map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="eyebrow" htmlFor="task-status">STATUS</label><select className="field" id="task-status" value={statusFilter} onChange={e => {setStatusFilter(e.target.value);setPage(1);}}><option value="All">All statuses</option>{[...new Set(TASKS.map(t => status(t.id)))].map(s => <option key={s}>{s}</option>)}</select></div>
      </div>
      {error && <p className="alert alert-error" role="alert">{error}. You can still open the task to retry.</p>}
      <div className="task-results-label" role="status">{filtered.length} {filtered.length === 1 ? 'task' : 'tasks'} shown</div>
      <div className="task-card-grid">{visible.map(task => <Link className="panel task-directory-card" href={task.href} key={task.id}>
        <div className="task-card-top"><span className="panel-icon"><Icon name={task.icon} size={20} /></span><span className={`badge ${status(task.id) === 'Needs attention' ? 'task-warning' : 'badge-neutral'}`}>{status(task.id)}</span></div>
        <span className="eyebrow">{task.category}</span><h3>{task.name}</h3><p className="task-card-description">{task.description}</p>
        {task.id === 'kantipur' && <><div className="task-card-stat"><strong>{loading ? '—' : store?.articles.length ?? '—'}</strong><span>saved articles</span></div>
        <p className="task-card-date">{store?.lastRun?.finishedAt ? `Collected ${new Date(store.lastRun.finishedAt).toLocaleString('en-GB', {timeZone:'Asia/Kathmandu'})} (Nepal time)` : loading ? 'Checking collection…' : 'No completed collection yet'}</p></>}
        <div className="task-card-open">Open workspace <Icon name="arrow" size={16} /></div>
      </Link>)}</div>
      {!filtered.length && <div className="panel task-directory-empty"><h3>No matching tasks</h3><p>Try a different search or reset your filters.</p><button className="btn btn-secondary" onClick={() => {setQuery('');setCategory('All');setStatusFilter('All');setPage(1);}}>Reset filters</button></div>}
      {pages > 1 && <nav className="task-pagination" aria-label="Task pages"><button className="btn btn-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}>Previous</button><span>Page {currentPage} of {pages}</span><button className="btn btn-secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage+1)}>Next</button></nav>}
    </section>
  </AppShell>;
}
