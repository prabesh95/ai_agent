export interface SearchResult {id:string;title:string;url:string;content:string;publishedDate:string|null}
export function searchWeb(question:string, options?:{signal?:AbortSignal;fetchImpl?:typeof fetch;apiKey?:string}):Promise<SearchResult[]>;
export function cleanSnippet(text:unknown):string;
export function searchParameters(question:string,now?:Date):Record<string,unknown>;
export function normalizeResults(data: {results?:unknown[]}):SearchResult[];
export function webContext(results:SearchResult[]):string;
