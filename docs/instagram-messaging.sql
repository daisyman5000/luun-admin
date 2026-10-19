-- DRAFT ONLY; requires reviewed instagram-publishing.sql. No subscriptions/sending activated.
begin;
create table public.instagram_inbox_messages (
 account_id text not null,provider_message_id text not null,peer_id text not null,body text not null,
 received_at timestamptz not null,created_at timestamptz not null default now(),primary key(account_id,provider_message_id)
);
create index instagram_inbox_peers on public.instagram_inbox_messages(account_id,peer_id,received_at desc);
create table public.instagram_replies (
 id uuid primary key default gen_random_uuid(),account_id text not null,peer_id text not null,inbound_id text not null,
 body text not null check(length(body) between 1 and 1000),version integer not null default 1,
 state text not null default 'draft' check(state in ('draft','approved','sending','sent','unknown','failed')),
 approval_hash text,approved_by uuid references auth.users(id),approved_at timestamptz,
 provider_message_id text,error_code text,created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(account_id,inbound_id) references public.instagram_inbox_messages(account_id,provider_message_id)
);
alter table public.instagram_inbox_messages enable row level security;
alter table public.instagram_replies enable row level security;
revoke all on public.instagram_inbox_messages,public.instagram_replies from public,anon,authenticated;
grant all on public.instagram_inbox_messages,public.instagram_replies to service_role;
create function public.save_instagram_reply(p_actor uuid,p_account text,p_inbound text,p_id uuid,p_version integer,p_body text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare m public.instagram_inbox_messages;r public.instagram_replies;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role in ('owner','admin')) or p_body is null or length(btrim(p_body))<1 or length(p_body)>1000 then raise exception 'Owner-reviewed reply required'; end if;
 select * into m from public.instagram_inbox_messages where account_id=p_account and provider_message_id=p_inbound;
 if m.provider_message_id is null then raise exception 'Inbound message not found for this account'; end if;
 if p_id is null then insert into public.instagram_replies(account_id,peer_id,inbound_id,body,created_by) values(p_account,m.peer_id,p_inbound,p_body,p_actor) returning * into r;
 else
  select * into r from public.instagram_replies where id=p_id and account_id=p_account for update;
  if r.id is null or p_version is null or r.version<>p_version or r.state not in ('draft','approved','failed') or r.inbound_id<>p_inbound or r.peer_id<>m.peer_id then raise exception 'Reply changed, sent or outcome uncertain'; end if;
  update public.instagram_replies set body=p_body,version=version+1,state='draft',approval_hash=null,approved_by=null,approved_at=null,error_code=null,updated_at=now() where id=p_id returning * into r;
 end if;return to_jsonb(r)-'approval_hash';
end $$;
create function public.approve_instagram_reply(p_actor uuid,p_account text,p_id uuid,p_version integer,p_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.instagram_replies;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role in ('owner','admin')) or p_hash is null or p_hash!~'^[a-f0-9]{64}$' then raise exception 'Owner approval required'; end if;
 select * into r from public.instagram_replies where id=p_id and account_id=p_account for update;
 if r.id is null or p_version is null or r.version<>p_version or r.state<>'draft' then raise exception 'Current saved draft required'; end if;
 update public.instagram_replies set state='approved',approval_hash=p_hash,approved_by=p_actor,approved_at=now(),updated_at=now() where id=p_id returning * into r;
 return to_jsonb(r)-'approval_hash';
end $$;
create function public.claim_instagram_reply(p_actor uuid,p_account text,p_id uuid,p_version integer,p_hash text) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.instagram_replies;m public.instagram_inbox_messages;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role in ('owner','admin')) or p_hash is null or p_hash!~'^[a-f0-9]{64}$' then raise exception 'Owner send confirmation required'; end if;
 select * into r from public.instagram_replies where id=p_id and account_id=p_account for update;
 select * into m from public.instagram_inbox_messages where account_id=p_account and provider_message_id=r.inbound_id and peer_id=r.peer_id;
 if r.id is null or p_version is null or r.version<>p_version or r.state<>'approved' or r.approval_hash is distinct from p_hash or r.approved_by is null or m.provider_message_id is null
 or m.received_at>now() or m.received_at<=now()-interval '24 hours' then raise exception 'Current approved reply inside response window required'; end if;
 update public.instagram_replies set state='sending',updated_at=now() where id=p_id;
end $$;
revoke all on function public.save_instagram_reply(uuid,text,text,uuid,integer,text),public.approve_instagram_reply(uuid,text,uuid,integer,text),public.claim_instagram_reply(uuid,text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.save_instagram_reply(uuid,text,text,uuid,integer,text),public.approve_instagram_reply(uuid,text,uuid,integer,text),public.claim_instagram_reply(uuid,text,uuid,integer,text) to service_role;
commit;
