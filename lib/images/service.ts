import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export { FORMATS } from "./formats";
export type ImageRecord = { id: string; url: string; description: string; width: number; height: number; createdAt: string; timings: Record<string, number> };
const root = () => path.resolve(process.env.IMAGE_DATA_DIR || 'data/images');
export function validSize(width: unknown, height: unknown) {
  return Number.isInteger(width) && Number.isInteger(height) && Number(width) >= 256 && Number(height) >= 256 && Number(width) <= 2400 && Number(height) <= 2400 && Number(width) * Number(height) <= 4608000;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  try { const url = new URL(origin || ''); return ['http:', 'https:'].includes(url.protocol) && url.host === request.headers.get('host'); } catch { return false; }
}
function endpoint(route: string) {
  const base = new URL(process.env.IMAGE_SERVICE_URL || 'http://127.0.0.1:8001');
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid IMAGE_SERVICE_URL.');
  return new URL(route, base);
}
export async function imageHealth() {
  if ((process.env.IMAGE_PROVIDER || 'local-openvino') !== 'local-openvino') return { available: false, busy: false, message: 'The configured image provider needs an adapter.' };
  try {
    const response = await fetch(endpoint('/health'), { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    const modelsResponse = await fetch(endpoint('/models'), { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!response.ok || !modelsResponse.ok) throw new Error();
    const health = await response.json(), models = await modelsResponse.json();
    const selected = process.env.IMAGE_MODEL || 'lcm-dreamshaper-fp16';
    const available = Array.isArray(models.models) && models.models.some((m: {id: string; available: boolean}) => m.id === selected && m.available);
    return { available, busy: health.busy === true, message: available ? 'Image service ready' : 'The configured model is not downloaded.' };
  } catch { return { available: false, busy: false, message: 'Start the image service on port 8001.' }; }
}
export async function listImages(): Promise<ImageRecord[]> {
  await mkdir(root(), { recursive: true });
  const files = await readdir(root());
  const records = await Promise.all(files.filter(f => /^[a-f0-9-]{36}\.json$/.test(f)).map(async f => {
    try { return JSON.parse(await readFile(path.join(root(), f), 'utf8')) as ImageRecord; } catch { return null; }
  }));
  return records.filter((r): r is ImageRecord => r !== null).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export async function readImage(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  try { return await readFile(path.join(root(), `${id}.png`)); } catch { return null; }
}
// Provider boundary: future cloud implementations belong here. Never silently
// send a local request to a paid provider, and never expose API keys to clients.
async function generateWithProvider(prompt: string, width: number, height: number, signal?: AbortSignal) {
  const provider = process.env.IMAGE_PROVIDER || 'local-openvino';
  if (provider !== 'local-openvino') throw new Error(`Image provider '${provider}' has no installed adapter.`);
  const response = await fetch(endpoint('/generate'), {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ model_id: process.env.IMAGE_MODEL || 'lcm-dreamshaper-fp16', prompt, output_width: width, output_height: height }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(600000)]) : AbortSignal.timeout(600000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Image service rejected the request.');
  if (data.image?.mime_type !== 'image/png' || typeof data.image?.base64 !== 'string' || data.image.base64.length > 32000000) throw new Error('Invalid image service response.');
  if (data.width !== width || data.height !== height) throw new Error('Update image_server.py to enable output sizing.');
  return data;
}
export async function generateImage(prompt: string, description: string, width: number, height: number, signal?: AbortSignal): Promise<ImageRecord> {
  if (!validSize(width, height)) throw new Error('Output size must be 256–2400 pixels per side, up to 4.6 megapixels.');
  const result = await generateWithProvider(prompt, width, height, signal);
  const png = Buffer.from(result.image.base64, 'base64');
  if (!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Invalid PNG response.');
  const id = randomUUID();
  const record: ImageRecord = { id, url: `/api/images/${id}`, description: description.slice(0,500), width, height, createdAt: new Date().toISOString(), timings: result.timings || {} };
  await mkdir(root(), { recursive: true });
  const temporary = path.join(root(), `${id}.tmp`);
  await writeFile(temporary, png);
  await rename(temporary, path.join(root(), `${id}.png`));
  await writeFile(path.join(root(), `${id}.json`), JSON.stringify(record, null, 2));
  return record;
}
