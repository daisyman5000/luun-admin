create table public.funnel_events (
 id text primary key check(length(id)<100), session_id uuid not null,
 stage text not null check(stage in ('landing','product_view','configuration','checkout_start')),
 occurred_at timestamptz not null default now(),channel text not null check(channel in ('direct','search','email','social','paid','other')),test boolean not null default false,
 unique(session_id,stage)
);
create index funnel_events_time on public.funnel_events(occurred_at);
create table public.funnel_purchases (
 id text primary key check(id ~ '^shopify:[0-9]+$'),session_id uuid,occurred_at timestamptz not null,
 amount numeric(16,2) not null check(amount>=0),currency text not null check(currency ~ '^[A-Z]{3}$'),test boolean not null default false
);
create index funnel_purchases_time on public.funnel_purchases(occurred_at);
create table public.funnel_reviews (
 id text primary key check(id ~ '^[0-9a-f]{64}$'),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 from_day date not null,through_day date not null check(through_day>=from_day),package jsonb not null check(jsonb_typeof(package)='object' and octet_length(package::text)<250000)
);
alter table public.funnel_events enable row level security;
alter table public.funnel_purchases enable row level security;
alter table public.funnel_reviews enable row level security;
revoke all on public.funnel_events,public.funnel_purchases,public.funnel_reviews from public,anon,authenticated;
grant select,insert on public.funnel_events,public.funnel_purchases,public.funnel_reviews to service_role;
