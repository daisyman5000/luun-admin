-- One field on the existing ticket table; no new inbox or email system.
alter table public.job_tickets add column if not exists inquiry_category text not null default 'customer_inquiry'
 check(inquiry_category in ('customer_inquiry','warranty','delivery','returns','other'));
