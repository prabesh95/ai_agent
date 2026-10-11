import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readStore, writeStore, storePath } from '../lib/news/store.mjs';
import { isNewsRequest, nepalDate, selectArticles, newsReply } from '../lib/news/query.mjs';

const now = new Date('2026-10-09T19:00:00Z'); // October 10 in Nepal.
const base = { id: 'a'.repeat(24), source: 'Kantipur', url: 'https://ekantipur.com/business/2026/10/10/story.html', headline: 'तरकारी बजार', body: 'Original Nepali reporting', category: 'business', publishedAt: null, publishedDate: '2026-10-10', dateSource: 'url', collectedAt: now.toISOString() };
test('today uses Nepal date and excludes older articles', () => {
  assert.equal(nepalDate(now), '2026-10-10');
  assert.deepEqual(selectArticles([base, {...base, id: 'b', publishedDate: '2026-10-09'}], 'news today', now), [base]);
});
test('category filtering and unknown topic do not return unrelated stories', () => {
  assert.deepEqual(selectArticles([base], 'business news', now), [base]);
  assert.deepEqual(selectArticles([base], 'football news', now), []);
  assert.deepEqual(selectArticles([base], 'news about Mars', now), []);
});
test('Nepali keywords match original saved text', () => {
  assert.deepEqual(selectArticles([base], 'तरकारी समाचार', now), [base]);
});
test('news intent does not intercept ordinary chat', () => {
  assert.equal(isNewsRequest('show news'), true);
  assert.equal(isNewsRequest('समाचार देखाउनुहोस्'), true);
  assert.equal(isNewsRequest('explain JavaScript'), false);
});
test('replies preserve original excerpts, link to Tasks, and disclose stale data', () => {
  const reply = newsReply({ articles: [base], lastRun: {finishedAt: '2026-10-01T00:00:00Z'} }, 'news', now);
  assert.ok(reply.includes(base.headline)); assert.ok(reply.includes(base.body));
  assert.ok(reply.includes(`/tasks?article=${base.id}`)); assert.ok(reply.includes('over 24 hours'));
});
test('empty matching results explicitly report no saved data', () => {
  assert.ok(newsReply({ articles: [], lastRun: null }, 'news', now).includes('No matching saved'));
});
test('UTF-8 store survives disk round-trip and corruption is not treated as empty', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kantipur-test-')); const previous = process.env.NEWS_DATA_DIR;
  process.env.NEWS_DATA_DIR = dir;
  try {
    assert.equal((await readStore()).articles.length, 0);
    await writeStore({version: 1, articles: [base], lastRun: null});
    assert.deepEqual((await readStore()).articles, [base]);
    await writeFile(storePath(), 'broken JSON');
    await assert.rejects(readStore());
  } finally {
    if (previous === undefined) delete process.env.NEWS_DATA_DIR; else process.env.NEWS_DATA_DIR = previous;
    await rm(dir, {recursive:true, force:true});
  }
});
