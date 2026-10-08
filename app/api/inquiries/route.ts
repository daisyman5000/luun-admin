import { NextResponse } from "next/server";
import { canUpdateOrderLogistics,getJobsApiContext } from "@/lib/auth";
import { inquiryStatuses,isInquiryStatus,isInquiryCategory,publicInquiry } from "@/lib/inquiry-tickets";
import type { InquiryTicket } from "@/lib/inquiry-tickets";
export async function GET(request:Request){
 const auth=await getJobsApiContext(request.headers.get("authorization"));
 if(auth.kind==="unauthenticated")return NextResponse.json({error:"Authentication required"},{status:401});
 const url=new URL(request.url),offset=Number(url.searchParams.get("offset")||0),requested=url.searchParams.get("status")||"new",status=requested==="resolved"?"closed":requested==="unresolved"?"active":requested,category=url.searchParams.get("category")||"all",showTests=url.searchParams.get("show_tests")==="true";
 if(category!=="all"&&!isInquiryCategory(category)||!Number.isSafeInteger(offset)||offset<0||offset>100000||!["active","all"].includes(status)&&!isInquiryStatus(status))return NextResponse.json({error:"Invalid query"},{status:400});
 const base=()=>{let query=auth.supabase.from("job_tickets").select("*",{count:"exact"}).eq("category","customer_inquiry");if(!showTests)query=query.eq("is_test",false);if(category!=="all")query=query.eq("inquiry_category",category);return query;};
 let query=base().order("last_activity_at",{ascending:false}).order("id",{ascending:false});
 if(status==="active")query=query.neq("inquiry_status","closed");else if(status!=="all")query=query.eq("inquiry_status",status);
 const [result,...totals]=await Promise.all([query.range(offset,offset+100).returns<InquiryTicket[]>(),...Object.keys(inquiryStatuses).map(value=>base().eq("inquiry_status",value).limit(0))]);
 if(result.error||totals.some(item=>item.error))return NextResponse.json({error:"Unable to load tickets"},{status:500});
 const counts=Object.fromEntries(Object.keys(inquiryStatuses).map((value,index)=>[value,totals[index].count||0]));
 return NextResponse.json({tickets:(result.data||[]).slice(0,100).map(publicInquiry),hasMore:(result.data||[]).length>100,counts,refreshed_at:new Date().toISOString()},{headers:{"Cache-Control":"private, no-store"}});
}
export async function POST(request:Request){
 const auth=await getJobsApiContext(request.headers.get("authorization"));
 if(auth.kind==="unauthenticated")return NextResponse.json({error:"Authentication required"},{status:401});
 if(auth.kind==="user"&&!canUpdateOrderLogistics(auth.profile?.role))return NextResponse.json({error:"Not authorized"},{status:403});
 try{
  const raw=await request.text();if(raw.length>40000)return NextResponse.json({error:"Ticket too large"},{status:413});
  const body=JSON.parse(raw),email=typeof body?.email==="string"?body.email.trim().toLowerCase():"",message=typeof body?.message==="string"?body.message.trim():"";
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>320||!message||message.length>30000||body.name!==undefined&&(typeof body.name!=="string"||body.name.length>300))throw new Error("Details and a valid email, if supplied, are required");
  if(body.category!==undefined&&!isInquiryCategory(body.category))throw new Error("Invalid category");
  const row={title:`Inquiry from ${body.name?.trim()||email||"New ticket"}`.slice(0,160),category:"customer_inquiry",status:"open",priority:"normal",customer_name:body.name?.trim()||null,customer_email:email||null,details:message,created_by:auth.user?.id||null,...(body.category?{inquiry_category:body.category}:{})};
  const {data,error}=await auth.supabase.from("job_tickets").insert(row).select().single<InquiryTicket>();
  if(error)return NextResponse.json({error:"Unable to save ticket"},{status:500});
  return NextResponse.json(publicInquiry(data),{status:201});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Invalid request"},{status:400});}
}
