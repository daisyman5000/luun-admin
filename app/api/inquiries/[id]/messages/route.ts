import { NextResponse } from "next/server";
import { getJobsApiContext } from "@/lib/auth";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await getJobsApiContext(request.headers.get("authorization"));if(auth.kind==="unauthenticated")return NextResponse.json({error:"Authentication required"},{status:401});
 const {id}=await params;if(!/^[\da-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid ticket"},{status:400});
 const {data:ticket,error:ticketError}=await auth.supabase.from("job_tickets").select("id").eq("id",id).eq("category","customer_inquiry").maybeSingle();
 if(ticketError)return NextResponse.json({error:"Unable to read ticket"},{status:500});if(!ticket)return NextResponse.json({error:"Ticket not found"},{status:404});
 const {data,error}=await auth.supabase.from("inquiry_messages").select("*").eq("ticket_id",id).order("sent_at",{ascending:true}).order("id",{ascending:true}).limit(500);
 if(error)return NextResponse.json({error:"Email thread could not be loaded"},{status:503});
 return NextResponse.json({messages:data||[]},{headers:{"Cache-Control":"private, no-store"}});
}
