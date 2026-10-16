import type {WiseBalanceSummary} from './client';
export type AccountGroup='corporate'|'personal'|'unclassified';
export function accountGroup(type:string):AccountGroup{const value=type.toLowerCase();return ['business','corporate','company'].includes(value)?'corporate':value==='personal'?'personal':'unclassified';}
export function groupWiseBalances(balances:WiseBalanceSummary[]){
 return (['corporate','personal','unclassified'] as const).map(group=>{const rows=balances.filter(b=>accountGroup(b.profileType)===group);const totals:Record<string,number>={};for(const row of rows)if(/^[A-Z]{3}$/.test(row.currency)&&Number.isFinite(row.amount))totals[row.currency]=(totals[row.currency]||0)+row.amount;return {group,accountCount:rows.length,totals};}).filter(g=>g.accountCount>0);
}
