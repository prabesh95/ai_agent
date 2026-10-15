import { readImage } from '@/lib/images/service';
export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: {params: Promise<{id: string}>}) {
  const image = await readImage((await params).id);
  if (!image) return new Response('Image not found', {status:404});
  return new Response(new Uint8Array(image), {headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
}
