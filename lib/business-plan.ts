import fs from "node:fs";
import path from "node:path";
import { validateBusinessPlan } from "./business-plan-validation";
export type PlanCommitment={area?:'content'|'demand'|'customers';kind?:'action'|'decision';sourceId?:string;id:string;title:string;dueDate:string;status:"open"|"done";evidence:string};
export type BusinessPlan={goal?:import("./business-goal").BusinessGoal;dailyAdBudget?:number;version:number;objective:string;targetDate:string;promotionFocus:string;customerPromise:string;constraints:string;commitments:PlanCommitment[];updatedAt:string|null};
export const emptyBusinessPlan:BusinessPlan={version:0,objective:"",targetDate:"",promotionFocus:"",customerPromise:"",constraints:"",commitments:[],updatedAt:null};
export function createBusinessPlanStore(directory:string){
 const file=path.join(directory,"plan.json");
 function read():BusinessPlan{if(!fs.existsSync(file))return {...emptyBusinessPlan,commitments:[]};const data=JSON.parse(fs.readFileSync(file,"utf8"));if(data.schemaVersion!==1||!Number.isInteger(data.plan?.version))throw new Error("Business plan format unavailable.");return data.plan;}
 function save(body:Record<string,unknown>){
  fs.mkdirSync(directory,{recursive:true,mode:0o700});let lock:number;try{lock=fs.openSync(file+".lock","wx",0o600);}catch{throw new Error("Another plan save is in progress.");}
  try{const previous=read();if(body.version!==previous.version)throw new Error("The business plan changed. Reload before saving.");
   const plan:BusinessPlan={...validateBusinessPlan(body),version:previous.version+1,updatedAt:new Date().toISOString()};
   fs.writeFileSync(file+".tmp",JSON.stringify({schemaVersion:1,plan},null,2),{mode:0o600});fs.renameSync(file+".tmp",file);return plan;
  }finally{fs.closeSync(lock);fs.unlinkSync(file+".lock");}
 }
 return {read,save};
}
export function localBusinessPlanStore(){return createBusinessPlanStore(path.join(process.cwd(),".local-content"));}
