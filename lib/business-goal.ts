export type BusinessGoal={metric:'cash_reserve'|'paid_orders';amount:number;currency:'CAD'|'USD'};
export function readBusinessGoal(value:unknown):BusinessGoal|null{
 if(!value||typeof value!=='object')return null;const goal=value as Record<string,unknown>;
 if(!['cash_reserve','paid_orders'].includes(String(goal.metric))||typeof goal.amount!=='number'||!Number.isFinite(goal.amount)||goal.amount<0||goal.amount>100000000||!['CAD','USD'].includes(String(goal.currency))||(goal.metric==='paid_orders'&&(!Number.isInteger(goal.amount)||goal.amount<1||goal.currency!=='CAD')))return null;
 return goal as BusinessGoal;
}
export function readDailyAdBudget(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=5000?value:null;}
