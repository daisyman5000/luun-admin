import type { buildOperatingStrategy } from './operating-strategy';
export type StrategyEvidence={id:string;label:string;value:unknown};
export function strategyRecommendationBrief(strategy:ReturnType<typeof buildOperatingStrategy>){
 const evidence:StrategyEvidence[]=[{id:'cash',label:'Recorded balances by currency',value:strategy.cashByCurrency},{id:'commitments',label:'Recorded commitments by currency',value:strategy.commitmentsByCurrency},{id:'stock',label:'Unreserved module total, not complete sofa availability',value:strategy.onHand},{id:'goal',label:'Saved objective and target',value:{objective:strategy.objective,targetDate:strategy.targetDate,comparison:strategy.comparison}},{id:'ads',label:'Saved manual daily CAD ad plan',value:strategy.adDailyBudget},{id:'warnings',label:'Missing/stale input limitations',value:strategy.warnings}];
 return {asOf:strategy.asOf,evidence,deterministicActions:strategy.actions,assumptions:strategy.assumptions,requiredOutput:'summary plus recommendations with evidenceIds, tradeoff and requiresApproval=true',forbiddenActions:['change budgets','activate sales','pay invoices','place orders','make customer promises','publish content'],executionEnabled:false};
}
export function validateStrategyRecommendation(value:unknown,brief:ReturnType<typeof strategyRecommendationBrief>){
 if(!value||typeof value!=='object')throw new Error('Recommendation must be structured.');const body=value as Record<string,unknown>;
 if(typeof body.summary!=='string'||body.summary.length>4000||!Array.isArray(body.recommendations)||body.recommendations.length>5)throw new Error('A concise summary and at most five recommendations are required.');
 const ids=new Set(brief.evidence.map(item=>item.id));
 for(const raw of body.recommendations){const item=raw as Record<string,unknown>;if(!item||typeof item.title!=='string'||typeof item.tradeoff!=='string'||item.requiresApproval!==true||!Array.isArray(item.evidenceIds)||!item.evidenceIds.length||item.evidenceIds.some(id=>typeof id!=='string'||!ids.has(id)))throw new Error('Every proposed decision needs known evidence, tradeoffs and human approval.');}
 return {summary:body.summary,recommendations:body.recommendations,executionEnabled:false};
}
