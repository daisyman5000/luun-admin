import test from 'node:test';import assert from 'node:assert/strict';
import {instagramProviderJSON} from './provider-json';
test('raw numeric identifiers retain every digit in flat/nested responses while expiry stays numeric',()=>{
 for(const literal of ['9001','10200000000000001','9007199254740993','9999999999999999999999999999999999999999']){
  const raw=`{"id":${literal},"user_id":${literal},"message_id":${literal},"recipient_id":${literal},"expires_in":5183944}`;
  const parsed=instagramProviderJSON(raw);for(const key of ['id','user_id','message_id','recipient_id'])assert.equal(parsed[key],literal);assert.equal(parsed.expires_in,5183944);
  const nested=instagramProviderJSON(`{"data":[${raw}]}`) as {data:Record<string,unknown>[]};assert.equal(nested.data[0].user_id,literal);
 }
 assert.notEqual(String(JSON.parse('{"id":10200000000000001}').id),'10200000000000001');
});
test('quoted strings and token text are preserved without interpreting ID-like substrings',()=>{
 const p=instagramProviderJSON('{"user_id":"10200000000000001","access_token":"SYNTHETIC id:10200000000000001 \\\"user_id\\\":17"}');assert.equal(p.user_id,'10200000000000001');assert.equal(p.access_token,'SYNTHETIC id:10200000000000001 "user_id":17');
});
test('bad numeric ID syntax, conflicting duplicates, invalid JSON and excessive bodies reject without payload leakage',()=>{
 for(const raw of ['{"id":1.5}','{"id":1e16}','{"id":-17}','{"id":0}','{"id":99999999999999999999999999999999999999999}','{"id":10200000000000001,"id":10200000000000002}','{"user_id":','{"access_token":"SYNTHETIC_PRIVATE_VALUE",}','{"id":NaN}','[]','null',' '.repeat(1048577)])assert.throws(()=>instagramProviderJSON(raw),error=>error instanceof Error&&error.message==='instagram_response_unconfirmed');
});
test('ordinary objects cannot impersonate the lossless numeric class or pollute prototypes',()=>{
 const p=instagramProviderJSON('{"user_id":{"isLosslessNumber":true,"value":"10200000000000001"},"__proto__":{"polluted":true}}');assert.equal(typeof p.user_id,'object');assert.equal(Object.hasOwn(Object.prototype,'polluted'),false);
});
