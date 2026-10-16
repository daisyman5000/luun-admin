import {briefAttachmentHeaders} from '@/lib/brief-export';
import {canViewFinancials} from '@/lib/auth';
import {loadDemandData} from '@/lib/demand-page';
import {operatorAccess} from '@/lib/content-access';
import {localBusinessPlanStore} from '@/lib/business-plan';
import {localContentStore} from '@/lib/content-store';
import {buildOperatorBrief,workBriefWarnings,type BriefTicket} from '@/lib/operator-brief';
import {canEditBusinessPlan} from '@/lib/content-permissions';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 const access=await operatorAccess(request);if(access.kind==='denied')return Response.json({error:'Authenticated workspace access required.'},{status:access.status});
 try{const [plan,posts]=access.kind==='local'?[localBusinessPlanStore().read(),localContentStore().list()]:await Promise.all([access.store.readPlan(),access.store.listPosts()]);
 const tickets=access.kind==='database'?await access.databaseClient.from('job_tickets').select('id,status,inquiry_status,priority,due_at,updated_at,is_test').eq('category','customer_inquiry').order('updated_at',{ascending:false}).limit(200).returns<BriefTicket[]>():{data:[],error:true};
 const demand=access.kind==='database'&&canViewFinancials(access.role)?await loadDemandData(access.databaseClient,{suppressWise:true}).then(data=>({...data.strategy,warnings:workBriefWarnings(data.strategy.warnings)})).catch(()=>undefined):undefined;
 const brief=buildOperatorBrief({plan,posts,tickets:tickets.data||[],ticketsAvailable:!tickets.error,now:Date.now(),demand,timeZone:new URL(request.url).searchParams.get('timeZone')||undefined});
 if(new URL(request.url).searchParams.get('download')==='1')return new Response(JSON.stringify(brief,null,2)+'\n',{headers:briefAttachmentHeaders()});
 return Response.json({brief,plan,canEdit:access.kind==='local'||canEditBusinessPlan(access.role),ticketLimit:200,mayBeTruncated:!!tickets.data&&tickets.data.length===200},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'Saved operating context could not be read.'},{status:503});}
}
