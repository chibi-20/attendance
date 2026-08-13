-- Presensya — AP10 Attendance Tracker
-- Run this whole file in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to run once on a fresh project.

-- Teacher profile, tied to Supabase auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz default now()
);

-- Class sections (e.g. "AP10 - Masikap", "AP10 - Matiyaga")
create table sections (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  school_year text not null,        -- e.g. '2026-2027'
  grade_level int not null default 10,
  created_at timestamptz default now()
);

-- Students per section
create table students (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  lrn text,                          -- Learner Reference Number (DepEd)
  last_name text not null,
  first_name text not null,
  middle_name text,
  sex text check (sex in ('M','F')),
  is_active boolean default true,    -- false = dropped/transferred out
  created_at timestamptz default now()
);
create unique index idx_students_lrn on students(lrn) where lrn is not null;

-- Which calendar dates are actual school days
create table school_calendar (
  date date primary key,
  is_school_day boolean not null default true,
  day_type text check (day_type in ('regular','holiday','suspension','event'))
    default 'regular',
  remarks text
);

-- Attendance — ONLY non-default entries are stored (mark-by-exception).
-- A school day with no row for a student = implicitly Present.
create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  status text not null check (status in ('late','absent')),
  remarks text,
  recorded_at timestamptz default now(),
  unique (student_id, date)
);

-- Row Level Security: everything scoped to the owning teacher
alter table profiles enable row level security;
alter table sections enable row level security;
alter table students enable row level security;
alter table attendance_records enable row level security;
alter table school_calendar enable row level security;

create policy "Teacher reads own profile" on profiles
  for select using (id = auth.uid());

create policy "Teacher updates own profile" on profiles
  for update using (id = auth.uid());

create policy "Teacher owns their sections" on sections
  for all using (teacher_id = auth.uid());

create policy "Teacher owns students in their sections" on students
  for all using (
    section_id in (select id from sections where teacher_id = auth.uid())
  );

create policy "Teacher owns attendance in their sections" on attendance_records
  for all using (
    student_id in (
      select s.id from students s
      join sections sec on sec.id = s.section_id
      where sec.teacher_id = auth.uid()
    )
  );

-- school_calendar is shared (not per-teacher) since there is one calendar of
-- school days; any authenticated user (i.e. the teacher) can read/manage it.
create policy "Authenticated users manage the school calendar" on school_calendar
  for all using (auth.role() = 'authenticated');

-- Auto-create a profile row whenever a new auth user is created, so the
-- teacher doesn't have to manually insert into `profiles` after signup.
-- full_name is pulled from the user's metadata if provided at creation time,
-- falling back to their email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Setup instructions for the teacher:
-- 1. Run this whole script in the Supabase SQL editor.
-- 2. Go to Authentication → Users → Add user, create your teacher account
--    with an email + password (no public sign-up is exposed by the app).
--    A matching row in `profiles` is created automatically by the trigger
--    above.
-- 3. Put your Supabase project URL and anon key into the app's .env file.
-- ---------------------------------------------------------------------------
