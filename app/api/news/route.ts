import { readStore } from '../../../lib/news/store.mjs';
import { collectKantipur } from '../../../lib/news/collect.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return Response.json(await readStore(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Could not read the saved news store.' }, { status: 500 }); }
}
export async function POST(request: Request) {
  // Browser mutations must come from this app, not another website.
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  try { return Response.json(await collectKantipur()); }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Collection failed';
    return Response.json({ error: message }, { status: message.includes('already running') ? 409 : 500 });
  }
}
