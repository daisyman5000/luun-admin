export function canReadOperatorContext(role:string|null|undefined){return ['owner','admin','logistics','viewer'].includes(role||'');}
export function canEditContent(role:string|null|undefined){return ['owner','admin','logistics'].includes(role||'');}
export function canApproveContent(role:string|null|undefined){return role==='owner'||role==='admin';}
export function canEditBusinessPlan(role:string|null|undefined){return canApproveContent(role);}
export function requireContentWrite(role:string|null|undefined,status:unknown,previousStatus?:string){
 if(!canEditContent(role))throw new Error('Not authorized to edit content.');
 if((['approved','planned','published'].includes(String(status))||['approved','planned','published'].includes(previousStatus||''))&&!canApproveContent(role))throw new Error('Owner/admin approval is required for reviewed content.');
}
