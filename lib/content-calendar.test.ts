import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDays,postsForDay,postCalendarDate } from './content-calendar';
import { emptyPost,type ContentPost } from './content';
test('calendar provides six real weeks across month/year and leap-day boundaries',()=>{
 const feb=calendarDays(2028,1);assert.equal(feb.length,42);assert.ok(feb.some(day=>day.key==='2028-02-29'&&day.inMonth));assert.equal(new Date(feb[0].key+'T12:00:00').getDay(),0);
 const dec=calendarDays(2026,11);assert.ok(dec.some(day=>day.key.startsWith('2027-01')&&!day.inMonth));
});
test('actual saved readiness and publication dates place posts on calendar cells',()=>{
 const post:ContentPost={...emptyPost,id:'test',version:1,title:'TEST',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',approvedAt:null,dueDate:'2026-10-19'};
 assert.equal(postsForDay([post],'2026-10-19').length,1);assert.equal(postsForDay([post],'2026-10-20').length,0);
 const planned={...post,plannedAt:'2026-10-21T12:00:00Z'};assert.notEqual(postCalendarDate(planned),post.dueDate);assert.equal(postsForDay([planned],postCalendarDate(planned)).length,1);
});
