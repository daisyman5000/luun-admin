import type { JobTicket } from "./types";
export const inquiryCategories = { customer_inquiry:"Customer inquiry", warranty:"Warranty", delivery:"Delivery", returns:"Returns", other:"Other" } as const;
export type InquiryCategory = keyof typeof inquiryCategories;
export type InquiryTicket = JobTicket & { inquiry_category?: InquiryCategory };
export const isInquiryCategory = (value:unknown): value is InquiryCategory => typeof value==="string" && Object.hasOwn(inquiryCategories,value);
export function inquiryUpdates(value:unknown) {
 if(!value || typeof value!=="object" || Array.isArray(value)) throw new Error("Invalid update");
 const body=value as Record<string,unknown>,updates:Record<string,string|null>={};
 if(Object.keys(body).some(key=>!["status","category","notes"].includes(key))) throw new Error("Only status, category and notes can be updated");
 if(body.status!==undefined){if(!["unresolved","resolved"].includes(String(body.status)))throw new Error("Use unresolved or resolved");updates.status=body.status==="resolved"?"done":"open";}
 if(body.category!==undefined){if(!isInquiryCategory(body.category))throw new Error("Invalid inquiry category");updates.inquiry_category=body.category;}
 if(body.notes!==undefined){if(body.notes!==null&&(typeof body.notes!=="string"||body.notes.length>10000))throw new Error("Invalid notes");updates.next_step=typeof body.notes==="string"?body.notes.trim()||null:null;}
 if(!Object.keys(updates).length)throw new Error("No update supplied");
 return updates;
}
export function publicInquiry(ticket:InquiryTicket){return {...ticket,status:ticket.status==="done"?"resolved" as const:"unresolved" as const,category:ticket.inquiry_category||"customer_inquiry",notes:ticket.next_step};}

export function internalInquiry(ticket:ReturnType<typeof publicInquiry>):InquiryTicket {return {...ticket,status:ticket.status==="resolved"?"done":"open",category:"customer_inquiry",inquiry_category:ticket.category};}
