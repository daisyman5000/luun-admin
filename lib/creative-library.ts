import fs from "node:fs";
import path from "node:path";
import os from "node:os";
export type CreativeAsset = { id:string; reference:string; title:string; createdAt:string; type:"image"|"video"; source:"Creative Lab"; rightsStatus:string; previewUrl:string };
type LibraryAsset = { id:string; file:string; status?:string; direction?:string; scene?:string; createdAt?:string; roomReference?:{license?:string} };
type LibraryAnimation = { id:string; video?:string; status?:string; sample?:boolean; idea?:string; completedAt?:string };
export function installedCreativeDataDirectory() {
 const configuration=path.join(os.homedir(),"Applications","LUUN Creative Lab.app","Contents","Resources","local.json");
 const config=JSON.parse(fs.readFileSync(configuration,"utf8"));
 if(typeof config.dataPath!=="string" || !path.isAbsolute(config.dataPath))throw new Error("Creative Lab library is not configured.");
 return config.dataPath as string;
}
export function createCreativeLibrary(directory:string) {
 function filePath(file:string) {
  if(!/^[a-f0-9-]+\.(jpg|jpeg|png|webp|mp4)$/.test(file))throw new Error("Unsupported Creative Lab media file.");
  const media=fs.realpathSync(path.join(directory,"media"));const target=fs.realpathSync(path.join(media,file));
  if(!target.startsWith(media+path.sep) || !fs.statSync(target).isFile())throw new Error("Media is outside the Creative Lab library.");
  return target;
 }
 function records() {
  const data=JSON.parse(fs.readFileSync(path.join(directory,"library.json"),"utf8"));
  const images=(Array.isArray(data.assets)?data.assets:[]).filter((item:LibraryAsset)=>item.status==="kept").map((item:LibraryAsset)=>({key:"asset-"+item.id,file:item.file,title:item.direction||item.scene||"Kept image",createdAt:item.createdAt||"",type:"image" as const}));
  const videos=(Array.isArray(data.animations)?data.animations:[]).filter((item:LibraryAnimation)=>item.status==="complete"&&!item.sample&&item.video).map((item:LibraryAnimation)=>({key:"animation-"+item.id,file:item.video!,title:item.idea||"Completed animation",createdAt:item.completedAt||"",type:"video" as const}));
  return [...images,...videos].filter(item=>{try{filePath(item.file);return true;}catch{return false;}});
 }
 function list():CreativeAsset[]{return records().map(item=>({id:item.key,reference:"creative-lab:"+item.key,title:item.title,createdAt:item.createdAt,type:item.type,source:"Creative Lab",rightsStatus:"Usage rights need review; Keep is not publication approval.",previewUrl:"/api/content/assets/"+encodeURIComponent(item.key)}));}
 function resolve(reference:string){const key=reference.replace(/^creative-lab:/,"");const record=records().find(item=>item.key===key);if(!record)throw new Error("Linked asset is no longer kept, complete or available in Creative Lab. Choose an available asset and review again.");return {file:filePath(record.file),type:record.type};}
 return {list,resolve};
}
export function installedCreativeLibrary(){return createCreativeLibrary(installedCreativeDataDirectory());}
