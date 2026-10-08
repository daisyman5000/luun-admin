begin;
alter table public.job_tickets add column if not exists gmail_thread_id text;
alter table public.job_tickets add column if not exists inquiry_status text not null default 'new' check(inquiry_status in ('new','answered','waiting_on_customer','needs_tyson','closed'));
alter table public.job_tickets add column if not exists is_test boolean not null default false;
alter table public.job_tickets add column if not exists last_activity_at timestamptz;
update public.job_tickets set inquiry_status=case when status='done' then 'closed' else 'new' end,
 is_test=coalesce(customer_name,'') || E'\n' || coalesce(details,'') ~* '\mtest(ing)?\M', last_activity_at=created_at where last_activity_at is null;
update public.job_tickets set customer_email=lower(trim(customer_email)) where category='customer_inquiry' and customer_email is not null;
alter table public.job_tickets alter column last_activity_at set default now();
alter table public.job_tickets alter column last_activity_at set not null;
create index if not exists inquiry_activity_idx on public.job_tickets(last_activity_at desc,id desc) where category='customer_inquiry';
create table if not exists public.inquiry_messages (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.job_tickets(id) on delete cascade,
 provider_message_id text not null unique, gmail_thread_id text not null, direction text not null check(direction in ('inbound','outbound')),
 from_email text not null, to_email text not null, subject text, body text not null, sent_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index if not exists inquiry_message_thread_idx on public.inquiry_messages(ticket_id,sent_at,id);
alter table public.inquiry_messages enable row level security;
drop policy if exists "Staff read inquiry messages" on public.inquiry_messages;
create policy "Staff read inquiry messages" on public.inquiry_messages for select to authenticated using (exists(select 1 from public.job_tickets where id=ticket_id and category='customer_inquiry'));
revoke all on public.inquiry_messages from anon,authenticated;
grant select on public.inquiry_messages to authenticated;
grant all on public.inquiry_messages to service_role;
create or replace function public.initialize_inquiry_activity() returns trigger language plpgsql set search_path=public as $$
begin
 if new.category='customer_inquiry' then
  if tg_op='INSERT' then
   new.last_activity_at:=new.created_at;
   new.is_test:=new.is_test or (coalesce(new.customer_name,'') || E'\n' || coalesce(new.details,'') ~* '\mtest(ing)?\M');
  elsif new.status is distinct from old.status and new.inquiry_status=old.inquiry_status then
   new.inquiry_status:=case when new.status='done' then 'closed' else 'new' end;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists initialize_inquiry_activity on public.job_tickets;
create trigger initialize_inquiry_activity before insert or update on public.job_tickets for each row execute function public.initialize_inquiry_activity();
create or replace function public.apply_inquiry_message_activity() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.job_tickets set
 inquiry_status=case when new.sent_at>=last_activity_at then case when new.direction='outbound' then 'answered' when inquiry_status='needs_tyson' then 'needs_tyson' else 'new' end else inquiry_status end,
 status=case when new.sent_at>=last_activity_at then 'open' else status end,
 gmail_thread_id=coalesce(gmail_thread_id,new.gmail_thread_id),
 last_activity_at=greatest(last_activity_at,new.sent_at)
 where id=new.ticket_id and category='customer_inquiry';
 return new;
end $$;
drop trigger if exists apply_inquiry_message_activity on public.inquiry_messages;
create trigger apply_inquiry_message_activity after insert on public.inquiry_messages for each row execute function public.apply_inquiry_message_activity();
commit;
