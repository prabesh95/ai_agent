import type { Article, Store } from './store.mjs';
export function isNewsRequest(text: string): boolean;
export function selectArticles(articles: Article[], question: string, now?: Date): Article[];
export function newsReply(store: Store, question: string, now?: Date): string;
export function nepalDate(now?: Date): string;
