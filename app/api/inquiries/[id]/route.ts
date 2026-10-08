import { NextResponse } from "next/server";
import { canUpdateOrderLogistics,getJobsApiContext } from "@/lib/auth";
import { inquiryUpdates,publicInquiry } from "@/lib/inquiry-tickets";
import type { InquiryTicket } from "@/lib/inquiry-tickets";
const validId=(id:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await getJobsApiContext(request.headers.get("authorization"));if(auth.kind==="unauthenticated")return NextResponse.json({error:"Authentication required"},{status:401});
 const {id}=await params;if(!validId(id))return NextResponse.json({error:"Invalid ticket"},{status:400});
 const {data,error}=await auth.supabase.from("job_tickets").select("*").eq("id",id).eq("category","customer_inquiry").maybeSingle<InquiryTicket>();
 if(error)return NextResponse.json({error:"Unable to read ticket"},{status:500});if(!data)return NextResponse.json({error:"Ticket not found"},{status:404});
 return NextResponse.json(publicInquiry(data),{headers:{"Cache-Control":"private, no-store"}});
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await getJobsApiContext(request.headers.get("authorization"));if(auth.kind==="unauthenticated")return NextResponse.json({error:"Authentication required"},{status:401});
 if(auth.kind==="user"&&!canUpdateOrderLogistics(auth.profile?.role))return NextResponse.json({error:"Not authorized"},{status:403});
 const {id}=await params;if(!validId(id))return NextResponse.json({error:"Invalid ticket"},{status:400});
 let updates;try{const raw=await request.text();if(raw.length>12000)throw new Error("Update too large");updates=inquiryUpdates(JSON.parse(raw));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Invalid update"},{status:400});}
 const {data,error}=await auth.supabase.from("job_tickets").update(updates).eq("id",id).eq("category","customer_inquiry").select().maybeSingle<InquiryTicket>();
 if(error)return NextResponse.json({error:"inquiry_category" in updates?"Ticket categories need database setup":"Unable to update ticket"},{status:503});
 if(!data)return NextResponse.json({error:"Ticket not found"},{status:404});
 // Retain internal status for existing inbox UI; the private API aliases are additive.
 return NextResponse.json(publicInquiry(data));
}
