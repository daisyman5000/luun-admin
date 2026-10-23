import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real submit handler with fixture auth; never contact a live service.
const source=fs.readFileSync(new URL('../components/login-form.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function fixture(signIn,configureError=false){
  const state=[],navigation=[];let cursor=0;
  const jsx=(type,props)=>({type,props});
  const modules={
    react:{useState:initial=>{const index=cursor++;if(!(index in state))state[index]=initial;return [state[index],value=>{state[index]=value;}];}},
    'react/jsx-runtime':{jsx,jsxs:jsx},
    'next/navigation':{useRouter:()=>({replace:value=>navigation.push(value),refresh:()=>navigation.push('refresh')}),useSearchParams:()=>new URLSearchParams('redirectedFrom=%2Fdata')},
    '@/lib/login-destination':{loginDestination:value=>value},
    '@/lib/supabase/browser':{createClient:()=>{if(configureError)throw Error('fixture config error');return {auth:{signInWithPassword:signIn}};}},
    '@/lib/supabase/public-config':{hasSupabasePublicConfig:()=>true}
  };
  const exports={};vm.runInNewContext(compiled,{exports,require:name=>{assert.ok(name in modules,name);return modules[name];}});
  function render(){cursor=0;return exports.LoginForm();}
  const form=render();
  return {state,navigation,render,submit:()=>form.props.onSubmit({preventDefault(){}})};
}
test('rejected sign-in clears busy state, announces a safe error and permits retry',async()=>{
  let calls=0;const f=fixture(async()=>{if(++calls===1)throw Error('private provider detail');return {error:null};});
  await f.submit();assert.equal(f.state[3],false);assert.equal(f.state[2],'Unable to sign in. Check your connection and try again.');assert.deepEqual(f.navigation,[]);
  const view=f.render(),children=view.props.children,alert=children.find(x=>x&&x.type==='p');assert.equal(alert.props.role,'alert');assert.equal(children.at(-1).props.disabled,false);
  await view.props.onSubmit({preventDefault(){}});assert.deepEqual(f.navigation,['/data','refresh']);assert.equal(f.state[3],false);
});
test('returned authentication error stays visible without redirecting',async()=>{
  const f=fixture(async()=>({error:{message:'Invalid login credentials'}}));await f.submit();assert.equal(f.state[2],'Invalid login credentials');assert.equal(f.state[3],false);assert.deepEqual(f.navigation,[]);
});
test('missing configuration releases the button state without calling auth',async()=>{
  const f=fixture(()=>assert.fail('auth must not run'),true);await f.submit();assert.equal(f.state[2],'This workspace connection is not configured yet.');assert.equal(f.state[3],false);assert.deepEqual(f.navigation,[]);
});
