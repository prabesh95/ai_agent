export function nepalDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function isNewsRequest(text) {
  return /\b(news|headlines|kantipur)\b|समाचार|खबर|कान्तिपुर/i.test(text);
}
const categories = [
  [/\b(business|economy|economic)\b|अर्थ|व्यापार/i, 'business'],
  [/\b(politics|political)\b|राजनीति/i, 'politics'],
  [/\b(sport|sports|cricket|football)\b|खेलकुद/i, 'sports'],
  [/\b(health)\b|स्वास्थ्य/i, 'health'],
  [/\b(technology|tech)\b|प्रविधि/i, 'technology'],
];
const ignored = new Set('tell me show give what are the latest recent news headlines about from kantipur nepal please today todays in of and is'.split(' '));
export function selectArticles(articles, question, now = new Date()) {
  const todayOnly = /\btoday\b|आज/i.test(question);
  const category = categories.find(([pattern]) => pattern.test(question))?.[1];
  const terms = question.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu)?.filter(t => !ignored.has(t) && t.length > 2 && !/^(समाचार|खबर|कान्तिपुर|आजको|नेपालको|नेपाल|ताजा|देखाउनुहोस्)$/.test(t)) ?? [];
  // Category requests are routed by category, not translated by the model.
  const specific = !category && terms.length > 0;
  return articles.filter(a => !todayOnly || a.publishedDate === nepalDate(now))
    .filter(a => !category || a.category.toLowerCase() === category)
    .map(a => ({ article: a, score: terms.reduce((n, t) => n + (a.headline.toLowerCase().includes(t) ? 3 : a.body.toLowerCase().includes(t) ? 1 : 0), 0) }))
    .filter(a => !specific || a.score > 0)
    .sort((a, b) => b.score - a.score || (b.article.publishedAt || b.article.publishedDate || '').localeCompare(a.article.publishedAt || a.article.publishedDate || ''))
    .slice(0, 5).map(a => a.article);
}
export function newsReply(store, question, now = new Date()) {
  const records = selectArticles(store.articles, question, now);
  if (!records.length) return 'No matching saved Kantipur articles were found. Open Tasks → Kantipur News and collect articles. This is a saved collection, not a live web search. Topic matching is keyword-based; try a Nepali keyword or a category such as business news.';
  const collected = store.lastRun?.finishedAt;
  const stale = !collected || now.getTime() - new Date(collected).getTime() > 24 * 60 * 60 * 1000;
  return `${stale ? 'The collection is over 24 hours old or has no successful collection time.\n\n' : ''}Here are matching saved Kantipur articles. These are original Nepali excerpts, not AI summaries. This collection may not contain every current story.\n${collected ? `Last collection completed: ${new Date(collected).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })} (Nepal time).\n` : ''}\n` + records.map((a, i) => `${i + 1}. ${a.headline}\nPublication date: ${a.publishedDate || 'Unknown'}${a.dateSource === 'url' ? ' (from article URL)' : ''}\n${a.body.slice(0, 350)}${a.body.length > 350 ? '…' : ''}\n[Read saved article](/tasks?article=${a.id})\n`).join('\n');
}
