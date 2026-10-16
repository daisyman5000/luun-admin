import { localMediaRequestAllowed } from "@/lib/local-content";
import { installedCreativeLibrary } from "@/lib/creative-library";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!localMediaRequestAllowed(request))return Response.json({error:"Creative Lab linkage is local-only."},{status:503});
 try{return Response.json({assets:installedCreativeLibrary().list(),source:"Creative Lab",readOnly:true},{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"Creative Lab library is unavailable on this Mac. Existing post references are preserved."},{status:503});}
}
