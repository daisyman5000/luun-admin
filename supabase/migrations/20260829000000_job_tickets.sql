create table if not exists public.job_tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (
    category in (
      'customer_inquiry',
      'ads_created',
      'customer_followup_reviews',
      'social_media_posts',
      'technology_improvements'
    )
  ),
  status text not null default 'open' check (status in ('open', 'in_progress', 'blocked', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  customer_name text,
  customer_email text,
  order_number text,
  owner_name text,
  details text,
  next_step text,
  due_at date,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists job_tickets_category_idx on public.job_tickets (category);
create index if not exists job_tickets_status_idx on public.job_tickets (status);
create index if not exists job_tickets_due_at_idx on public.job_tickets (due_at);

drop trigger if exists set_job_tickets_updated_at on public.job_tickets;
create trigger set_job_tickets_updated_at
before update on public.job_tickets
for each row execute function public.set_updated_at();

create or replace function public.set_job_tickets_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists set_job_tickets_updated_by on public.job_tickets;
create trigger set_job_tickets_updated_by
before update on public.job_tickets
for each row execute function public.set_job_tickets_updated_by();

alter table public.job_tickets enable row level security;

drop policy if exists "Authenticated users can read job tickets" on public.job_tickets;
create policy "Authenticated users can read job tickets"
on public.job_tickets for select
to authenticated
using (true);

drop policy if exists "Logistics roles can insert job tickets" on public.job_tickets;
create policy "Logistics roles can insert job tickets"
on public.job_tickets for insert
to authenticated
with check (
  public.current_user_has_role(array['owner', 'admin', 'logistics'])
  and created_by = auth.uid()
);

drop policy if exists "Logistics roles can update job tickets" on public.job_tickets;
create policy "Logistics roles can update job tickets"
on public.job_tickets for update
to authenticated
using (public.current_user_has_role(array['owner', 'admin', 'logistics']))
with check (public.current_user_has_role(array['owner', 'admin', 'logistics']));

drop policy if exists "Owner and admin can delete job tickets" on public.job_tickets;
create policy "Owner and admin can delete job tickets"
on public.job_tickets for delete
to authenticated
using (public.current_user_has_role(array['owner', 'admin']));

revoke all on public.job_tickets from anon, authenticated;
grant select, insert, update, delete on public.job_tickets to authenticated;
