-- Apply to the dedicated MuseWave Supabase project after it is created/connected.
create extension if not exists pgcrypto;

create type public.generation_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');

create table public.music_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  prompt text not null check (char_length(prompt) between 3 and 1500),
  lyrics text not null default '' check (char_length(lyrics) <= 4000),
  language text not null default 'English',
  genre text not null,
  mood text not null,
  mode text not null check (mode in ('instrumental', 'vocal')),
  bpm integer check (bpm between 50 and 220),
  audio_path text,
  created_at timestamptz not null default now()
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.music_projects(id) on delete cascade,
  status public.generation_status not null default 'queued',
  progress smallint not null default 0 check (progress between 0 and 100),
  engine_version text,
  model_version text,
  seed bigint,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table public.performer_consents (
  id uuid primary key default gen_random_uuid(),
  performer_user_id uuid references auth.users(id) on delete set null,
  legal_name text not null,
  contract_storage_path text not null,
  commercial_training_allowed boolean not null default false,
  voice_generation_allowed boolean not null default false,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.music_projects enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.performer_consents enable row level security;

create policy "owners read projects" on public.music_projects for select to authenticated using ((select auth.uid()) = user_id);
create policy "owners create projects" on public.music_projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "owners update projects" on public.music_projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owners delete projects" on public.music_projects for delete to authenticated using ((select auth.uid()) = user_id);

create policy "owners read jobs" on public.generation_jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy "owners create jobs" on public.generation_jobs for insert to authenticated with check ((select auth.uid()) = user_id and status = 'queued');

create policy "performers read consent" on public.performer_consents for select to authenticated using ((select auth.uid()) = performer_user_id);

insert into storage.buckets (id, name, public) values ('music', 'music', false) on conflict (id) do nothing;
create policy "owners read generated audio" on storage.objects for select to authenticated using (bucket_id = 'music' and (storage.foldername(name))[1] = (select auth.uid())::text);
