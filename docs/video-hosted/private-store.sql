-- Applied and verified: content_video_private_persistence. Existing project: pgoxvqziybtasivqiymw.
-- Evidence snapshot only. Do not reapply this SQL.
-- Separate Video data; no image/calendar/customer tables or access rules changed.
begin;
create table public.content_video_projects (
 id uuid primary key,
 revision integer not null default 0 check (revision>=0),
 package jsonb not null check (jsonb_typeof(package)='object' and octet_length(package::text)<=262144),
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.content_video_media (
 id uuid primary key,
 project_id uuid not null references public.content_video_projects(id),
 path text not null unique,
 kind text not null check(kind in ('voice','source','preview','narration','export')),
 mime text not null,
 size bigint not null check(size>0 and size<=104857600),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 state text not null default 'pending' check(state in ('pending','ready','failed')),
 metadata jsonb not null default '{}'::jsonb check(octet_length(metadata::text)<=16384),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index content_video_media_project on public.content_video_media(project_id,created_at);
alter table public.content_video_projects enable row level security;
alter table public.content_video_media enable row level security;
revoke all on public.content_video_projects,public.content_video_media from public,anon,authenticated;
grant select on public.content_video_projects,public.content_video_media to authenticated;
grant all on public.content_video_projects,public.content_video_media to service_role;
create policy content_video_projects_read on public.content_video_projects for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('owner','admin')));
create policy content_video_media_read on public.content_video_media for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('owner','admin')));
-- Writes only through existing server credential after verified session/profile checks.
-- No storage.objects policy: owners receive only server-authorized path-specific signed URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('content-video','content-video',false,104857600,array['audio/mp4','audio/mpeg','audio/wav','audio/webm','audio/ogg','image/jpeg','image/png','image/webp','video/mp4','video/webm']);
commit;
