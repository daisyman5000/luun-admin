-- DRAFT MIGRATION ONLY. Do not apply until the exact production scope is approved.
-- Four server-only tables, one private media bucket, service-role-only RPCs,
-- and one content approval/queue invalidation trigger. No existing grants broadened.
begin;
create table public.instagram_connections (
 account_id text primary key,app_id text not null,username text not null,
 token_ciphertext text not null,expires_at timestamptz not null,refreshed_at timestamptz not null,
 scopes text[] not null,refresh_until timestamptz
);
create table public.instagram_oauth_attempts (
 state_hash text primary key check(state_hash ~ '^[a-f0-9]{64}$'),actor uuid not null references auth.users(id),expires_at timestamptz not null
);
create table public.instagram_media (
 id uuid primary key,path text unique not null,sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 mime text not null check(mime='image/jpeg'),width integer not null,height integer not null,size integer not null check(size between 1 and 8388608),
 uploaded_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create table public.instagram_publish_jobs (
 id uuid primary key default gen_random_uuid(),post_id uuid not null references public.operator_content_posts(id),post_version integer not null,
 account_id text not null references public.instagram_connections(account_id),snapshot jsonb not null,approval_hash text not null check(approval_hash ~ '^[a-f0-9]{64}$'),
 state text not null default 'queued' check(state in ('queued','creating','processing','publishing','reconciling','published','failed','cancelled')),
 scheduled_at timestamptz not null,next_attempt_at timestamptz not null,lease_id uuid,lease_until timestamptz,
 container_id text,media_id text,permalink text,error_code text,attempts integer not null default 0,
 approved_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(post_id,post_version)
);
create index instagram_jobs_due on public.instagram_publish_jobs(next_attempt_at) where state in ('queued','creating','processing','publishing','reconciling');
alter table public.instagram_connections enable row level security;
alter table public.instagram_oauth_attempts enable row level security;
alter table public.instagram_media enable row level security;
alter table public.instagram_publish_jobs enable row level security;
revoke all on public.instagram_connections,public.instagram_oauth_attempts,public.instagram_media,public.instagram_publish_jobs from public,anon,authenticated;
grant all on public.instagram_connections,public.instagram_oauth_attempts,public.instagram_media,public.instagram_publish_jobs to service_role;
do $$ begin
 if exists(select 1 from storage.buckets where id='instagram-media') then raise exception 'Existing instagram-media bucket must be reviewed before this migration'; end if;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('instagram-media','instagram-media',false,8388608,array['image/jpeg']);

create function public.consume_instagram_oauth_attempt(p_hash text,p_actor uuid) returns boolean
language sql security invoker set search_path='' as $$
 with used as(delete from public.instagram_oauth_attempts where state_hash=p_hash and actor=p_actor and expires_at>now() returning 1) select exists(select 1 from used);
$$;
create function public.claim_instagram_refresh(p_account text) returns boolean
language sql security invoker set search_path='' as $$
 with claimed as(update public.instagram_connections set refresh_until=now()+interval '2 minutes' where account_id=p_account and (refresh_until is null or refresh_until<now()) returning 1) select exists(select 1 from claimed);
$$;
create function public.enqueue_instagram_publish_job(p_actor uuid,p_snapshot jsonb,p_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.operator_content_posts; c public.instagram_connections; result public.instagram_publish_jobs; m public.instagram_media;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role in ('owner','admin')) or p_hash is null or p_hash!~'^[a-f0-9]{64}$' or p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or p_snapshot->>'postVersion' is null or p_snapshot->>'scheduledAt' is null then raise exception 'Owner/admin and complete approved snapshot required'; end if;
 select * into p from public.operator_content_posts where id=(p_snapshot->>'postId')::uuid for update;
 select * into c from public.instagram_connections where account_id=p_snapshot->>'accountId';
 select * into m from public.instagram_media where id=(p_snapshot->'media'->>'id')::uuid;
 if p.id is null or c.account_id is null or m.id is null or c.expires_at<=now() or not(c.scopes @> array['instagram_business_basic','instagram_business_content_publish'])
 or p.version<>(p_snapshot->>'postVersion')::integer or p.package->>'status' not in ('approved','planned') or coalesce(p.package->>'approvedAt','')=''
 or p.package->>'caption' is distinct from p_snapshot->>'caption' or (p.package->>'plannedAt')::timestamptz is distinct from (p_snapshot->>'scheduledAt')::timestamptz
 or p.package->>'assetReference' is distinct from 'instagram-media:'||m.id::text or m.sha256 is distinct from p_snapshot->'media'->>'sha256' or m.path is distinct from p_snapshot->'media'->>'path'
 or (p_snapshot->>'scheduledAt')::timestamptz<=now() then raise exception 'Current approved snapshot required'; end if;
 insert into public.instagram_publish_jobs(post_id,post_version,account_id,snapshot,approval_hash,scheduled_at,next_attempt_at,approved_by)
 values(p.id,p.version,c.account_id,p_snapshot,p_hash,(p_snapshot->>'scheduledAt')::timestamptz,(p_snapshot->>'scheduledAt')::timestamptz,p_actor)
 on conflict(post_id,post_version) do nothing;
 select * into result from public.instagram_publish_jobs where post_id=p.id and post_version=p.version;
 if result.approval_hash<>p_hash then raise exception 'Another snapshot already scheduled'; end if;
 return jsonb_build_object('id',result.id,'state',result.state,'scheduledAt',result.scheduled_at);
end $$;
create function public.claim_instagram_publish_job(p_account text,p_lease uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.instagram_publish_jobs;
begin
 select * into result from public.instagram_publish_jobs where account_id=p_account and state in ('queued','creating','processing','publishing','reconciling')
 and next_attempt_at<=now() and (lease_until is null or lease_until<now()) order by next_attempt_at,id limit 1 for update skip locked;
 if result.id is null then return null; end if;
 update public.instagram_publish_jobs set lease_id=p_lease,lease_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now() where id=result.id returning * into result;
 return to_jsonb(result);
end $$;
create function public.begin_instagram_publish_job(p_id uuid,p_lease uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare j public.instagram_publish_jobs; p public.operator_content_posts; post_key uuid;
begin
 -- Match the content-save trigger's post -> job lock order to avoid a deadlock.
 select post_id into post_key from public.instagram_publish_jobs where id=p_id;
 select * into p from public.operator_content_posts where id=post_key for update;
 select * into j from public.instagram_publish_jobs where id=p_id for update;
 if j.id is null or p.id is null or j.post_id is distinct from post_key or p_lease is null or j.lease_id is distinct from p_lease or (j.lease_until is null or j.lease_until<=now()) or j.state<>'queued' or p.version<>j.post_version
 or p.package->>'status' not in ('approved','planned') or coalesce(p.package->>'approvedAt','')='' or j.scheduled_at>now() then raise exception 'Publication lease or approval changed'; end if;
 update public.instagram_publish_jobs set state='creating',updated_at=now() where id=p_id;
end $$;
create function public.save_instagram_publish_job(p_id uuid,p_lease uuid,p_patch jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare j public.instagram_publish_jobs; target text=p_patch->>'state';
begin
 select * into j from public.instagram_publish_jobs where id=p_id for update;
 if target is null or p_lease is null or j.id is null or j.lease_id is distinct from p_lease or (j.lease_until is null or j.lease_until<=now()) then raise exception 'Publication lease expired'; end if;
 if not(case j.state when 'queued' then target in ('failed','cancelled') when 'creating' then target in ('processing','failed','reconciling')
 when 'processing' then target in ('processing','publishing','published','failed') when 'publishing' then target in ('published','reconciling','failed')
 when 'reconciling' then target in ('reconciling','published') when 'published' then target='published' else false end) then raise exception 'Invalid publishing transition'; end if;
 -- Provider identities are write-once. Retrying persistence with the same ID is safe;
 -- replacing an acknowledged container/publication could hide a duplicate operation.
 if (p_patch?'container_id' and (coalesce(btrim(p_patch->>'container_id'),'')='' or (j.container_id is not null and j.container_id is distinct from p_patch->>'container_id')))
 or (p_patch?'media_id' and (coalesce(btrim(p_patch->>'media_id'),'')='' or (j.media_id is not null and j.media_id is distinct from p_patch->>'media_id'))) then raise exception 'Provider identity cannot change'; end if;
 if target in ('processing','publishing','published') and coalesce(btrim(coalesce(p_patch->>'container_id',j.container_id)),'')='' then raise exception 'Provider container is required'; end if;
 update public.instagram_publish_jobs set state=target,container_id=coalesce(p_patch->>'container_id',container_id),media_id=coalesce(p_patch->>'media_id',media_id),permalink=coalesce(p_patch->>'permalink',permalink),
 error_code=case when p_patch?'error_code' then p_patch->>'error_code' else error_code end,next_attempt_at=now()+case when target='reconciling' then interval '5 minutes' else interval '30 seconds' end,updated_at=now() where id=p_id;
end $$;
create function public.release_instagram_publish_job(p_id uuid,p_lease uuid) returns void
language sql security invoker set search_path='' as $$
 update public.instagram_publish_jobs set lease_id=null,lease_until=null where id=p_id and lease_id=p_lease;
$$;
create function public.instagram_calendar_statuses(p_ids uuid[],p_account text)
returns table(post_id uuid,state text,permalink text,error_code text)
language sql security invoker set search_path='' as $$
 select distinct on(j.post_id) j.post_id,j.state,j.permalink,j.error_code from public.instagram_publish_jobs j
 where j.post_id=any(p_ids) and j.account_id=p_account order by j.post_id,j.created_at desc,j.id desc;
$$;
-- Invoker trigger: authenticated post RPC execution already runs through the existing
-- private, role-checked implementation. No new SECURITY DEFINER/public privilege surface.
create function operator_private.guard_instagram_approval() returns trigger
language plpgsql security invoker set search_path='' as $$
declare changed boolean;
begin
 changed=(old.package->'caption' is distinct from new.package->'caption' or old.package->'assetReference' is distinct from new.package->'assetReference'
 or nullif(old.package->>'plannedAt','')::timestamptz is distinct from nullif(new.package->>'plannedAt','')::timestamptz);
 if exists(select 1 from public.instagram_publish_jobs where post_id=old.id and state in ('creating','processing','publishing','reconciling','published')) then
  raise exception 'Publication is underway or confirmed; resolve it before editing. Create a new draft for revisions';
 end if;
 if changed and new.package->>'status' in ('approved','planned','published') then raise exception 'Media, caption or time changed; review again'; end if;
 update public.instagram_publish_jobs set state='cancelled',error_code='instagram_approval_changed',updated_at=now() where post_id=old.id and state='queued';
 return new;
end $$;
create trigger instagram_content_approval_guard before update on public.operator_content_posts for each row execute function operator_private.guard_instagram_approval();
revoke all on function operator_private.guard_instagram_approval() from public,anon,authenticated;
revoke all on function public.instagram_calendar_statuses(uuid[],text) from public,anon,authenticated;
grant execute on function public.instagram_calendar_statuses(uuid[],text) to service_role;
revoke all on function public.consume_instagram_oauth_attempt(text,uuid),public.claim_instagram_refresh(text),public.enqueue_instagram_publish_job(uuid,jsonb,text),public.claim_instagram_publish_job(text,uuid),public.begin_instagram_publish_job(uuid,uuid),public.save_instagram_publish_job(uuid,uuid,jsonb),public.release_instagram_publish_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.consume_instagram_oauth_attempt(text,uuid),public.claim_instagram_refresh(text),public.enqueue_instagram_publish_job(uuid,jsonb,text),public.claim_instagram_publish_job(text,uuid),public.begin_instagram_publish_job(uuid,uuid),public.save_instagram_publish_job(uuid,uuid,jsonb),public.release_instagram_publish_job(uuid,uuid) to service_role;
commit;
