import fs from "node:fs";
import { localMediaRequestAllowed } from "@/lib/local-content";
import { installedCreativeLibrary } from "@/lib/creative-library";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 if(!localMediaRequestAllowed(request))return new Response(null,{status:404});
 try{const {id}=await context.params;const media=installedCreativeLibrary().resolve(id);const ext=media.file.split(".").pop();const mime=ext==="mp4"?"video/mp4":ext==="jpg"||ext==="jpeg"?"image/jpeg":"image/"+ext;
 return new Response(fs.readFileSync(media.file),{headers:{"Content-Type":mime,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'"}});
 }catch{return new Response(null,{status:404});}
}
