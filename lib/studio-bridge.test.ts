import test from 'node:test';
import assert from 'node:assert/strict';
import { studioBridgeOrigin,studioRouteAllowed,studioForwardHeaders } from './studio-policy';
import { forwardStudioRequest } from './studio-bridge';
test('Studio bridge fails closed outside explicitly configured development loopback',()=>{
 const env={NODE_ENV:'development',LUUN_STUDIO_ORIGIN:'http://127.0.0.1:51406'};
 assert.equal(studioBridgeOrigin(env,'127.0.0.1:4326'),'http://127.0.0.1:51406');assert.equal(studioBridgeOrigin({...env,NODE_ENV:'production'},'127.0.0.1:4326'),null);
 for(const origin of ['https://external.invalid','http://127.0.0.1:4326','http://127.0.0.1:51406/path','http://user:password@127.0.0.1:51406'])assert.equal(studioBridgeOrigin({...env,LUUN_STUDIO_ORIGIN:origin},'127.0.0.1:4326'),null);
 assert.equal(studioBridgeOrigin(env,'public.invalid'),null);
});
test('only image operations are allowed; credentials, videos, animation and traversal are blocked',()=>{
 assert.equal(studioRouteAllowed(['generate'],'POST'),true);assert.equal(studioRouteAllowed(['assets','aaaaaaaa-aaaa'],'PATCH'),true);
 for(const [parts,method] of [[['settings'],'POST'],[['video-plans'],'POST'],[['animations'],'POST'],[['media','../credentials.json'],'GET'],[['references','aaaa'],'DELETE']] as [string[],string][])assert.equal(studioRouteAllowed(parts,method),false);
 const headers=studioForwardHeaders(new Request('http://127.0.0.1:4326/api/studio/state',{headers:{cookie:'private-admin-session',authorization:'Bearer private',host:'127.0.0.1:4326'}}),'http://127.0.0.1:51406');assert.equal(headers.get('cookie'),null);assert.equal(headers.get('authorization'),null);assert.equal(headers.get('origin'),'http://127.0.0.1:51406');
});
test('bridge uses mocked upstream only and removes irrelevant state/credential fields',async()=>{
 let calls=0;const fake=(async()=>{calls++;return Response.json({connected:true,settings:{model:'test-model',key:'never-forward',planningModel:'test'},assets:[],jobs:[],references:[],animations:[{private:'unrelated'}],videoPlans:[{}]});}) as typeof fetch;
 const result=await forwardStudioRequest(new Request('http://127.0.0.1:4326/api/studio/state'),['state'],'http://127.0.0.1:51406',fake);const data=await result.json();assert.equal(calls,1);assert.equal(data.settings.key,undefined);assert.equal(data.animations,undefined);assert.equal(data.videoPlans,undefined);
 const denied=await forwardStudioRequest(new Request('http://127.0.0.1:4326/api/studio/animations',{method:'POST'}),['animations'],'http://127.0.0.1:51406',fake);assert.equal(denied.status,404);assert.equal(calls,1);
});
