import { listImages } from '@/lib/images/service';
export const FILE_TYPES = { image:'Image', document:'Document', audio:'Audio', video:'Video', other:'Other' } as const;
export type FileType = keyof typeof FILE_TYPES;
export type WorkspaceFile = {id:string; type:FileType; name:string; description:string; mimeType:string; url:string; thumbnailUrl?:string; downloadName:string; createdAt:string; source:string; width?:number; height?:number};
// Each file producer registers one adapter. Records reference the original bytes;
// this directory does not create copies or become a second source of truth.
const adapters: Array<()=>Promise<WorkspaceFile[]>> = [async()=>{
  const images=await listImages();
  return images.filter(image=>image && /^[a-f0-9-]{36}$/.test(image.id) && typeof image.createdAt==='string' && typeof image.description==='string').map(image=>({
    id:`image:${image.id}`,type:'image',name:`Image · ${image.id.slice(0,8)}`,
    description:image.description,mimeType:'image/png',url:`/api/images/${image.id}`,
    thumbnailUrl:`/api/images/${image.id}`,downloadName:`image-${image.id}.png`,
    createdAt:image.createdAt,source:'Image generation service',width:image.width,height:image.height,
  }));
}];
export async function listWorkspaceFiles(){return (await Promise.all(adapters.map(adapter=>adapter()))).flat();}
export function filterFiles(files:WorkspaceFile[],query:string,type:string,sort:string){
  return files.filter(file=>(type==='all'||file.type===type)&&`${file.name} ${file.description} ${file.source}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='oldest'?a.createdAt.localeCompare(b.createdAt):b.createdAt.localeCompare(a.createdAt));
}
