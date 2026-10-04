export function headersFor(request:Request){
 const headers=new Headers({'Cache-Control':'no-store','Vary':'Origin'});
 const origin=request.headers.get('origin');
 if(origin && ['https://www.luun.ca','https://luun.ca'].includes(origin)){
  headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type');
 }
 return headers;
}
export function allowedStorefront(request:Request){return ['https://www.luun.ca','https://luun.ca'].includes(request.headers.get('origin')||'');}
