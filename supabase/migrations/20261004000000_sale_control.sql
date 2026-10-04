create table public.sale_control (
 id integer primary key check (id = 1),
 enabled boolean not null default false,
 status text not null default 'off' check (status in ('off','syncing','ready','error')),
 version integer not null default 0,
 name text not null default 'Black Friday',
 announcement text not null default 'Black Friday · An extra 35% off your configuration',
 delivery_message text not null default 'Limited availability from our incoming shipment.',
 starts_at timestamptz, ends_at timestamptz,
 shopify_discount_id text, last_error text,
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
 check (ends_at is null or starts_at is null or ends_at > starts_at)
);
insert into public.sale_control(id) values (1);
alter table public.sale_control enable row level security;
revoke all on public.sale_control from anon, authenticated;
create table public.sale_control_audit (
 id uuid primary key default gen_random_uuid(), action text not null,
 actor uuid references auth.users(id), version integer not null,
 created_at timestamptz not null default now()
);
alter table public.sale_control_audit enable row level security;
revoke all on public.sale_control_audit from anon, authenticated;

create table public.sale_checkout_limits (
 key_hash text primary key, window_start timestamptz not null, requests integer not null
);
alter table public.sale_checkout_limits enable row level security;
revoke all on public.sale_checkout_limits from anon, authenticated;
create function public.claim_sale_checkout_request(key_hash_input text)
returns boolean language plpgsql security definer set search_path = public as $$
declare request_count integer;
begin
 insert into public.sale_checkout_limits(key_hash,window_start,requests)
 values(key_hash_input,now(),1)
 on conflict(key_hash) do update set
 requests=case when sale_checkout_limits.window_start < now()-interval '1 minute' then 1 else sale_checkout_limits.requests+1 end,
 window_start=case when sale_checkout_limits.window_start < now()-interval '1 minute' then now() else sale_checkout_limits.window_start end
 returning requests into request_count;
 delete from public.sale_checkout_limits where window_start < now()-interval '1 day';
 return request_count <= 6;
end $$;
revoke all on function public.claim_sale_checkout_request(text) from public, anon, authenticated;
grant execute on function public.claim_sale_checkout_request(text) to service_role;
