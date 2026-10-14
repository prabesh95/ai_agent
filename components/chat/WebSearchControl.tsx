import { useEffect, useState } from 'react';
import './web-search.css';
export function WebSearchControl({ enabled, busy, onToggle }: { enabled: boolean; busy: boolean; onToggle: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/web-search', {signal:controller.signal}).then(r => r.json()).then(data => setConfigured(data.configured === true)).catch(() => {});
    return () => controller.abort();
  }, []);
  return <section className="panel web-search-panel" aria-label="Web search settings">
    <div className="web-search-heading"><div><h2>Search web</h2><p>{enabled ? 'Live results for the next message' : 'Local chat and saved Kantipur news'}</p></div>
      <button className="web-search-switch" type="button" role="switch" aria-checked={enabled} aria-label="Search web" disabled={busy} onClick={onToggle}><span /></button></div>
    <p className="web-search-note">{enabled ? 'Your message is sent to Tavily. Ollama writes the answer locally.' : 'Turn on when you need information from the web.'}</p>
    {configured === false && <p className="web-search-key-note">Add TAVILY_API_KEY to .env.local and restart Next.js.</p>}
  </section>;
}
