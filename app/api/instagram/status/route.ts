import {instagramHeaders,instagramOwner,instagramServer,configuredInstagramMetadata} from '@/lib/instagram/server';
import {instagramSetupIssues} from '@/lib/instagram/core';
import type {NextRequest} from 'next/server';
import {readOAuthFailure,OAUTH_DIAGNOSTIC_COOKIE} from '@/lib/instagram/oauth-diagnostics';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:NextRequest){try{await instagramOwner();}catch{return Response.json({error:'Owner/admin sign-in required.'},{status:403,headers:instagramHeaders});}
 const callbackFailure=readOAuthFailure(request.cookies.get(OAUTH_DIAGNOSTIC_COOKIE)?.value);
 try{const s=instagramServer(),c=await s.connection();return Response.json({...configuredInstagramMetadata(s.config),connected:!!c&&Date.parse(c.expires_at)>Date.now(),username:c?.username||null,expiresAt:c?.expires_at||null,scopes:c?.scopes||[],callbackFailure},{headers:instagramHeaders});}catch{return Response.json({configured:false,connected:false,publishingEnabled:false,messagesSendingEnabled:false,setupRequired:true,setupIssues:instagramSetupIssues(process.env),callbackFailure},{headers:instagramHeaders});}}
