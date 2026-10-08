export function normalizeInquiryMessage(input:unknown){
 if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Invalid message");
 const value=input as Record<string,unknown>;
 const email=(field:unknown)=>{if(typeof field!=="string")throw new Error("Email is required");const result=field.trim().toLowerCase();if(result.length>320||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))throw new Error("Invalid email");return result;};
 if(typeof value.gmail_thread_id!=="string"||! /^[a-f0-9]{8,64}$/i.test(value.gmail_thread_id))throw new Error("Gmail thread ID required");
 const from=email(value.from_email),to=email(value.to_email);
 if((from==="team@luun.ca")===(to==="team@luun.ca"))throw new Error("Message must be between team@luun.ca and a customer");
 if(typeof value.provider_message_id!=="string"||!value.provider_message_id.trim()||value.provider_message_id.length>500)throw new Error("Provider message ID required");
 if(typeof value.body!=="string"||!value.body.trim()||value.body.length>100000)throw new Error("Message body required");
 if(typeof value.sent_at!=="string"||!Number.isFinite(Date.parse(value.sent_at))||Date.parse(value.sent_at)>Date.now()+300000)throw new Error("Invalid message date");
 if(value.subject!==undefined&&(typeof value.subject!=="string"||value.subject.length>1000))throw new Error("Invalid subject");
 return {gmail_thread_id:value.gmail_thread_id,provider_message_id:value.provider_message_id.trim(),direction:from==="team@luun.ca"?"outbound" as const:"inbound" as const,from_email:from,to_email:to,subject:typeof value.subject==="string"?value.subject:null,body:value.body.trim(),sent_at:new Date(value.sent_at).toISOString(),customer_email:from==="team@luun.ca"?to:from};
}
