export const contentStatuses = ["draft", "needs_review", "approved", "planned", "published"] as const;
export type ContentStatus = typeof contentStatuses[number];
export const statusLabels: Record<ContentStatus, string> = { draft: "Draft", needs_review: "Needs review", approved: "Approved", planned: "Planned", published: "Published" };
export type ContentPost = {
 planVersion?:number; planObjective?:string;
 id: string; version: number; title: string; objective: string; brief: string; caption: string;
 channel: "Instagram"; assetReference: string; dueDate: string; plannedAt: string;
 status: ContentStatus; completionEvidence: string; approvedAt: string | null; createdAt: string; updatedAt: string;
};
export type PostDraft = Pick<ContentPost, "title" | "objective" | "brief" | "caption" | "channel" | "assetReference" | "dueDate" | "plannedAt" | "status" | "completionEvidence">;
export const emptyPost: PostDraft = {title:"",objective:"",brief:"",caption:"",channel:"Instagram",assetReference:"",dueDate:"",plannedAt:"",status:"draft",completionEvidence:""};
function text(body: Record<string, unknown>, key: string, max: number) {
 const value = body[key];
 if (typeof value !== "string" || value.length > max) throw new Error(`Invalid ${key} (maximum ${max} characters).`);
 return value.trim();
}
export function validatePost(body: Record<string, unknown>, previous?: ContentPost): PostDraft {
 const title=text(body,"title",160),objective=text(body,"objective",1000),brief=text(body,"brief",6000),caption=text(body,"caption",2200),assetReference=text(body,"assetReference",2000),dueDate=text(body,"dueDate",10),plannedAt=text(body,"plannedAt",40),completionEvidence=text(body,"completionEvidence",2000);
 if (!title) throw new Error("Give this post a title.");
 if (body.channel!=="Instagram") throw new Error("Choose Instagram.");
 if (!contentStatuses.includes(body.status as ContentStatus)) throw new Error("Invalid review status.");
 const status=body.status as ContentStatus;
 if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || new Date(dueDate+"T12:00:00Z").toISOString().slice(0,10)!==dueDate)) throw new Error("Choose a valid due date.");
 if (plannedAt && !Number.isFinite(Date.parse(plannedAt))) throw new Error("Choose a valid planned publication time.");
 const editorialChanged=previous && ["title","objective","brief","caption","assetReference","channel"].some(key=>body[key]!==previous[key as keyof ContentPost]);
 if (editorialChanged && ["approved","planned","published"].includes(status)) throw new Error("Content changed. Save as Needs review before approving again.");
 if (["approved","planned","published"].includes(status) && (!objective || !caption || !assetReference)) throw new Error("Approval needs an objective, caption and asset reference.");
 if (["planned","published"].includes(status) && (!previous?.approvedAt || !["approved","planned","published"].includes(previous.status))) throw new Error("Save approval before planning or recording publication.");
 if (status==="planned" && !plannedAt) throw new Error("Choose a planned publication time.");
 if (status==="published") {
  let url: URL;try {url=new URL(completionEvidence);} catch {throw new Error("Add the live Instagram post URL as completion evidence.");}
  if (url.protocol!=="https:" || !["instagram.com","www.instagram.com"].includes(url.hostname) || !/^\/(p|reel)\/[^/]+/.test(url.pathname) || url.username || url.password) throw new Error("Use the live Instagram post or Reel URL.");
 }
 if (previous?.status==="published" && (editorialChanged || status!=="published")) throw new Error("Published records are locked. Create another draft for a revision.");
 return {title,objective,brief,caption,channel:"Instagram",assetReference,dueDate,plannedAt:plannedAt?new Date(plannedAt).toISOString():"",status,completionEvidence};
}
