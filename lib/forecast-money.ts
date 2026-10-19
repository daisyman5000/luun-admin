/** Forecast cash transactions settle in CAD cents, including converted invoices. */
export const cashCents=(amount:number)=>Math.sign(amount)*Math.round((Math.abs(amount)+Number.EPSILON*Math.max(1,Math.abs(amount)))*100);
export const cashAmount=(cents:number)=>cents/100;
export const roundCash=(amount:number)=>cashAmount(cashCents(amount));
/** Split one cash amount without losing or creating a cent between recipients. */
export function allocateCash(total:number,weights:readonly number[]){
 const sum=weights.reduce((n,w)=>n+Math.max(0,w),0),cents=cashCents(total);let weight=0,assigned=0;
 return weights.map(w=>{weight+=Math.max(0,w);const cumulative=sum?Math.round(cents*weight/sum):0,amount=cumulative-assigned;assigned=cumulative;return cashAmount(amount);});
}
