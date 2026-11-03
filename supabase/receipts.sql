-- קבלות: מספור רץ אוטומטי, שמירה במסד הנתונים, ולינק ציבורי לכל קבלה לשליחה ללקוח.
create table if not exists public.receipt_counter (
  id int primary key default 1 check (id = 1),
  last_no int not null default 0
);
alter table public.receipt_counter enable row level security;
insert into public.receipt_counter(id) values (1) on conflict (id) do nothing;

-- קבלה שהונפקה לא ניתנת לשינוי או למחיקה
create or replace function public.receipts_lock() returns trigger language plpgsql as $$
begin
  if (tg_op = 'DELETE' and old.col = 'receipts') or (tg_op = 'UPDATE' and old.col = 'receipts') then
    raise exception 'קבלה שהונפקה אינה ניתנת לשינוי או למחיקה';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists receipts_lock on public.docs;
create trigger receipts_lock before update or delete on public.docs
  for each row execute function public.receipts_lock();

create or replace function public.issue_receipt(p_booking text, p_amount numeric, p_method text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.docs; h public.docs; u public.docs; s public.docs; n int; tok text := replace(gen_random_uuid()::text,'-','');
        rid text := 'r_' || replace(gen_random_uuid()::text,'-',''); d jsonb;
begin
  if public.my_role() not in ('admin','agent') then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad amount'; end if;
  select * into b from public.docs where col = 'bookings' and id = p_booking;
  if b.id is null then raise exception 'booking not found'; end if;
  select * into h from public.docs where col = 'properties' and id = b.data->>'propId';
  select * into u from public.docs where col = 'units' and id = b.data->>'unitId';
  select * into s from public.docs where col = 'settings' and id = 'main';
  update public.receipt_counter set last_no = last_no + 1 where id = 1 returning last_no into n;
  d := jsonb_build_object(
    'no', n, 'token', tok, 'booking', p_booking,
    'date', to_char(now() at time zone 'Asia/Jerusalem', 'YYYY-MM-DD'),
    'time', to_char(now() at time zone 'Asia/Jerusalem', 'HH24:MI'),
    'amount', p_amount, 'method', coalesce(p_method,''),
    'customer', b.data->>'name', 'phone', b.data->>'phone',
    'house', coalesce(h.data->>'name',''), 'unit', coalesce(u.data->>'name',''),
    'in', b.data->>'in', 'out', b.data->>'out',
    'company', coalesce(nullif(s.data->>'company',''), 'אישור ריאליטי'),
    'companyId', coalesce(s.data->>'companyId',''), 'companyAddr', coalesce(s.data->>'companyAddr',''), 'companyPhone', coalesce(s.data->>'companyPhone',''),
    'by', coalesce(auth.jwt() ->> 'email',''));
  insert into public.docs(col, id, data) values ('receipts', rid, d);
  return d || jsonb_build_object('id', rid);
end $$;

-- קבלה לפי טוקן: ללא התחברות, לשליחה ללקוח בלינק
create or replace function public.receipt_public(p_token text) returns jsonb
language sql security definer set search_path = public stable as $$
  select data - 'by' from public.docs where col = 'receipts' and data->>'token' = p_token limit 1;
$$;

revoke execute on function public.issue_receipt(text,numeric,text), public.receipt_public(text) from public, anon;
grant execute on function public.issue_receipt(text,numeric,text) to authenticated;
grant execute on function public.receipt_public(text) to anon, authenticated;
