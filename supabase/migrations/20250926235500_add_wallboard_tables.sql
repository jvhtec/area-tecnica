-- Wallboard support tables: announcements and required_docs

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  level text not null default 'info', -- 'info' | 'warn' | 'critical'
  active boolean not null default true,
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id)
);

create index if not exists idx_announcements_active on public.announcements(active);

create table if not exists public.required_docs (
  id serial primary key,
  department text not null,         -- 'sound' | 'lights' | 'video'
  key text not null,                -- e.g. 'stage_plot', 'rider', 'patch'
  label text not null,              -- Display name
  is_required boolean not null default true
);

create unique index if not exists uq_required_docs_dept_key on public.required_docs(department, key);

