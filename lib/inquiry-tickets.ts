import type { JobTicket } from "./types";
export const inquiryCategories = { customer_inquiry:"Customer inquiry", warranty:"Warranty", delivery:"Delivery", returns:"Returns", other:"Other" } as const;
export const inquiryStatuses = {new:"New", answered:"Answered", waiting_on_customer:"Waiting on customer", needs_tyson:"Needs Tyson", closed:"Closed"} as const;
export type InquiryCategory = keyof typeof inquiryCategories;
export type InquiryStatus = keyof typeof inquiryStatuses;
export type InquiryTicket = JobTicket & { inquiry_category?: InquiryCategory; inquiry_status?: InquiryStatus; is_test?: boolean; last_activity_at?: string; gmail_thread_id?: string|null };
export type InquiryMessage = {id:string; ticket_id:string; provider_message_id:string; gmail_thread_id:string; direction:"inbound"|"outbound"; from_email:string; to_email:string; subject:string|null; body:string; sent_at:string};
export const isInquiryCategory = (value:unknown): value is InquiryCategory => typeof value==="string" && Object.hasOwn(inquiryCategories,value);
export const isInquiryStatus = (value:unknown): value is InquiryStatus => typeof value==="string" && Object.hasOwn(inquiryStatuses,value);
export const ticketStatus = (ticket:InquiryTicket):InquiryStatus => ticket.inquiry_status || (ticket.status==="done"?"closed":"new");
export const isTestInquiry = (name:string|null|undefined,message:string|null|undefined) => /\btest(?:ing)?\b/i.test(`${name || ""}\n${message || ""}`);
export function inquiryUpdates(value:unknown) {
 if(!value || typeof value!=="object" || Array.isArray(value)) throw new Error("Invalid update");
 const body=value as Record<string,unknown>,updates:Record<string,string|null|boolean>={};
 if(Object.keys(body).some(key=>!["status","category","notes","is_test"].includes(key))) throw new Error("Only status, category, notes and is_test can be updated");
 if(body.status!==undefined){const status=body.status==="resolved"?"closed":body.status==="unresolved"?"new":body.status;if(!isInquiryStatus(status))throw new Error("Invalid ticket status");updates.inquiry_status=status;updates.status=status==="closed"?"done":"open";}
 if(body.category!==undefined){if(!isInquiryCategory(body.category))throw new Error("Invalid inquiry category");updates.inquiry_category=body.category;}
 if(body.is_test!==undefined){if(typeof body.is_test!=="boolean")throw new Error("Invalid test flag");updates.is_test=body.is_test;}
 if(body.notes!==undefined){if(body.notes!==null&&(typeof body.notes!=="string"||body.notes.length>10000))throw new Error("Invalid notes");updates.next_step=typeof body.notes==="string"?body.notes.trim()||null:null;}
 if(!Object.keys(updates).length)throw new Error("No update supplied");
 return updates;
}
export function publicInquiry(ticket:InquiryTicket){return {...ticket,status:ticketStatus(ticket),category:ticket.inquiry_category||"customer_inquiry",notes:ticket.next_step,last_activity_at:ticket.last_activity_at||ticket.created_at,is_test:ticket.is_test??isTestInquiry(ticket.customer_name,ticket.details)};}
export function internalInquiry(ticket:ReturnType<typeof publicInquiry>):InquiryTicket {return {...ticket,status:ticket.status==="closed"?"done":"open",inquiry_status:ticket.status,category:"customer_inquiry",inquiry_category:ticket.category};}
export function parseInquiry(details:string|null|undefined) {
 const [original="", metadata=""]=(details||"").split("\n\n— Webflow inquiry —\n");
 let text=original.trim(),topic:string|null=null,order:string|null=null;
 const match=text.match(/^Topic:\s*([\s\S]*?)(?=Order:|\n|$)/i);
 if(match){topic=match[1].trim()||null;text=text.slice(match[0].length).trim();}
 if(/^Order:\s*Not provided/i.test(text)){text=text.replace(/^Order:\s*Not provided\s*/i,"");}
 else {const orderMatch=text.match(/^Order:\s*([^\n]*)(?:\n|$)/i);if(orderMatch){order=orderMatch[1].trim();text=text.slice(orderMatch[0].length).trim();}}
 if(order?.toLowerCase()==="not provided")order=null;
 const lines=metadata.split("\n").filter(Boolean).map(line=>{const i=line.indexOf(":");return {label:i<0?"Source":line.slice(0,i),value:i<0?line:line.slice(i+1).trim()};});
 return {topic,order,body:text,metadata:lines};
}
