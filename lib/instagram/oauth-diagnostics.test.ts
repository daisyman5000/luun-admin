import test from 'node:test';
import assert from 'node:assert/strict';
import {oauthFailure,readOAuthFailure,type OAuthStage} from './oauth-diagnostics';
import {InstagramClient} from './client';
import {consumeOAuthCallback,INSTAGRAM_CALLBACK,INSTAGRAM_SCOPES,type InstagramConfig} from './core';
const config:InstagramConfig={appId:'7001',accountId:'9001',appSecret:'synthetic-secret',key:Buffer.alloc(32,7).toString('base64'),apiVersion:'v24.0',redirectUri:INSTAGRAM_CALLBACK};
const short={access_token:'synthetic-short',user_id:'9001',permissions:[...INSTAGRAM_SCOPES]},long={access_token:'synthetic-long',expires_in:3600},profile={user_id:'9001',username:'synthetic-account'};
test('diagnostics discard arbitrary error messages, extra fields and malformed cookies',()=>{
 const secret='SYNTHETIC_PRIVATE_VALUE';assert.deepEqual(oauthFailure('profile',new Error(secret)),{stage:'profile',reason:'unexpected_failure'});
 assert.equal(readOAuthFailure(JSON.stringify({stage:'profile',reason:secret})),null);
 assert.equal(readOAuthFailure(JSON.stringify({stage:'profile',reason:'account_mismatch',token:secret})),null);
 for(const raw of ['null','[]','{}','not-json','x'.repeat(257)])assert.equal(readOAuthFailure(raw),null);
 assert.deepEqual(readOAuthFailure(JSON.stringify(oauthFailure('connection_storage',new Error('instagram_storage_unavailable')))),{stage:'connection_storage',reason:'storage_unavailable'});
});
test('mocked exchange failures identify the stage and fixed category without provider data',async()=>{
 const cases:[unknown[],OAuthStage,string][]=[
  [[new Response('SYNTHETIC_PROVIDER_DETAIL',{status:400})],'short_token','provider_rejected'],
  [[new Response('invalid-json')],'short_token','provider_response_unconfirmed'],
  [[{data:[]}],'short_token','provider_response_unconfirmed'],
  [[{...short,access_token:undefined}],'short_token','provider_response_unconfirmed'],
  [[{...short,permissions:['instagram_business_basic']}],'permissions','permissions_incomplete'],
  [[{...short,user_id:'9002'}],'account_match','account_mismatch'],
  [[short,new Response('SYNTHETIC_PROVIDER_DETAIL',{status:401})],'long_token','provider_auth_rejected'],
  [[short,{access_token:'synthetic-long',expires_in:0}],'long_token','token_response_unconfirmed'],
  [[short,long,{...profile,user_id:'9002'}],'profile','account_mismatch']
 ];
 for(const [responses,expectedStage,reason]of cases){let stage:OAuthStage='unknown';const send=(async()=>{const value=responses.shift();return value instanceof Response?value:Response.json(value);}) as typeof fetch;
  await assert.rejects(new InstagramClient(config,send).exchange('synthetic-code',s=>{stage=s;}),error=>{assert.deepEqual(oauthFailure(stage,error),{stage:expectedStage,reason});assert.ok(!JSON.stringify(oauthFailure(stage,error)).includes('SYNTHETIC_PROVIDER_DETAIL'));return true;});
 }
});
test('state, replay, provider-error and missing-code failures remain distinguishable and fail closed',async()=>{
 const state='a'.repeat(64),cases:[URLSearchParams,string|undefined,boolean,string][]=[
  [new URLSearchParams({state,code:'synthetic'}),undefined,true,'state_invalid'],
  [new URLSearchParams({state,code:'synthetic'}),state,false,'state_expired_or_used'],
  [new URLSearchParams({state,error:'SYNTHETIC_PROVIDER_DETAIL'}),state,true,'provider_authorization_error'],
  [new URLSearchParams({state}),state,true,'code_missing_or_invalid']
 ];
 for(const [params,cookie,consumed,reason]of cases)await assert.rejects(consumeOAuthCallback(params,cookie,'synthetic-owner',async()=>consumed),error=>{assert.deepEqual(oauthFailure('state_validation',error),{stage:'state_validation',reason});return true;});
});
