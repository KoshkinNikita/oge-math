-- Связывает назначенное занятие с уроком из библиотеки.
alter table public.lessons
add column if not exists template_id text;

-- Дополнительные поля для управления занятием.
alter table public.lessons
add column if not exists lesson_status text
not null default 'scheduled';

alter table public.lessons
add column if not exists teacher_notes text;

alter table public.lessons
add column if not exists completed_at timestamptz;

-- Возможные состояния занятия.
alter table public.lessons
add constraint lessons_status_check
check (
  lesson_status in (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
  )
);