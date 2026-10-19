import {instagramHeaders,instagramOwner,instagramServer,configuredInstagramMetadata} from '@/lib/instagram/server';
import {instagramSetupIssues} from '@/lib/instagram/core';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{await instagramOwner();}catch{return Response.json({error:'Owner/admin sign-in required.'},{status:403,headers:instagramHeaders});}
 try{const s=instagramServer(),c=await s.connection();return Response.json({...configuredInstagramMetadata(s.config),connected:!!c&&Date.parse(c.expires_at)>Date.now(),username:c?.username||null,expiresAt:c?.expires_at||null,scopes:c?.scopes||[]},{headers:instagramHeaders});}catch{return Response.json({configured:false,connected:false,publishingEnabled:false,messagesSendingEnabled:false,setupRequired:true,setupIssues:instagramSetupIssues(process.env)},{headers:instagramHeaders});}}
