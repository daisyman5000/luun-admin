// Existing signed-in JSON contract: no credential forwarding, no cross-origin exemption.
export function workspaceJsonOptions(){return {method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:'{}'} as const;}
export function validWorkspaceJsonOrigin(request:Request){try{const origin=new URL(request.headers.get('origin')||'');return origin.host===request.headers.get('host')&&['http:','https:'].includes(origin.protocol)&&!!request.headers.get('content-type')?.startsWith('application/json');}catch{return false;}}
