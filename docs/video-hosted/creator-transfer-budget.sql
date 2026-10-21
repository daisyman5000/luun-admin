-- DRAFT ONLY. Not applied. Atomic bounded private Drive reads per generated edit.
-- No storage policies, OAuth scopes or public access changes.
alter table public.content_video_projects add column if not exists drive_read_key text not null default '';
alter table public.content_video_projects add column if not exists drive_read_bytes bigint not null default 0;
create or replace function public.reset_content_video_drive_budget(p_id uuid,p_key text)
returns void language plpgsql security invoker set search_path=public as $$
begin
 if length(p_key)<>64 then raise exception 'Invalid transfer key'; end if;
 update public.content_video_projects set drive_read_bytes=case when drive_read_key=p_key then drive_read_bytes else 0 end,drive_read_key=p_key
 where id=p_id and package->>'driveReadKey'=p_key;
 if not found then raise exception 'Video changed'; end if;
end $$;
create or replace function public.reserve_content_video_drive_bytes(p_id uuid,p_key text,p_bytes bigint)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if p_bytes<1 or p_bytes>4194304 then return false; end if;
 update public.content_video_projects set drive_read_bytes=drive_read_bytes+p_bytes
 where id=p_id and drive_read_key=p_key and package->>'driveReadKey'=p_key and drive_read_bytes+p_bytes<=524288000;
 return found;
end $$;
revoke all on function public.reset_content_video_drive_budget(uuid,text) from public,anon,authenticated;
revoke all on function public.reserve_content_video_drive_bytes(uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.reset_content_video_drive_budget(uuid,text) to service_role;
grant execute on function public.reserve_content_video_drive_bytes(uuid,text,bigint) to service_role;
-- MOV recording uploads additionally need video/quicktime on the EXISTING private
-- content-video bucket's allowed_mime_types. Keep public=false, limits and RLS.
