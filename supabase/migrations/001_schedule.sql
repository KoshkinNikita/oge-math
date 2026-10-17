-- Run this once for an existing project that already ran schema.sql.
create policy "read own profile or student" on public.profiles for select using (auth.uid()=id or teacher_id=auth.uid());
create policy "teacher creates lessons" on public.lessons for insert with check (auth.uid()=teacher_id);
create policy "teacher edits lessons" on public.lessons for update using (auth.uid()=teacher_id) with check (auth.uid()=teacher_id);
create policy "teacher deletes lessons" on public.lessons for delete using (auth.uid()=teacher_id);
alter publication supabase_realtime add table public.lessons;
