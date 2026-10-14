export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json({configured:Boolean(process.env.TAVILY_API_KEY)}, {headers:{'Cache-Control':'no-store'}});
}
