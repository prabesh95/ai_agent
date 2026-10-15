import { FILE_TYPES, filterFiles, listWorkspaceFiles } from '@/lib/files';
export const runtime='nodejs';
export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const query=(params.get('q')||'').slice(0,300),type=params.get('type')||'all',sort=params.get('sort')||'newest';
  const page=Number(params.get('page')||1);
  if(!(type==='all'||Object.hasOwn(FILE_TYPES,type))||!['newest','oldest','name'].includes(sort)||!Number.isInteger(page)||page<1)return Response.json({error:'Invalid file filters.'},{status:400});
  try{
    const all=await listWorkspaceFiles();const filtered=filterFiles(all,query,type,sort);
    const counts=Object.fromEntries(Object.keys(FILE_TYPES).map(type=>[type,all.filter(file=>file.type===type).length]));
    const pageSize=12,pages=Math.max(1,Math.ceil(filtered.length/pageSize)),currentPage=Math.min(page,pages);
    return Response.json({files:filtered.slice((currentPage-1)*pageSize,currentPage*pageSize),total:filtered.length,totalFiles:all.length,counts,page:currentPage,pages},{headers:{'Cache-Control':'no-store'}});
  }catch{ return Response.json({error:'Could not read saved files. Please retry.'},{status:500}); }
}
