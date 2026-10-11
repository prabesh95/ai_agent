import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function storePath() {
  return path.resolve(process.env.NEWS_DATA_DIR || path.join(process.cwd(), 'data', 'news'), 'kantipur.json');
}
export async function readStore() {
  try {
    const data = JSON.parse(await readFile(storePath(), 'utf8'));
    if (data.version !== 1 || !Array.isArray(data.articles)) throw new Error('Invalid Kantipur store');
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, articles: [], lastRun: null };
    throw error;
  }
}
export async function writeStore(data) {
  const file = storePath();
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
  await rename(temp, file);
}
