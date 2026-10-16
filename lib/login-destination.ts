const destinations=new Set(['/','/content','/demand','/ticketing','/back-office','/data','/inventory','/forecasting','/forecasting/containers','/forecasting/calendar','/settings/users','/daily-plan','/voice-codex','/jobs','/cac','/financials']);
export function loginDestination(value:string|null){return value&&destinations.has(value)?value:'/content';}
