-- Run once in Supabase SQL Editor. Every user also receives a profile.
create type public.user_role as enum ('teacher', 'student');
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role public.user_role not null,
  teacher_id uuid references public.profiles(id),
  created_at timestamptz default now()
);
create table public.lessons (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id),
  student_id uuid not null references public.profiles(id), title text not null, starts_at timestamptz not null,
  duration_minutes int not null default 60, room_id text not null unique default gen_random_uuid()::text, notes text, created_at timestamptz default now()
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id), student_id uuid not null references public.profiles(id),
  title text not null, description text, due_at timestamptz, topic text, created_at timestamptz default now()
);
create table public.submissions (
  id uuid primary key default gen_random_uuid(), assignment_id uuid unique not null references public.assignments(id) on delete cascade,
  text_answer text, attachment_path text, status text not null default 'submitted', teacher_feedback text, submitted_at timestamptz default now(), reviewed_at timestamptz
);
create table public.topic_progress (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id), topic text not null, percent smallint not null check(percent between 0 and 100), unique(student_id, topic));
create table public.board_events (id bigint generated always as identity primary key, room_id text not null, author_id uuid not null references public.profiles(id), payload jsonb not null, created_at timestamptz default now());
create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'student');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile_for_new_user();
alter table public.profiles enable row level security; alter table public.lessons enable row level security; alter table public.assignments enable row level security; alter table public.submissions enable row level security; alter table public.topic_progress enable row level security; alter table public.board_events enable row level security;
create policy "read own profile or student" on public.profiles for select using (auth.uid()=id or teacher_id=auth.uid());
create policy "participants read lessons" on public.lessons for select using (auth.uid()=teacher_id or auth.uid()=student_id);
create policy "teacher creates lessons" on public.lessons for insert with check (auth.uid()=teacher_id);
create policy "teacher edits lessons" on public.lessons for update using (auth.uid()=teacher_id) with check (auth.uid()=teacher_id);
create policy "teacher deletes lessons" on public.lessons for delete using (auth.uid()=teacher_id);
create policy "participants read assignments" on public.assignments for select using (auth.uid()=teacher_id or auth.uid()=student_id);
create policy "student submits" on public.submissions for insert with check (exists(select 1 from public.assignments a where a.id=assignment_id and a.student_id=auth.uid()));
create policy "participants board" on public.board_events for all using (exists(select 1 from public.lessons l where l.room_id=board_events.room_id and (l.teacher_id=auth.uid() or l.student_id=auth.uid()))) with check (exists(select 1 from public.lessons l where l.room_id=board_events.room_id and (l.teacher_id=auth.uid() or l.student_id=auth.uid())));
alter publication supabase_realtime add table public.board_events;
alter publication supabase_realtime add table public.lessons;
