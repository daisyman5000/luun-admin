import {validOperatorOrigin} from '@/lib/content-access';
import {publicationSnapshot,snapshotHash} from '@/lib/instagram/core';
import {instagramHeaders,instagramOwner,instagramServer} from '@/lib/instagram/server';
export const runtime='nodejs';
export async function POST(request:Request){if(!validOperatorOrigin(request))return Response.json({error:'Use the signed-in calendar.'},{status:403,headers:instagramHeaders});
 try{const actor=await instagramOwner(),s=instagramServer();const text=await request.text();if(text.length>1000)throw Error();const body=JSON.parse(text);if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id)||!Number.isInteger(body.version))throw Error();
  const post=await s.currentPost(body.id);if(post.version!==body.version)throw Error();const c=await s.connection();if(!c||Date.parse(c.expires_at)<=Date.now())throw Error();
  const media=await s.media(post.assetReference.replace(/^instagram-media:/,'')),snapshot=publicationSnapshot(post,media,s.config.accountId);const job=await s.rpc('enqueue_instagram_publish_job',{p_actor:actor,p_snapshot:snapshot,p_hash:snapshotHash(snapshot)});return Response.json({job,status:'Scheduled',publishingEnabled:process.env.INSTAGRAM_PUBLISHING_ENABLED==='1'},{headers:instagramHeaders});
 }catch{return Response.json({error:'Unable to schedule. Connect Instagram, upload and review the JPEG/caption/time, save approval, then schedule the current version.'},{status:409,headers:instagramHeaders});}}
