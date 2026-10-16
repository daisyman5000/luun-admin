import type { ContentPost } from './content';
export function localDateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function calendarDays(year:number,month:number){
 const first=new Date(year,month,1,12);const start=new Date(year,month,1-first.getDay(),12);
 return Array.from({length:42},(_,offset)=>{const date=new Date(start);date.setDate(start.getDate()+offset);return {key:localDateKey(date),day:date.getDate(),inMonth:date.getMonth()===month};});
}
export function postCalendarDate(post:ContentPost){return post.plannedAt?localDateKey(new Date(post.plannedAt)):post.dueDate;}
export function postsForDay(posts:ContentPost[],date:string){return posts.filter(post=>postCalendarDate(post)===date).sort((a,b)=>(a.plannedAt||'').localeCompare(b.plannedAt||'')||a.title.localeCompare(b.title));}
