import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articleLinks, extractArticle } from '../lib/news/collect.mjs';
import { collectKantipur } from '../lib/news/collect.mjs';
import { readStore } from '../lib/news/store.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const url = 'https://ekantipur.com/business/2026/10/10/example.html';
test('discovery excludes categories and outside links and deduplicates articles', () => {
  assert.deepEqual(articleLinks(`<a href="${url}">A</a><a href="${url}#top">B</a><a href="/business">Category</a><a href="https://example.com/business/2026/10/10/example.html">Outside</a>`), [url]);
});
test('extraction preserves original paragraphs and excludes unrelated text', () => {
  const p = 'यो समाचारको मूल नेपाली पाठ हो। '.repeat(5);
  const result = extractArticle(`<meta property="og:title" content="नेपाली शीर्षक"><p>Navigation</p><section class="news-section-wrap-story"><div class="news-inner-wrapper"><p>${p}</p><p>छोटो अनुच्छेद।</p></div></section>`, url);
  assert.equal(result.headline, 'नेपाली शीर्षक'); assert.ok(result.body.includes('छोटो अनुच्छेद।'));
  assert.ok(!result.body.includes('Navigation')); assert.equal(result.publishedDate, '2026-10-10');
  assert.equal(result.publishedAt, null); assert.equal(result.dateSource, 'url');
});
test('h3 header fallback works without metadata; missing body fails visibly', () => {
  assert.equal(extractArticle(`<section class="news-section-wrap"><h3>Headline</h3></section><section class="news-section-wrap-story"><div class="news-inner-wrapper"><p>${'text '.repeat(30)}</p></div></section>`, url).headline, 'Headline');
  assert.throws(() => extractArticle('<h3>Not an article</h3>', url));
});
test('collector updates duplicates, records partial failures, preserves records on failed run', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kantipur-collector-'));
  const previousDir = process.env.NEWS_DATA_DIR, previousFetch = globalThis.fetch;
  process.env.NEWS_DATA_DIR = dir;
  let failed = false;
  globalThis.fetch = async request => {
    if (failed) return new Response('offline', {status: 503});
    if (request === 'https://ekantipur.com/') return new Response(`<a href="${url}">Story</a><a href="https://ekantipur.com/health/2026/10/10/missing.html">Missing</a>`, {headers:{'content-type':'text/html'}});
    if (request.includes('missing')) return new Response('missing', {status:404});
    return new Response(`<meta property="og:title" content="Original"><section class="news-section-wrap-story"><div class="news-inner-wrapper"><p>${'नेपाली पाठ। '.repeat(30)}</p></div></section>`, {headers:{'content-type':'text/html'}});
  };
  try {
    const run = await collectKantipur(); assert.equal(run.saved, 1); assert.equal(run.failed, 1);
    await collectKantipur(); assert.equal((await readStore()).articles.length, 1);
    failed = true; await assert.rejects(collectKantipur());
    const store = await readStore(); assert.equal(store.articles.length, 1); assert.ok(store.lastRun.finishedAt); assert.ok(store.lastAttempt.error);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousDir === undefined) delete process.env.NEWS_DATA_DIR; else process.env.NEWS_DATA_DIR = previousDir;
    await rm(dir, {recursive:true, force:true});
  }
});
