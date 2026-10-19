import {LosslessNumber,parse} from 'lossless-json';
const identifierFields=new Set(['id','user_id','recipient_id','message_id']);
/** Raw provider bytes only. No native JSON numeric conversion or unsafe fallback. */
export function instagramProviderJSON(text:string):Record<string,unknown>{
 try{
  if(Buffer.byteLength(text,'utf8')>1024*1024)throw Error();
  const result=parse(text,(key,value)=>{
   if(!(value instanceof LosslessNumber))return value;
   if(identifierFields.has(key)){if(!/^[1-9]\d{0,39}$/.test(value.value))throw Error();return value.value;}
   const number=Number(value.value);if(!Number.isFinite(number)||(Number.isInteger(number)&&!Number.isSafeInteger(number)))throw Error();return number;
  });
  if(!result||typeof result!=='object'||Array.isArray(result))throw Error();
  return result as Record<string,unknown>;
 }catch{throw Error('instagram_response_unconfirmed');}
}
