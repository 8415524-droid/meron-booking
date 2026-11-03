-- סנכרון יומנים (iCal): ייצוא היומן שלנו לכל יחידה, וסוד לכתובות הייצוא.
create table if not exists public.ical_cfg (
  id int primary key default 1 check (id = 1),
  secret text not null default replace(gen_random_uuid()::text, '-', '')
);
alter table public.ical_cfg enable row level security;
insert into public.ical_cfg(id) values (1) on conflict (id) do nothing;

create or replace function public.ical_get_secret() returns text
language plpgsql security definer set search_path = public as $$
declare s text;
begin
  if public.my_role() not in ('admin','agent') then raise exception 'forbidden'; end if;
  select secret into s from public.ical_cfg where id = 1; return s;
end $$;

-- ההזמנות הפעילות של יחידה או בית (בלי פרטי לקוח). נקרא מהשרת, הסוד בכתובת הוא ההרשאה.
create or replace function public.ical_feed(p_secret text, p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.ical_cfg;
begin
  select * into c from public.ical_cfg where id = 1;
  if c.secret is distinct from p_secret then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'in', b.data->>'in', 'out', b.data->>'out'))
    from public.docs b
    where b.col = 'bookings' and coalesce(b.data->>'status','') <> 'cancelled'
      and coalesce(nullif(b.data->>'unitId',''), b.data->>'propId') = p_id
      and (b.data->>'out') >= to_char(now() - interval '30 days','YYYY-MM-DD')), '[]'::jsonb);
end $$;

revoke execute on function public.ical_get_secret(), public.ical_feed(text,text) from public, anon;
grant execute on function public.ical_get_secret() to authenticated;
grant execute on function public.ical_feed(text,text) to anon, authenticated;
