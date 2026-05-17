-- Initial schema for OWA Studio

-- Profiles (auto-created on signup)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Tasks
create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  course text default '',
  course_color text default '#6366f1',
  status text default 'inicio' check (status in ('inicio', 'progreso', 'completado')),
  priority text default 'medium' check (priority in ('high', 'medium', 'low')),
  urgent boolean default false,
  important boolean default false,
  due_date text,
  created_at timestamptz default now(),
  completed_at text,
  estimated_minutes integer,
  subtasks jsonb default '[]',
  files jsonb default '[]',
  notes text default '',
  study_time integer default 0,
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;

create policy "Users can CRUD own tasks"
  on public.tasks for all
  using (auth.uid() = user_id);

-- Notes
create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text default '',
  course text default '',
  course_color text default '#6366f1',
  folder_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_pinned boolean default false
);

alter table public.notes enable row level security;

create policy "Users can CRUD own notes"
  on public.notes for all
  using (auth.uid() = user_id);

-- Events
create table if not exists public.events (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  date text,
  start_time text,
  end_time text,
  all_day boolean default false,
  course text,
  color text default '#6366f1',
  tags jsonb default '[]',
  files jsonb default '[]',
  recurring text default 'none' check (recurring in ('none', 'daily', 'weekly', 'monthly')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.events enable row level security;

create policy "Users can CRUD own events"
  on public.events for all
  using (auth.uid() = user_id);

-- Study sessions
create table if not exists public.study_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('pomodoro', 'chrono')),
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration integer default 0,
  task_id text,
  course_id text,
  pause_count integer default 0,
  created_at timestamptz default now()
);

alter table public.study_sessions enable row level security;

create policy "Users can CRUD own study sessions"
  on public.study_sessions for all
  using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
