-- Version assigned by the successful hosted apply_migration operation on 2026-10-19.
-- LOCAL DRAFT ONLY. Not applied. Use the migration CLI to assign a version after approval.
-- No changes to connections, credentials, existing jobs, or feature flags.
begin;
create table public.instagram_operating_settings (
 account_id text primary key check(account_id='17841472352520052'),
 version integer not null default 0 check(version>=0),
 publishing boolean not null default false,receive boolean not null default false,send boolean not null default false,
 worker_seen_at timestamptz,webhook_verified_at timestamptz,
 updated_at timestamptz not null default now()
);
create table public.instagram_operating_audit (
 id bigint generated always as identity primary key,
 account_id text not null references public.instagram_operating_settings(account_id),
 actor uuid not null references auth.users(id),capability text not null check(capability in ('publishing','receive','send')),
 enabled boolean not null,version integer not null,before_settings jsonb not null,after_settings jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.instagram_operating_settings enable row level security;
alter table public.instagram_operating_audit enable row level security;
revoke all on public.instagram_operating_settings,public.instagram_operating_audit from public,anon,authenticated;
grant select,update on public.instagram_operating_settings to service_role;
grant select,insert on public.instagram_operating_audit to service_role;
grant usage,select on sequence public.instagram_operating_audit_id_seq to service_role;
insert into public.instagram_operating_settings(account_id) values('17841472352520052');
create function public.set_instagram_operating_control(p_actor uuid,p_account text,p_capability text,p_enabled boolean,p_version integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare previous public.instagram_operating_settings; result public.instagram_operating_settings;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor and role in ('owner','admin'))
 or p_account is distinct from '17841472352520052' or p_capability is null or p_capability not in ('publishing','receive','send') or p_enabled is null or p_version is null or p_version<0 then raise exception 'Owner/admin and valid control change required'; end if;
 select * into previous from public.instagram_operating_settings where account_id=p_account for update;
 if previous.account_id is null or previous.version<>p_version then raise exception 'Controls changed; refresh required'; end if;
 if (to_jsonb(previous)->>p_capability)::boolean=p_enabled then return to_jsonb(previous); end if;
 update public.instagram_operating_settings set
 publishing=case when p_capability='publishing' then p_enabled else publishing end,
 receive=case when p_capability='receive' then p_enabled else receive end,
 send=case when p_capability='send' then p_enabled else send end,
 version=version+1,updated_at=now() where account_id=p_account returning * into result;
 insert into public.instagram_operating_audit(account_id,actor,capability,enabled,version,before_settings,after_settings)
 values(p_account,p_actor,p_capability,p_enabled,result.version,
 jsonb_build_object('publishing',previous.publishing,'receive',previous.receive,'send',previous.send),
 jsonb_build_object('publishing',result.publishing,'receive',result.receive,'send',result.send));
 return to_jsonb(result);
end $$;
create function public.observe_instagram_operation(p_account text,p_kind text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_account is distinct from '17841472352520052' or p_kind is null or p_kind not in ('worker','webhook') then raise exception 'Invalid operation observation'; end if;
 update public.instagram_operating_settings set
 worker_seen_at=case when p_kind='worker' then now() else worker_seen_at end,
 webhook_verified_at=case when p_kind='webhook' then now() else webhook_verified_at end where account_id=p_account;
 if not found then raise exception 'Controls are unavailable'; end if;
end $$;
revoke all on function public.set_instagram_operating_control(uuid,text,text,boolean,integer),public.observe_instagram_operation(text,text) from public,anon,authenticated;
grant execute on function public.set_instagram_operating_control(uuid,text,text,boolean,integer),public.observe_instagram_operation(text,text) to service_role;
commit;
