-- Additive operator workspace. Review and apply only in a confirmed environment.
-- Session-authenticated reads; writes only through role-checked, transactional RPCs.
-- Private SECURITY DEFINER implementations; exposed wrappers are SECURITY INVOKER.
-- CREATE SCHEMA fails closed if an unexpected same-named schema already exists.
create schema operator_private;
revoke all on schema operator_private from public, anon, authenticated;
grant usage on schema operator_private to authenticated;
create table public.operator_business_plan (
 id integer primary key check(id=1), version integer not null default 0 check(version>=0),
 package jsonb not null check(jsonb_typeof(package)='object'),
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
insert into public.operator_business_plan(id,package) values(1,'{"version":0,"objective":"","targetDate":"","promotionFocus":"","customerPromise":"","constraints":"","commitments":[],"updatedAt":null}');
create table public.operator_content_posts (
 id uuid primary key, version integer not null check(version>0),
 package jsonb not null check(jsonb_typeof(package)='object' and coalesce(package->>'status','') in ('draft','needs_review','approved','planned','published')),
 created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id), approved_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index operator_content_posts_updated_idx on public.operator_content_posts(updated_at desc);
create table public.operator_workspace_events (
 id uuid primary key default gen_random_uuid(), actor uuid not null references auth.users(id),
 entity text not null check(entity in ('plan','content')), entity_id text not null, version integer not null,
 package jsonb not null, created_at timestamptz not null default now()
);
alter table public.operator_business_plan enable row level security;
alter table public.operator_content_posts enable row level security;
alter table public.operator_workspace_events enable row level security;
revoke all on public.operator_business_plan, public.operator_content_posts, public.operator_workspace_events from public, anon, authenticated;
grant select on public.operator_business_plan, public.operator_content_posts to authenticated;
grant select on public.operator_workspace_events to authenticated;
create policy operator_audit_read on public.operator_workspace_events for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('owner','admin')));
create policy operator_plan_read on public.operator_business_plan for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('owner','admin','logistics','viewer')));
create policy operator_content_read on public.operator_content_posts for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('owner','admin','logistics','viewer')));

create function operator_private.save_operator_business_plan(p_expected_version integer,p_package jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_role text; current_version integer; result jsonb; entry jsonb; field text;
begin
 select role into actor_role from public.profiles where id=auth.uid();
 if auth.uid() is null or coalesce(actor_role,'') not in ('owner','admin') then raise exception 'Owner/admin access required' using errcode='42501'; end if;
 if jsonb_typeof(p_package) is distinct from 'object' or octet_length(p_package::text)>100000 then raise exception 'Invalid plan package'; end if;
 if coalesce(jsonb_typeof(p_package->'commitments'),'')<>'array' or jsonb_array_length(p_package->'commitments')>30 then raise exception 'Invalid commitments'; end if;
 foreach field in array array['objective','targetDate','promotionFocus','customerPromise','constraints'] loop
  if coalesce(jsonb_typeof(p_package->field),'')<>'string' then raise exception 'Invalid plan text'; end if;
 end loop;
 if length(p_package->>'objective')>2000 or length(p_package->>'promotionFocus')>2000 or length(p_package->>'customerPromise')>2000 or length(p_package->>'constraints')>4000 then raise exception 'Plan text too long'; end if;
 if p_package->>'targetDate'<>'' then perform (p_package->>'targetDate')::date; end if;
 for entry in select value from jsonb_array_elements(p_package->'commitments') loop
  if coalesce(entry->>'id','')='' or coalesce(entry->>'title','')='' or coalesce(entry->>'dueDate','')='' or coalesce(entry->>'status','') not in ('open','done') then raise exception 'Invalid commitment'; end if;
  perform (entry->>'dueDate')::date;
  if entry->>'status'='done' and btrim(coalesce(entry->>'evidence',''))='' then raise exception 'Completion evidence required'; end if;
 end loop;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_package->'commitments')) then raise exception 'Duplicate commitments'; end if;
 select version into current_version from public.operator_business_plan where id=1 for update;
 if current_version is null or p_expected_version is distinct from current_version then raise exception 'Plan version conflict' using errcode='40001'; end if;
 result=(p_package-array['version','updatedAt'])||jsonb_build_object('version',current_version+1,'updatedAt',now());
 update public.operator_business_plan set version=current_version+1,package=result,updated_by=auth.uid(),updated_at=now() where id=1;
 insert into public.operator_workspace_events(actor,entity,entity_id,version,package) values(auth.uid(),'plan','1',current_version+1,result);
 return result;
end $$;

create function operator_private.save_operator_content_post(p_id uuid,p_expected_version integer,p_package jsonb,p_plan_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_role text; current_version integer:=0; old_package jsonb; result jsonb; clean_package jsonb;
 current_plan jsonb; current_plan_version integer; post_id uuid; new_status text; old_status text; approved_at jsonb; approval_actor uuid; created_at_value jsonb; editorial_changed boolean; field text;
begin
 select role into actor_role from public.profiles where id=auth.uid();
 if auth.uid() is null or coalesce(actor_role,'') not in ('owner','admin','logistics') then raise exception 'Content write access required' using errcode='42501'; end if;
 if jsonb_typeof(p_package) is distinct from 'object' or octet_length(p_package::text)>20000 then raise exception 'Invalid content package'; end if;
 clean_package=p_package-array['id','version','createdAt','updatedAt','approvedAt','approvedBy','planVersion','planObjective'];
 new_status=clean_package->>'status';
 if coalesce(new_status,'') not in ('draft','needs_review','approved','planned','published') or btrim(coalesce(clean_package->>'title',''))='' or coalesce(clean_package->>'channel','')<>'Instagram' then raise exception 'Invalid content status/title/channel'; end if;
 foreach field in array array['title','objective','brief','caption','assetReference','dueDate','plannedAt','completionEvidence'] loop
  if coalesce(jsonb_typeof(clean_package->field),'')<>'string' then raise exception 'Invalid content text'; end if;
 end loop;
 if length(clean_package->>'title')>160 or length(clean_package->>'objective')>1000 or length(clean_package->>'brief')>6000 or length(clean_package->>'caption')>2200 or length(clean_package->>'assetReference')>2000 or length(clean_package->>'completionEvidence')>2000 then raise exception 'Content text too long'; end if;
 if clean_package->>'dueDate'<>'' then perform (clean_package->>'dueDate')::date; end if;
 if clean_package->>'plannedAt'<>'' then perform (clean_package->>'plannedAt')::timestamptz; end if;
 select package,version into current_plan,current_plan_version from public.operator_business_plan where id=1 for share;
 if current_plan_version is null or p_plan_version is distinct from current_plan_version then raise exception 'Shared plan changed' using errcode='40001'; end if;
 if p_id is not null then
  select package,version,approved_by into old_package,current_version,approval_actor from public.operator_content_posts where id=p_id for update;
  if not found then raise exception 'Post unavailable'; end if;
 end if;
 if p_expected_version is distinct from current_version then raise exception 'Post version conflict' using errcode='40001'; end if;
 old_status=old_package->>'status';
 if (new_status in ('approved','planned','published') or old_status in ('approved','planned','published')) and actor_role not in ('owner','admin') then raise exception 'Owner/admin approval required' using errcode='42501'; end if;
 editorial_changed=false;
 if old_package is not null then
  foreach field in array array['title','objective','brief','caption','assetReference','channel'] loop
   if old_package->field is distinct from clean_package->field then editorial_changed=true; end if;
  end loop;
 end if;
 if old_status='published' and (old_package-array['id','version','createdAt','updatedAt','approvedAt','approvedBy','planVersion','planObjective']) is distinct from clean_package then raise exception 'Published record is locked'; end if;
 if new_status in ('approved','planned','published') then
  if editorial_changed then raise exception 'Content changed; review again'; end if;
  if btrim(clean_package->>'objective')='' or btrim(clean_package->>'caption')='' or btrim(clean_package->>'assetReference')='' then raise exception 'Approval requires objective, caption and asset'; end if;
  if clean_package->>'assetReference' like 'creative-lab:%' then raise exception 'Local media is not connected to database storage'; end if;
  if old_status is distinct from 'published' and old_package->>'approvedAt' is not null and (old_package->>'planVersion')::integer is distinct from current_plan_version then raise exception 'Shared plan changed; review again'; end if;
  approved_at=coalesce(nullif(old_package->'approvedAt','null'::jsonb),to_jsonb(now()));approval_actor=coalesce(approval_actor,auth.uid());
 else approved_at='null'::jsonb;approval_actor=null;
 end if;
 if new_status in ('planned','published') and (old_status is null or old_status not in ('approved','planned','published') or old_package->>'approvedAt' is null) then raise exception 'Save approval first'; end if;
 if new_status='planned' and coalesce(clean_package->>'plannedAt','')='' then raise exception 'Planned time required'; end if;
 if new_status='published' and coalesce(clean_package->>'completionEvidence','')!~'^https://(www\.)?instagram\.com/(p|reel)/[A-Za-z0-9_-]+/?([?#].*)?$' then raise exception 'Live Instagram evidence URL required'; end if;
 post_id=coalesce(p_id,gen_random_uuid());created_at_value=coalesce(old_package->'createdAt',to_jsonb(now()));
 result=clean_package||jsonb_build_object('id',post_id,'version',current_version+1,'createdAt',created_at_value,'updatedAt',now(),'approvedAt',approved_at,'approvedBy',approval_actor,'planVersion',case when old_status='published' then (old_package->>'planVersion')::integer else current_plan_version end,'planObjective',case when old_status='published' then old_package->>'planObjective' else current_plan->>'objective' end);
 if p_id is null then
  insert into public.operator_content_posts(id,version,package,created_by,updated_by,approved_by) values(post_id,1,result,auth.uid(),auth.uid(),approval_actor);
 else update public.operator_content_posts set version=current_version+1,package=result,updated_by=auth.uid(),approved_by=approval_actor,updated_at=now() where id=post_id;
 end if;
 insert into public.operator_workspace_events(actor,entity,entity_id,version,package) values(auth.uid(),'content',post_id::text,current_version+1,result);
 return result;
end $$;
-- The Data API sees only these invoker wrappers; private implementations are not
-- in an exposed schema. The implementations independently check auth.uid()/role.
create function public.save_operator_business_plan(p_expected_version integer,p_package jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select operator_private.save_operator_business_plan(p_expected_version,p_package);
$$;
create function public.save_operator_content_post(p_id uuid,p_expected_version integer,p_package jsonb,p_plan_version integer)
returns jsonb language sql security invoker set search_path='' as $$
 select operator_private.save_operator_content_post(p_id,p_expected_version,p_package,p_plan_version);
$$;
revoke all on function operator_private.save_operator_business_plan(integer,jsonb) from public, anon, authenticated;
revoke all on function operator_private.save_operator_content_post(uuid,integer,jsonb,integer) from public, anon, authenticated;
grant execute on function operator_private.save_operator_business_plan(integer,jsonb) to authenticated;
grant execute on function operator_private.save_operator_content_post(uuid,integer,jsonb,integer) to authenticated;
revoke all on function public.save_operator_business_plan(integer,jsonb) from public, anon, authenticated;
revoke all on function public.save_operator_content_post(uuid,integer,jsonb,integer) from public, anon, authenticated;
grant execute on function public.save_operator_business_plan(integer,jsonb) to authenticated;
grant execute on function public.save_operator_content_post(uuid,integer,jsonb,integer) to authenticated;
