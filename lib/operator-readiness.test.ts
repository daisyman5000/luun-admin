import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectOperatorEnvironment,operatorProjectReference } from './operator-environment';
import { loginDestination } from './login-destination';
const url='https://'+operatorProjectReference+'.supabase.co';
const jwt=(payload:Record<string,unknown>)=>'test.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.fixture';
test('operator configuration accepts only confirmed project and public-key flow',()=>{
 assert.equal(inspectOperatorEnvironment({}).configured,false);
 assert.equal(inspectOperatorEnvironment({NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_fixture_only'}).configured,true);
 assert.equal(inspectOperatorEnvironment({NEXT_PUBLIC_SUPABASE_URL:'https://different-project.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_fixture_only'}).configured,false);
 assert.equal(inspectOperatorEnvironment({NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_test_fixture_only'}).configured,false);
 assert.equal(inspectOperatorEnvironment({NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt({role:'service_role',ref:operatorProjectReference})}).configured,false);
 assert.equal(inspectOperatorEnvironment({NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt({role:'anon',ref:operatorProjectReference})}).configured,true);
 assert.equal(inspectOperatorEnvironment({NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt({role:'anon',ref:'different-project'})}).configured,false);
 assert.equal(inspectOperatorEnvironment({NEXT_PUBLIC_SUPABASE_URL:'https://user:password@'+operatorProjectReference+'.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_fixture_only'}).configured,false);
});
test('normal sign-in leads to Content while safe existing deep links are retained',()=>{
 assert.equal(loginDestination(null),'/content');assert.equal(loginDestination('/data'),'/data');assert.equal(loginDestination('/demand'),'/demand');
 for(const input of ['https://attacker.invalid','//attacker.invalid','javascript:alert(1)','/\\attacker.invalid','/api/sale-control'])assert.equal(loginDestination(input),'/content');
});
