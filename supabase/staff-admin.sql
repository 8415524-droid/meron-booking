-- ניהול משתמשים והרשאות מתוך האתר (למנהל בלבד)
create or replace function public.staff_list() returns setof public.staff
language sql security definer set search_path = public stable as $$
  select * from public.staff where public.my_role() = 'admin' order by email;
$$;
create or replace function public.staff_save(p_email text, p_role text, p_houses text[], p_vendor text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() <> 'admin' then raise exception 'forbidden'; end if;
  if p_role not in ('admin','agent','owner','vendor','partner','viewer','guest') then raise exception 'bad role'; end if;
  if p_email is null or length(trim(p_email)) < 5 then raise exception 'bad email'; end if;
  insert into public.staff(email, role, houses, vendor, note)
  values (lower(trim(p_email)), p_role, coalesce(p_houses,'{}'), nullif(trim(coalesce(p_vendor,'')),''), p_note)
  on conflict (email) do update set role = excluded.role, houses = excluded.houses, vendor = excluded.vendor, note = excluded.note;
end $$;
create or replace function public.staff_delete(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() <> 'admin' then raise exception 'forbidden'; end if;
  if lower(p_email) = lower(coalesce(auth.jwt() ->> 'email','')) then raise exception 'cannot delete self'; end if;
  delete from public.staff where lower(email) = lower(p_email);
end $$;
revoke execute on function public.staff_list(), public.staff_save(text,text,text[],text,text), public.staff_delete(text) from public, anon;
grant execute on function public.staff_list(), public.staff_save(text,text,text[],text,text), public.staff_delete(text) to authenticated;
