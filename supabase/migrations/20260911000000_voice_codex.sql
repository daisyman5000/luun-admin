create table if not exists public.voice_codex_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Voice Codex task',
  status text not null default 'discussing' check (
    status in (
      'discussing',
      'inspecting',
      'clarifying',
      'ready_for_approval',
      'ready_to_execute',
      'executing',
      'verifying',
      'complete',
      'blocked'
    )
  ),
  accumulated_context text not null default '',
  approval_summary text,
  last_codex_response text,
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.voice_codex_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.voice_codex_threads(id) on delete cascade,
  action text not null check (action in ('inspect', 'clarify', 'plan', 'approve', 'execute')),
  user_message text not null default '',
  codex_response text not null default '',
  openai_response_id text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists voice_codex_threads_created_by_idx on public.voice_codex_threads (created_by);
create index if not exists voice_codex_threads_status_idx on public.voice_codex_threads (status);
create index if not exists voice_codex_events_thread_id_idx on public.voice_codex_events (thread_id);

drop trigger if exists set_voice_codex_threads_updated_at on public.voice_codex_threads;
create trigger set_voice_codex_threads_updated_at
before update on public.voice_codex_threads
for each row execute function public.set_updated_at();

alter table public.voice_codex_threads enable row level security;
alter table public.voice_codex_events enable row level security;

drop policy if exists "Authenticated users can read voice codex threads" on public.voice_codex_threads;
create policy "Authenticated users can read voice codex threads"
on public.voice_codex_threads for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create voice codex threads" on public.voice_codex_threads;
create policy "Authenticated users can create voice codex threads"
on public.voice_codex_threads for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Thread creators and logistics roles can update voice codex threads" on public.voice_codex_threads;
create policy "Thread creators and logistics roles can update voice codex threads"
on public.voice_codex_threads for update
to authenticated
using (created_by = auth.uid() or public.current_user_has_role(array['owner', 'admin', 'logistics']))
with check (created_by = auth.uid() or public.current_user_has_role(array['owner', 'admin', 'logistics']));

drop policy if exists "Authenticated users can read voice codex events" on public.voice_codex_events;
create policy "Authenticated users can read voice codex events"
on public.voice_codex_events for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create voice codex events" on public.voice_codex_events;
create policy "Authenticated users can create voice codex events"
on public.voice_codex_events for insert
to authenticated
with check (created_by = auth.uid());

revoke all on public.voice_codex_threads from anon, authenticated;
revoke all on public.voice_codex_events from anon, authenticated;
grant select, insert, update on public.voice_codex_threads to authenticated;
grant select, insert on public.voice_codex_events to authenticated;
