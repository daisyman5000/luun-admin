export const briefFilename='luun-agent-brief.json';
export function briefAttachmentHeaders(){return {'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="${briefFilename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};}
export type DownloadPort={createURL:(blob:Blob)=>string;revokeURL:(url:string)=>void;clickDownload:(url:string,filename:string)=>void;later:(fn:()=>void,ms:number)=>unknown};
export async function exportBrief(url:string,port:DownloadPort,fetcher:typeof fetch=fetch){
 const response=await fetcher(url,{cache:'no-store',credentials:'same-origin'});
 if(!response.ok)throw new Error('Brief export failed. Refresh the app session and try again when ready; the in-app brief is still available.');
 if(!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')||!response.headers.get('content-disposition')?.startsWith('attachment;'))throw new Error('The server did not return a JSON attachment. Use the in-app brief.');
 let value:unknown;try{value=await response.json();}catch{throw new Error('The exported brief was not valid JSON. Use the in-app brief.');}
 if(!value||typeof value!=='object'||!('schemaVersion' in value)||!('boundaries' in value))throw new Error('The export did not contain an operating brief.');
 const objectURL=port.createURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'}));
 try{port.clickDownload(objectURL,briefFilename);}catch{port.revokeURL(objectURL);throw new Error('The browser could not start the download. View or copy the brief below.');}
 // Do not revoke immediately: Chrome can resolve an anchor download after the click returns.
 port.later(()=>port.revokeURL(objectURL),60000);
 return 'Download requested. Browser completion is not confirmed; you can also view or copy the brief below.';
}
