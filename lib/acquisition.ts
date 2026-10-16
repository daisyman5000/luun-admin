export type AcquisitionOrder={id:string;createdAt:string;currency:string;paymentStatus:string;cancelled:boolean;test:boolean;customerId:string|null;firstPaidOrderId:string|null};
export type AdEvidence={id:string;receiptId?:string;source:'receipt'|'wise';verified:boolean;merchant:'meta'|'unknown';amount:number;currency:string;kind:'charge'|'credit';serviceMonth:string|null;settledAt:string|null;settlementIds:string[]};
export type AcquisitionCoverage={receiptsComplete:boolean;fundingSourcesComplete:boolean;ordersComplete:boolean;customerHistoryComplete:boolean;adjustmentsReconciled:boolean;evidenceCheckedAt:string|null;notes:string[]};
export type AcquisitionPeriod={month:string;timeZone:string;currency:string;evidence:AdEvidence[];coverage:AcquisitionCoverage};
export const unknownAcquisitionCoverage=():AcquisitionCoverage=>({receiptsComplete:false,fundingSourcesComplete:false,ordersComplete:false,customerHistoryComplete:false,adjustmentsReconciled:false,evidenceCheckedAt:null,notes:[]});
export function validAcquisitionMonth(month:string){return /^20\d{2}-(0[1-9]|1[0-2])$/.test(month);}
export function acquisitionMonth(date:string,zone:string){const d=new Date(date);if(!Number.isFinite(d.getTime()))return null;const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit'}).formatToParts(d);return parts.find(p=>p.type==='year')!.value+'-'+parts.find(p=>p.type==='month')!.value;}
export function validateAcquisitionPeriod(value:unknown):AcquisitionPeriod{
 if(!value||typeof value!=='object')throw Error('Invalid evidence package');const p=value as AcquisitionPeriod;
 if(!validAcquisitionMonth(p.month)||!['CAD','USD'].includes(p.currency)||p.timeZone!=='America/Vancouver'||!Array.isArray(p.evidence)||p.evidence.length>10000||!p.coverage)throw Error('Invalid evidence package');
 const c=p.coverage;for(const key of ['receiptsComplete','fundingSourcesComplete','ordersComplete','customerHistoryComplete','adjustmentsReconciled'] as const)if(typeof c[key]!=='boolean')throw Error('Coverage must be explicit');
 if(!Array.isArray(c.notes)||c.notes.some(note=>typeof note!=='string'||note.length>2000)||!(c.evidenceCheckedAt===null||typeof c.evidenceCheckedAt==='string'))throw Error('Invalid coverage provenance');
 for(const e of p.evidence)if(!e||typeof e.id!=='string'||!e.id||e.id.length>300||!['receipt','wise'].includes(e.source)||typeof e.verified!=='boolean'||!['meta','unknown'].includes(e.merchant)||!Number.isFinite(e.amount)||e.amount<0||!(/^[A-Z]{3}$/.test(e.currency))||!['charge','credit'].includes(e.kind)||!(e.serviceMonth===null||validAcquisitionMonth(e.serviceMonth))||!Array.isArray(e.settlementIds)||e.settlementIds.some(id=>typeof id!=='string'||!id))throw Error('Invalid advertising evidence');
 return p;
}
export function latestCoveredAdMonth(periods:AcquisitionPeriod[],fallback:string){return [...periods].filter(period=>{try{validateAcquisitionPeriod(period);const r=calculateAcquisition(period,[]);return r.spend!==null&&r.spend>0&&period.coverage.ordersComplete;}catch{return false;}}).sort((a,b)=>b.month.localeCompare(a.month))[0]?.month||fallback;}
export function calculateAcquisition(period:AcquisitionPeriod,orders:AcquisitionOrder[]){
 validateAcquisitionPeriod(period);
 const warnings=[...period.coverage.notes];const used=new Set<string>(),receipts=new Map<string,AdEvidence>(),bank=new Map<string,AdEvidence>();let conflicts=false;
 for(const row of period.evidence){if(!row.id||!Number.isFinite(row.amount)||row.amount<0||!Array.isArray(row.settlementIds)){conflicts=true;continue;}const map=row.source==='receipt'?receipts:bank;const key=row.source==='receipt'?(row.receiptId||row.id):row.id;const prior=map.get(key);if(prior){if(JSON.stringify({...prior,id:''})!==JSON.stringify({...row,id:''}))conflicts=true;}else map.set(key,row);}
 let matchedSpend=0,receiptCount=0,unmatchedReceipts=0,unassignedPeriods=0,otherCurrency=0,settlementSpend=0,unclassifiedPayments=0;const matchedIds:string[]=[];
 for(const row of receipts.values()){
  if(!row.verified||row.merchant!=='meta'){if(row.serviceMonth===period.month)unmatchedReceipts++;continue;}
  const linked=row.settlementIds.map(id=>bank.get(id)).filter((r):r is AdEvidence=>!!r);
  // Receipt and funding debit describe one cost. A bank match is supporting evidence only.
  for(const id of row.settlementIds){if(used.has(id))conflicts=true;used.add(id);}
  if(row.serviceMonth!==period.month){if(!row.serviceMonth)unassignedPeriods++;continue;}
  if(row.currency!==period.currency){otherCurrency++;continue;}
  const linksValid=linked.length>0&&linked.length===row.settlementIds.length&&linked.every(r=>r.verified&&r.kind===row.kind);
  const sameCurrency=linksValid&&linked.every(r=>r.currency===row.currency);
  const amountMatches=linksValid&&sameCurrency&&Math.abs(linked.reduce((sum,r)=>sum+r.amount,0)-row.amount)<0.011;
  if(!linksValid||!amountMatches){unmatchedReceipts++;continue;}
  matchedSpend+=(row.kind==='credit'?-1:1)*row.amount;receiptCount++;matchedIds.push(row.receiptId||row.id);
 }
 for(const row of bank.values()){
  if(!row.settledAt||acquisitionMonth(row.settledAt,period.timeZone)!==period.month||used.has(row.id))continue;
  if(row.currency!==period.currency){if(row.merchant==='meta')otherCurrency++;continue;}
  if(row.verified&&row.merchant==='meta')settlementSpend+=(row.kind==='credit'?-1:1)*row.amount;else unclassifiedPayments++;
 }
 if(unmatchedReceipts)warnings.push(`${unmatchedReceipts} ad receipts lack a verified matching settlement or have an amount mismatch.`);
 if(otherCurrency)warnings.push(`${otherCurrency} ad receipts use another currency; no exchange rate is invented.`);
 if(unassignedPeriods)warnings.push('Advertising receipts or credits with no service month require reconciliation.');
 if(conflicts)warnings.push('Conflicting duplicate evidence or reused settlements require reconciliation.');
 if(settlementSpend!==0)warnings.push('Recognized bank ad payments without service-period receipts are shown separately and excluded from service-period acquisition cost.');
 if(unclassifiedPayments)warnings.push(`${unclassifiedPayments} unmatched bank payments are unclassified; PayPal alone is not proof of advertising.`);
 const coverage=period.coverage;
 if(!coverage.receiptsComplete)warnings.push('Ad receipt coverage is not confirmed complete for this service month.');
 if(!coverage.fundingSourcesComplete)warnings.push('Funding-source coverage is incomplete; possible TD Visa or other account spending is not zero.');
 if(!coverage.ordersComplete)warnings.push('Shopify order coverage is not confirmed complete for this month.');
 if(!coverage.adjustmentsReconciled)warnings.push('Refunds, cancellations and advertising credits are not fully reconciled.');
 if(!coverage.evidenceCheckedAt||!Number.isFinite(Date.parse(coverage.evidenceCheckedAt)))warnings.push('Evidence review timestamp is missing.');
 const seen=new Set<string>();let duplicateOrderConflict=false;const validOrders:AcquisitionOrder[]=[];
 for(const row of orders){if(seen.has(row.id)){duplicateOrderConflict=true;continue;}seen.add(row.id);if(acquisitionMonth(row.createdAt,period.timeZone)===period.month&&row.currency===period.currency&&['PAID','PARTIALLY_REFUNDED'].includes(row.paymentStatus.toUpperCase())&&!row.cancelled&&!row.test)validOrders.push(row);}
 if(duplicateOrderConflict)warnings.push('Duplicate Shopify orders require reconciliation.');
 const newCustomers=new Set<string>();let customerUnknown=false;
 for(const row of validOrders){if(!row.customerId||!row.firstPaidOrderId)customerUnknown=true;else if(row.firstPaidOrderId===row.id)newCustomers.add(row.customerId);}
 const spendComplete=coverage.receiptsComplete&&coverage.fundingSourcesComplete&&coverage.adjustmentsReconciled&&!!coverage.evidenceCheckedAt&&Number.isFinite(Date.parse(coverage.evidenceCheckedAt))&&!conflicts&&!unmatchedReceipts&&!otherCurrency&&!unassignedPeriods&&settlementSpend===0&&matchedSpend>=0;
 const ordersComplete=coverage.ordersComplete&&!duplicateOrderConflict;
 const customersComplete=ordersComplete&&coverage.customerHistoryComplete&&!customerUnknown;
 if(!customersComplete)warnings.push('First-time customer history is unavailable or incomplete; orders are not labelled as acquired customers.');
 const label=customersComplete?'Blended customer acquisition cost':'Ad cost per paid order';const denominator=customersComplete?newCustomers.size:validOrders.length;
 const value=spendComplete&&ordersComplete&&denominator>0?matchedSpend/denominator:null;
 return {month:period.month,timeZone:period.timeZone,currency:period.currency,label,value,costBasis:'Gross matched advertising charges including tax, less matched credits; no tax recoverability assumed.',status:!spendComplete||!ordersComplete?'incomplete':denominator===0?'no_denominator':matchedSpend===0?'verified_zero_spend':'covered',matchedSpend,spend:spendComplete?matchedSpend:null,paidOrders:ordersComplete?validOrders.length:null,observedPaidOrders:validOrders.length,newCustomers:customersComplete?newCustomers.size:null,receiptCount,matchedReceiptIds:matchedIds,unallocatedBankAdPayments:settlementSpend,unclassifiedPayments,warnings,evidenceCheckedAt:coverage.evidenceCheckedAt,limitations:['Monthly blended comparison, not campaign attribution or incremental causality.','Ad service month and order month are aligned; conversion lag across months is not modelled.','Partially refunded orders retain one acquisition; fully refunded, cancelled, test and unpaid orders are excluded.','Only explicitly matched advertising receipts are counted; receipt and settlement are never added together.']};
}
export type AcquisitionResult=ReturnType<typeof calculateAcquisition>;
