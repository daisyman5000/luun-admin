export function operatorTimeZone(value:string|undefined){try{if(!value||value.length>100)return 'UTC';return new Intl.DateTimeFormat('en',{timeZone:value}).resolvedOptions().timeZone;}catch{return 'UTC';}}
export function operatorDate(value:string|number,timeZone='UTC'){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
 const parts=new Intl.DateTimeFormat('en',{timeZone:operatorTimeZone(timeZone),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const get=(type:string)=>parts.find(p=>p.type===type)?.value;return `${get('year')}-${get('month')}-${get('day')}`;
}
