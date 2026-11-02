-- הרשאות לפי תפקיד + בקשות הזמנה מהאתר הציבורי. הוחל על הפרויקט.
alter table public.staff add column if not exists houses text[] not null default '{}';
alter table public.staff add column if not exists vendor text;

create or replace function public.my_staff() returns public.staff
language sql security definer set search_path = public stable as $$
  select s from public.staff s where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email','')) limit 1;
$$;
create or replace function public.my_role() returns text
language sql security definer set search_path = public stable as $$
  select (public.my_staff()).role;
$$;
create or replace function public.my_houses() returns text[]
language sql security definer set search_path = public stable as $$
  select coalesce((public.my_staff()).houses,'{}');
$$;
create or replace function public.my_vendor() returns text
language sql security definer set search_path = public stable as $$
  select (public.my_staff()).vendor;
$$;
create or replace function public.vendor_houses() returns text[]
language sql security definer set search_path = public stable as $$
  select coalesce(array_agg(distinct t.data->>'houseId'),'{}') from public.docs t
  where t.col='tasks' and t.data->>'vendor' = public.my_vendor() and public.my_vendor() is not null;
$$;
revoke execute on function public.vendor_houses() from public, anon;
grant execute on function public.vendor_houses() to authenticated;
revoke execute on function public.my_staff(), public.my_role(), public.my_houses(), public.my_vendor() from public, anon;
grant execute on function public.my_staff(), public.my_role(), public.my_houses(), public.my_vendor() to authenticated;

drop policy if exists docs_staff_all on public.docs;
drop policy if exists docs_admin on public.docs;
drop policy if exists docs_agent_read on public.docs;
drop policy if exists docs_agent_write on public.docs;
drop policy if exists docs_partner_read on public.docs;
drop policy if exists docs_owner_read on public.docs;
drop policy if exists docs_vendor_read on public.docs;
drop policy if exists docs_vendor_write on public.docs;

create policy docs_admin on public.docs for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- נציג: קורא כמעט הכול חוץ מכספים ושכר; כותב הזמנות, רשימת המתנה וקריאות
create policy docs_agent_read on public.docs for select to authenticated
  using (public.my_role() = 'agent' and col in ('properties','units','bookings','seasons','leads','tasks','cleans','settings'));
create policy docs_agent_write on public.docs for all to authenticated
  using (public.my_role() = 'agent' and col in ('bookings','leads'))
  with check (public.my_role() = 'agent' and col in ('bookings','leads'));

-- שותף: קריאה בלבד לדוחות, בלי שכר ועובדים
create policy docs_partner_read on public.docs for select to authenticated
  using (public.my_role() = 'partner' and col not in ('payroll','employees'));

-- בעל בית: רק הבתים שלו
create policy docs_owner_read on public.docs for select to authenticated
  using (public.my_role() = 'owner' and (
    (col = 'properties' and id = any(public.my_houses())) or
    (col = 'units' and data->>'houseId' = any(public.my_houses())) or
    (col = 'bookings' and data->>'propId' = any(public.my_houses())) or
    (col in ('tasks','cleans') and data->>'houseId' = any(public.my_houses())) or
    (col = 'seasons') or (col = 'settings')
  ));

-- איש מקצוע: רק קריאות שהוקצו לו
create policy docs_vendor_read on public.docs for select to authenticated
  using (public.my_role() = 'vendor' and (
    (col = 'tasks' and data->>'vendor' = public.my_vendor()) or
    (col = 'properties' and id = any(public.vendor_houses()))
  ));
create policy docs_vendor_write on public.docs for update to authenticated
  using (public.my_role() = 'vendor' and col = 'tasks' and data->>'vendor' = public.my_vendor())
  with check (public.my_role() = 'vendor' and col = 'tasks' and data->>'vendor' = public.my_vendor());

-- בקשות הזמנה מהאתר הציבורי (הכנסה בלבד לאנונימי)
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 80),
  phone text not null check (length(phone) between 7 and 20),
  unit_id text not null check (length(unit_id) <= 60),
  unit_label text check (length(unit_label) <= 120),
  check_in date not null,
  check_out date not null check (check_out > check_in and check_out - check_in <= 30),
  guests int not null default 1 check (guests between 1 and 60),
  notes text check (length(notes) <= 400),
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.requests enable row level security;
drop policy if exists req_insert on public.requests;
drop policy if exists req_staff on public.requests;
create policy req_insert on public.requests for insert to anon, authenticated
  with check (status = 'new');
create policy req_staff on public.requests for all to authenticated
  using (public.my_role() in ('admin','agent')) with check (public.my_role() in ('admin','agent'));
alter publication supabase_realtime add table public.requests;

-- קטלוג ציבורי: יחידות ותאריכים תפוסים בלבד (בלי שמות לקוחות)
create or replace function public.public_catalog() returns jsonb
language sql security definer set search_path = public stable as $$
  with houses as (select id, data from docs where col='properties' and coalesce((data->>'active')::boolean,true)),
  us as (
    select u.id, h.id hid, h.data->>'name' hname, h.data->>'area' area, u.data->>'name' uname,
      coalesce((u.data->>'beds')::int,0) beds, coalesce((u.data->>'rooms')::int,0) rooms,
      coalesce((u.data->>'shabbatPrice')::int,0) sp
    from docs u join houses h on h.id = u.data->>'houseId' where u.col='units' and coalesce((u.data->>'active')::boolean,true)
    union all
    select h.id, h.id, h.data->>'name', h.data->>'area', '', coalesce((h.data->>'beds')::int,0), coalesce((h.data->>'rooms')::int,0), coalesce((h.data->>'shabbatPrice')::int,0)
    from houses h where not exists (select 1 from docs u where u.col='units' and u.data->>'houseId' = h.id)
  )
  select jsonb_build_object('units', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name', case when uname='' then hname else hname||' · '||uname end,'area',area,'beds',beds,'rooms',rooms,'sp',sp)) from us),'[]'::jsonb),
    'busy', coalesce((select jsonb_agg(jsonb_build_object('u', coalesce(nullif(b.data->>'unitId',''), b.data->>'propId'),'in',b.data->>'in','out',b.data->>'out')) from docs b where b.col='bookings' and coalesce(b.data->>'status','') not in ('cancelled','done') and (b.data->>'out') >= to_char(current_date,'YYYY-MM-DD')),'[]'::jsonb));
$$;
grant execute on function public.public_catalog() to anon, authenticated;
