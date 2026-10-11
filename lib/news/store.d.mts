export interface Article { id: string; source: string; url: string; headline: string; body: string; category: string; publishedAt: string | null; publishedDate: string | null; dateSource: string; collectedAt: string }
export interface Run { startedAt: string; finishedAt: string | null; saved: number; failed: number; errors: {url: string; message: string}[]; error?: string }
export interface Store { version: number; articles: Article[]; lastRun: Run | null; lastAttempt?: Run }
export function readStore(): Promise<Store>;
export function writeStore(store: Store): Promise<void>;
export function storePath(): string;
