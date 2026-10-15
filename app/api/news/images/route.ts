import { generateImage, imageHealth, listImages, sameOrigin, validSize } from '@/lib/images/service';
export const runtime = 'nodejs';
export const maxDuration = 600;
export async function GET() {
  return Response.json({ service: await imageHealth(), images: await listImages() }, { headers: {'Cache-Control':'no-store'} });
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:'Invalid request origin.'}, {status:403});
  try {
    const body = await request.json();
    if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 2000 || !validSize(body.width, body.height)) return Response.json({error:'Enter a prompt and valid image dimensions.'}, {status:400});
    return Response.json(await generateImage(body.prompt.trim(), body.prompt.trim(), body.width, body.height, request.signal));
  } catch (error) { return Response.json({error: error instanceof Error ? error.message : 'Image generation failed.'}, {status:502}); }
}
