-- סכמה לאתר הזמנות מירון. מריצים פעם אחת ב-SQL Editor של Supabase.
-- כל נתוני האפליקציה נשמרים כמסמכים בטבלה אחת: אוסף (col), מזהה (id) ותוכן (data).

create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);

-- רשימת אימיילים של אנשי הצוות המורשים. גם אם מישהו נרשם, בלי אימייל ברשימה הוא לא רואה כלום.
create table if not exists public.staff (
  email text primary key,
  note text
);

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.staff s where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

alter table public.docs enable row level security;
alter table public.staff enable row level security;

drop policy if exists docs_staff_all on public.docs;
create policy docs_staff_all on public.docs
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- בטבלת staff אין מדיניות לדפדפן. מוסיפים אנשים רק מ-SQL Editor.

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs for each row execute function public.touch_updated_at();

-- עדכונים חיים בין מכשירים
alter publication supabase_realtime add table public.docs;
alter table public.docs replica identity full;

-- אחרי ההרצה מוסיפים את המשתמש הראשון:
-- insert into public.staff (email, note) values ('כתובת-האימייל-שלך@example.com', 'מנהל');
