import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { validatePost, type ContentPost } from "./content";
export function createContentStore(directory: string) {
 const file=path.join(directory,"posts.json");
 function list(): ContentPost[] {
  if (!fs.existsSync(file)) return [];
  const data=JSON.parse(fs.readFileSync(file,"utf8"));
  if (data.schemaVersion!==1 || !Array.isArray(data.posts)) throw new Error("Content store format is unavailable. Preserve the file and restore a backup.");
  return data.posts;
 }
 function save(body: Record<string,unknown>, plan?:{version:number;objective:string}) {
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  let lock: number; try {lock=fs.openSync(file+".lock","wx",0o600);} catch {throw new Error("Another save is in progress. Retry shortly.");}
  try {
   const posts=list();const previous=body.id?posts.find(post=>post.id===body.id):undefined;
   if (body.id && !previous) throw new Error("Post not found. Reload the calendar.");
   if (previous && body.version!==previous.version) throw new Error("This post changed in another tab. Reopen it before saving.");
   if(plan && previous?.approvedAt && previous.status!=="published" && previous.planVersion!==plan.version && ["approved","planned","published"].includes(String(body.status)))throw new Error("The shared plan changed. Save as Needs review and review against the current objective before approving again.");
   const draft=validatePost(body,previous);const now=new Date().toISOString();
   const post: ContentPost={...draft,...(plan&&previous?.status!=="published"?{planVersion:plan.version,planObjective:plan.objective}:{planVersion:previous?.planVersion,planObjective:previous?.planObjective}),id:previous?.id||randomUUID(),version:(previous?.version||0)+1,createdAt:previous?.createdAt||now,updatedAt:now,approvedAt:["approved","planned","published"].includes(draft.status)?previous?.approvedAt||now:null};
   const next=previous?posts.map(old=>old.id===post.id?post:old):[post,...posts];
   const temporary=file+".tmp";fs.writeFileSync(temporary,JSON.stringify({schemaVersion:1,posts:next},null,2),{mode:0o600});fs.renameSync(temporary,file);
   return post;
  } finally {fs.closeSync(lock);fs.unlinkSync(file+".lock");}
 }
 return {list,save};
}
export function localContentStore() { return createContentStore(path.join(process.cwd(),".local-content")); }
