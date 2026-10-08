import { NextResponse } from "next/server";
import { getJobsApiContext } from "@/lib/auth";
import { normalizeInquiryMessage } from "@/lib/inquiry-message";
export async function POST(request:Request){
 const auth=await getJobsApiContext(request.headers.get("authorization"));if(auth.kind!=="bot")return NextResponse.json({error:"Private bot access required"},{status:401});
 let message;try{const raw=await request.text();if(raw.length>120000)throw new Error("Message too large");message=normalizeInquiryMessage(JSON.parse(raw));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Invalid message"},{status:400});}
 const {data:existing,error:duplicateError}=await auth.supabase.from("inquiry_messages").select("ticket_id").eq("provider_message_id",message.provider_message_id).maybeSingle();
 if(duplicateError)return NextResponse.json({error:"Message storage unavailable"},{status:503});if(existing)return NextResponse.json({ticket_id:existing.ticket_id,duplicate:true});
 const {data:linked,error:linkError}=await auth.supabase.from("inquiry_messages").select("ticket_id").eq("gmail_thread_id",message.gmail_thread_id).order("sent_at",{ascending:false}).limit(1);
 if(linkError)return NextResponse.json({error:"Unable to match Gmail thread"},{status:503});
 const {data:tickets,error}=await auth.supabase.from("job_tickets").select("id,inquiry_status,created_at").eq("category","customer_inquiry").eq("customer_email",message.customer_email).order("created_at",{ascending:false}).limit(50);
 if(error)return NextResponse.json({error:"Unable to match ticket"},{status:503});
 let threadTicket:null|{id:string}=null;
 if(linked?.[0]){const result=await auth.supabase.from("job_tickets").select("id").eq("id",linked[0].ticket_id).eq("category","customer_inquiry").eq("customer_email",message.customer_email).maybeSingle();if(result.error)return NextResponse.json({error:"Unable to match Gmail ticket"},{status:503});threadTicket=result.data;}
 const ticket=threadTicket||tickets?.find(row=>row.inquiry_status!=="closed")||tickets?.[0];
 if(!ticket)return NextResponse.json({error:"No ticket matches this customer email"},{status:404});
 const {customer_email: _email,...row}=message;void _email;
 const {error:insertError}=await auth.supabase.from("inquiry_messages").upsert({...row,ticket_id:ticket.id},{onConflict:"provider_message_id",ignoreDuplicates:true});
 if(insertError)return NextResponse.json({error:"Unable to store message"},{status:503});
 return NextResponse.json({ticket_id:ticket.id});
}

export async function GET(request:Request){
 const auth=await getJobsApiContext(request.headers.get("authorization"));if(auth.kind!=="bot")return NextResponse.json({error:"Private bot access required"},{status:401});
 const offset=Number(new URL(request.url).searchParams.get("offset")||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)return NextResponse.json({error:"Invalid offset"},{status:400});
 const {data,error}=await auth.supabase.from("job_tickets").select("id,customer_email,gmail_thread_id").eq("category","customer_inquiry").eq("is_test",false).not("customer_email","is",null).order("id").range(offset,offset+500);
 if(error)return NextResponse.json({error:"Unable to load email targets"},{status:503});
 return NextResponse.json({tickets:(data||[]).slice(0,500),hasMore:(data||[]).length>500},{headers:{"Cache-Control":"private, no-store"}});
}
