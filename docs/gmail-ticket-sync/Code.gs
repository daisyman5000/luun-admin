// Run only as team@luun.ca. This script reads mail; it cannot send or delete it.
// Set BOT_TOKEN in Script Properties to the existing Luun private bot key.
const LUUN_ADMIN = 'https://luun-admin-et42.vercel.app';
function luunRequest(path, body) {
  const token=PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if(!token)throw new Error('Set BOT_TOKEN in Script Properties before connecting');
  const response=UrlFetchApp.fetch(LUUN_ADMIN+path,{method:body?'post':'get',contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:body?JSON.stringify(body):undefined,muteHttpExceptions:true});
  const code=response.getResponseCode();
  if(code===404)return null;
  if(code<200||code>=300)throw new Error('Luun ticket import failed ('+code+')');
  return JSON.parse(response.getContentText());
}
function gmailRequest(path) {
  const response=UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('Gmail read failed ('+response.getResponseCode()+')');
  return JSON.parse(response.getContentText());
}
function mailboxAddress(value){const match=String(value||'').match(/[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);return match?match[0].toLowerCase():'';}
function messageText(payload) {
  if(payload.mimeType==='text/plain'&&payload.body&&payload.body.data)return Utilities.newBlob(Utilities.base64DecodeWebSafe(payload.body.data)).getDataAsString('UTF-8');
  const parts=payload.parts||[];
  for(const part of parts){if(part.filename)continue;const result=messageText(part);if(result)return result;}
  if(payload.mimeType==='text/html'&&payload.body&&payload.body.data)return Utilities.newBlob(Utilities.base64DecodeWebSafe(payload.body.data)).getDataAsString('UTF-8').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  return '';
}
function syncLuunTickets() {
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try{
    if(gmailRequest('profile').emailAddress.toLowerCase()!=='team@luun.ca')throw new Error('Sign in as team@luun.ca before running this connection');
    let targets=[],offset=0,page;
    do{page=luunRequest('/api/inquiries/messages?offset='+offset);targets=targets.concat(page.tickets);offset+=500;}while(page.hasMore);
    const emails=[...new Set(targets.map(row=>row.customer_email).filter(email=>email&&email!=='team@luun.ca'))];
    const props=PropertiesService.getScriptProperties();let customerCursor=Number(props.getProperty('CUSTOMER_CURSOR')||0);
    const batch=emails.slice(customerCursor,customerCursor+20);
    for(const customer of batch){
      const q='(from:'+customer+' to:'+customer+') newer_than:30d -in:spam -in:trash';
      const cursorKey='PAGE_'+Utilities.base64EncodeWebSafe(customer).slice(0,160);
      const gmailPage=gmailRequest('messages?maxResults=50&q='+encodeURIComponent(q)+(props.getProperty(cursorKey)?'&pageToken='+encodeURIComponent(props.getProperty(cursorKey)):''));
      const messages=(gmailPage.messages||[]).map(row=>gmailRequest('messages/'+row.id+'?format=full')).sort((a,b)=>Number(a.internalDate)-Number(b.internalDate));
      for(const message of messages){
        const headers=Object.fromEntries((message.payload.headers||[]).map(header=>[header.name.toLowerCase(),header.value]));
        const from=mailboxAddress(headers.from),to=mailboxAddress(headers.to);
        if(!((from==='team@luun.ca'&&to===customer)||(from===customer&&to==='team@luun.ca')))continue;
        const body=messageText(message.payload);if(!body.trim())continue;
        luunRequest('/api/inquiries/messages',{provider_message_id:'gmail:'+message.id,gmail_thread_id:message.threadId,from_email:from,to_email:to,subject:headers.subject||'',body:body.slice(0,100000),sent_at:new Date(Number(message.internalDate)).toISOString()});
      }
      if(gmailPage.nextPageToken){props.setProperty(cursorKey,gmailPage.nextPageToken);break;}else{props.deleteProperty(cursorKey);customerCursor++;}
    }
    props.setProperty('CUSTOMER_CURSOR',String(customerCursor>=emails.length?0:customerCursor));
  }finally{lock.releaseLock();}
}
function connectLuunTickets(){
  syncLuunTickets();
  if(!ScriptApp.getProjectTriggers().some(trigger=>trigger.getHandlerFunction()==='syncLuunTickets'))ScriptApp.newTrigger('syncLuunTickets').timeBased().everyMinutes(1).create();
}
