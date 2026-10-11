import type { Article, Run } from './store.mjs';
export function collectKantipur(options?: {limit?: number}): Promise<Run>;
export function articleLinks(html: string): string[];
export function extractArticle(html: string, url: string, now?: Date): Article;
