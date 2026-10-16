import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {WiseCashSummary} from '../../components/wise-cash-summary';
import {readWiseSummary} from './summary';
const now=Date.parse('2026-10-16T18:00:00Z');
async function fixture(amount=0,statementFails=false){return readWiseSummary({configured:true,lookbackDays:30,clock:()=>now,read:async<T,>(path:string):Promise<T>=>{if(path==='/profiles')return [{id:1}] as T;if(path.includes('/balances?'))return [{id:1,currency:'CAD',availableAmount:{value:amount}},{id:2,currency:'USD',availableAmount:{value:25}}] as T;if(statementFails)throw Error('synthetic failure');return {transactions:[]} as T;}});}
test('cash card renders explicit zero and currencies independently with retrieval timestamp',async()=>{const html=renderToStaticMarkup(<WiseCashSummary summary={await fixture()} now={now}/>);assert.match(html,/Wise cash summary/);assert.match(html,/CAD/);assert.match(html,/USD/);assert.match(html,/\$0/);assert.match(html,/2026-10-16T18:00:00.000Z/);assert.doesNotMatch(html,/no zero balance is assumed/);});
test('statement failure does not hide real cash on the rendered card',async()=>{const html=renderToStaticMarkup(<WiseCashSummary summary={await fixture(100,true)} now={now}/>);assert.match(html,/100/);assert.match(html,/Statements: error/);assert.doesNotMatch(html,/no zero balance is assumed/);});
test('missing and stale cash render unavailable rather than a current zero',async()=>{const html=renderToStaticMarkup(<WiseCashSummary summary={null} now={now}/>);assert.match(html,/Unavailable/);assert.match(html,/no zero balance is assumed/);const stale=renderToStaticMarkup(<WiseCashSummary summary={await fixture(100)} now={now+300001}/>);assert.match(stale,/Stale snapshot/);assert.match(stale,/no zero balance is assumed/);assert.doesNotMatch(stale,/\$100/);});

test('partial cash card shows returned currency amounts with an incomplete warning',async()=>{const s=await fixture(100);s.sources.balances.status='partial';s.sources.balances.failedReads=1;const html=renderToStaticMarkup(<WiseCashSummary summary={s} now={now}/>);assert.match(html,/Partial balances/);assert.match(html,/100/);assert.match(html,/cannot establish complete cash coverage/);});
