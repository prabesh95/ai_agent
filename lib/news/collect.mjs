import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { readStore, writeStore, storePath } from './store.mjs';

const homepage = 'https://ekantipur.com/';
const pattern = /^\/[^/]+\/\d{4}\/\d{2}\/\d{2}\/[^/]+\.html$/;
const clean = text => text.replace(/\s+/g, ' ').trim();
export function articleLinks(html) {
  const $ = cheerio.load(html), links = new Set();
  $('a[href]').each((_, node) => {
    try {
      const url = new URL($(node).attr('href'), homepage);
      if (url.origin !== new URL(homepage).origin || !pattern.test(url.pathname)) return;
      url.hash = ''; url.search = ''; links.add(url.href);
    } catch { /* Not a URL. */ }
  });
  return [...links];
}
export function extractArticle(html, url, now = new Date()) {
  const $ = cheerio.load(html), header = $('.news-section-wrap').first();
  const headline = clean($('meta[property="og:title"]').attr('content') || header.find('h1,h2,h3').first().text());
const interfaceLabels = new Set([
  "facebook",
  "messenger",
  "twitter",
  "whatsapp",
  "viber",
  "copy link",
]);

const body = $(".news-section-wrap-story .news-inner-wrapper p")
  .map((_, paragraph) => clean($(paragraph).text()))
  .get()
  .filter(text => {
    if (!text) return false;

    // Remove standalone sharing labels.
    if (interfaceLabels.has(text.toLowerCase())) return false;

    // Remove interface counters such as "15 Updates".
    if (/^\d+\s+updates?$/i.test(text)) return false;

    return true;
  })
  .join("\n\n");  if (!headline || body.length < 80) throw new Error('Article headline/body extraction failed');
  const metaDate = $('meta[property="article:published_time"]').attr('content');
  // Accept only metadata with an explicit timezone; do not invent a publication time.
  const publishedAt = metaDate && /(Z|[+-]\d{2}:?\d{2})$/i.test(metaDate) && !Number.isNaN(Date.parse(metaDate)) ? new Date(metaDate).toISOString() : null;
  const pathname = new URL(url).pathname;
  const urlDate = pathname.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  const publishedDate = publishedAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(publishedAt)) : urlDate ? `${urlDate[1]}-${urlDate[2]}-${urlDate[3]}` : null;
  return { id: createHash('sha256').update(url).digest('hex').slice(0, 24), source: 'Kantipur', url, headline, body, category: pathname.split('/')[1], publishedAt, publishedDate, dateSource: publishedAt ? 'metadata' : urlDate ? 'url' : 'unknown', collectedAt: now.toISOString() };
}
async function fetchPage(url) {
  // Never follow an unexpected redirect outside this fixed source.
  for (let redirect = 0; redirect < 4; redirect++) {
    if (new URL(url).origin !== new URL(homepage).origin) throw new Error('Unexpected source origin');
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Missing redirect location');
      url = new URL(location, url).href; continue;
    }
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Source did not return HTML');
    const reader = response.body.getReader(); let bytes = 0; const chunks = [];
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        bytes += value.length; if (bytes > 3_000_000) throw new Error('Page exceeds size limit');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks).toString('utf8');
  }
  throw new Error('Too many redirects');
}
export async function collectKantipur({ limit = 10 } = {}) {
  const lock = path.join(path.dirname(storePath()), '.collection-lock');
  await mkdir(path.dirname(lock), { recursive: true });
  try { await mkdir(lock); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // A crashed process's lock expires after ten minutes; collection is bounded.
    if (Date.now() - (await stat(lock)).mtimeMs < 600000) throw new Error('A Kantipur collection is already running');
    await rm(lock, { recursive: true, force: true }); await mkdir(lock);
  }
  try {
    const store = await readStore();
    const run = { startedAt: new Date().toISOString(), finishedAt: null, saved: 0, failed: 0, errors: [] };
    try {
      const links = articleLinks(await fetchPage(homepage)).slice(0, Math.max(1, Math.min(10, limit)));
      if (!links.length) throw new Error('No article URLs were discovered');
      const records = new Map(store.articles.map(a => [a.id, a]));
      for (const url of links) {
        try {
          const article = extractArticle(await fetchPage(url), url);
          records.set(article.id, article); run.saved++;
        } catch (error) { run.failed++; run.errors.push({ url, message: error.message }); }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      store.articles = [...records.values()];
      if (!run.saved) throw new Error('No articles could be collected');
      run.finishedAt = new Date().toISOString();
      store.lastRun = run; store.lastAttempt = run;
      await writeStore(store);
      return run;
    } catch (error) {
      run.error = error.message; store.lastAttempt = run;
      await writeStore(store); throw error;
    }
  } finally { await rm(lock, { recursive: true, force: true }); }
}
