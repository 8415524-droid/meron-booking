-- מרכזיה (טכנוליין): הגדרות, זיהוי לקוח לפי טלפון, ומידע לצינתוק אחרי מקדמה.
-- להריץ פעם אחת ב-SQL editor של Supabase.
create table if not exists public.pbx_config (
  id int primary key default 1 check (id = 1),
  secret text not null default replace(gen_random_uuid()::text, '-', ''),
  service_phone text not null default '0548415524',
  api_key text,
  callback_on boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.pbx_config enable row level security;
-- בכוונה בלי policies: הגישה רק דרך הפונקציות למטה.
insert into public.pbx_config(id) values (1) on conflict (id) do nothing;

create or replace function public.pbx_digits(p text) returns text
language sql immutable as $$ select right(regexp_replace(coalesce(p,''), '\D', '', 'g'), 9) $$;

-- הגדרות למנהל בלבד
create or replace function public.pbx_get_config() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.pbx_config;
begin
  if public.my_role() <> 'admin' then raise exception 'forbidden'; end if;
  select * into r from public.pbx_config where id = 1;
  return jsonb_build_object('secret', r.secret, 'service_phone', r.service_phone,
    'has_key', coalesce(r.api_key,'') <> '', 'callback_on', r.callback_on);
end $$;

create or replace function public.pbx_set_config(p_service text, p_key text, p_callback boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() <> 'admin' then raise exception 'forbidden'; end if;
  update public.pbx_config set
    service_phone = coalesce(nullif(trim(p_service),''), service_phone),
    api_key = case when p_key is null or trim(p_key) = '' then api_key else trim(p_key) end,
    callback_on = coalesce(p_callback, callback_on), updated_at = now()
  where id = 1;
end $$;

create or replace function public.pbx_rotate_secret() returns text
language plpgsql security definer set search_path = public as $$
declare s text := replace(gen_random_uuid()::text, '-', '');
begin
  if public.my_role() <> 'admin' then raise exception 'forbidden'; end if;
  update public.pbx_config set secret = s, updated_at = now() where id = 1;
  return s;
end $$;

-- זיהוי מתקשר לפי טלפון. נקרא מהשרת של המרכזייה. הסוד בכתובת הוא ההרשאה.
create or replace function public.pbx_lookup(p_secret text, p_phone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.pbx_config; d text := public.pbx_digits(p_phone); res jsonb;
begin
  select * into c from public.pbx_config where id = 1;
  if c.secret is distinct from p_secret then return null; end if;
  if length(d) < 8 then return jsonb_build_object('service', c.service_phone, 'matches', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(m order by m.active desc, case when m.active then m.in_d end asc, m.out_d desc), '[]'::jsonb) into res
  from (
    select b.id,
      (b.data->>'in') as in_d, (b.data->>'out') as out_d,
      ((b.data->>'out') >= to_char(now() at time zone 'Asia/Jerusalem','YYYY-MM-DD')) as active,
      coalesce(h.data->>'name','') as house,
      coalesce(u.data->>'name','') as unit,
      regexp_replace(coalesce(h.data->>'ownerPhone',''), '\D', '', 'g') as host_phone,
      coalesce(h.data->>'owner','') as host_name
    from public.docs b
    left join public.docs h on h.col = 'properties' and h.id = b.data->>'propId'
    left join public.docs u on u.col = 'units' and u.id = b.data->>'unitId'
    where b.col = 'bookings'
      and coalesce(b.data->>'status','') <> 'cancelled'
      and public.pbx_digits(b.data->>'phone') = d
    order by (b.data->>'out') desc
    limit 8
  ) m;
  return jsonb_build_object('service', c.service_phone, 'matches', res);
end $$;

-- מידע לצינתוק אחרי אישור מקדמה. לנציג ולמנהל בלבד.
create or replace function public.pbx_callback_info(p_booking text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.pbx_config; b public.docs; h public.docs;
begin
  if public.my_role() not in ('admin','agent') then raise exception 'forbidden'; end if;
  select * into c from public.pbx_config where id = 1;
  select * into b from public.docs where col = 'bookings' and id = p_booking;
  if b.id is null then return null; end if;
  select * into h from public.docs where col = 'properties' and id = b.data->>'propId';
  return jsonb_build_object('enabled', c.callback_on, 'api_key', c.api_key,
    'customer_phone', b.data->>'phone', 'customer_name', b.data->>'name',
    'host_phone', h.data->>'ownerPhone', 'host_name', h.data->>'owner', 'house', h.data->>'name',
    'already', coalesce(b.data->>'cbAt',''));
end $$;

create or replace function public.pbx_mark_callback(p_booking text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() not in ('admin','agent') then raise exception 'forbidden'; end if;
  update public.docs set data = data || jsonb_build_object('cbAt', to_char(now(),'YYYY-MM-DD"T"HH24:MI'), 'cbNote', coalesce(p_note,''))
  where col = 'bookings' and id = p_booking;
end $$;

revoke execute on function public.pbx_lookup(text,text), public.pbx_get_config(), public.pbx_set_config(text,text,boolean), public.pbx_rotate_secret(), public.pbx_callback_info(text), public.pbx_mark_callback(text,text), public.pbx_digits(text) from public, anon;
grant execute on function public.pbx_lookup(text, text) to anon, authenticated;
grant execute on function public.pbx_get_config(), public.pbx_set_config(text,text,boolean), public.pbx_rotate_secret(),
  public.pbx_callback_info(text), public.pbx_mark_callback(text,text), public.pbx_digits(text) to authenticated;
