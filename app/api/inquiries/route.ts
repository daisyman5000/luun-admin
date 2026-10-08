import { NextResponse } from "next/server";
import { canUpdateOrderLogistics,getJobsApiContext } from "@/lib/auth";
import { isInquiryCategory,publicInquiry } from "@/lib/inquiry-tickets";
import type { InquiryTicket } from "@/lib/inquiry-tickets";
export async function GET(request:Request){
 const auth=await getJobsApiContext(request.headers.get("authorization"));
 if(auth.kind==="unauthenticated")return NextResponse.json({error:"Authentication required"},{status:401});
 const url=new URL(request.url),offset=Number(url.searchParams.get("offset")||0),status=url.searchParams.get("status")||"unresolved",category=url.searchParams.get("category")||"all";
 if(category!=="all"&&!isInquiryCategory(category))return NextResponse.json({error:"Invalid category"},{status:400});
 if(!Number.isSafeInteger(offset)||offset<0||offset>100000||!["unresolved","resolved","all"].includes(status))return NextResponse.json({error:"Invalid query"},{status:400});
 let query=auth.supabase.from("job_tickets").select("*").eq("category","customer_inquiry").order("created_at",{ascending:false}).order("id",{ascending:false});
 if(status==="resolved")query=query.eq("status","done");if(status==="unresolved")query=query.neq("status","done");
 if(category!=="all")query=query.eq("inquiry_category",category);
 const {data,error}=await query.range(offset,offset+100).returns<InquiryTicket[]>();
 if(error)return NextResponse.json({error:"Unable to load tickets"},{status:500});
 return NextResponse.json({tickets:(data||[]).slice(0,100).map(publicInquiry),hasMore:(data||[]).length>100},{headers:{"Cache-Control":"private, no-store"}});
}
export async function POST(request:Request){
 const auth=await getJobsApiContext(request.headers.get("authorization"));
 if(auth.kind==="unauthenticated")return NextResponse.json({error:"Authentication required"},{status:401});
 if(auth.kind==="user"&&!canUpdateOrderLogistics(auth.profile?.role))return NextResponse.json({error:"Not authorized"},{status:403});
 try{
  const raw=await request.text();if(raw.length>40000)return NextResponse.json({error:"Ticket too large"},{status:413});
  const body=JSON.parse(raw),email=typeof body?.email==="string"?body.email.trim():"",message=typeof body?.message==="string"?body.message.trim():"";
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>320||!message||message.length>30000||body.name!==undefined&&(typeof body.name!=="string"||body.name.length>300))throw new Error("Details and a valid email, if supplied, are required");
  if(body.category!==undefined&&!isInquiryCategory(body.category))throw new Error("Invalid category");
  const row={title:`Inquiry from ${body.name?.trim()||email||"New ticket"}`.slice(0,160),category:"customer_inquiry",status:"open",priority:"normal",customer_name:body.name?.trim()||null,customer_email:email||null,details:message,created_by:auth.user?.id||null,...(body.category&&body.category!=="customer_inquiry"?{inquiry_category:body.category}:{})};
  const {data,error}=await auth.supabase.from("job_tickets").insert(row).select().single<InquiryTicket>();
  if(error)return NextResponse.json({error:"Unable to save ticket"},{status:500});
  return NextResponse.json(publicInquiry(data),{status:201});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Invalid request"},{status:400});}
}
