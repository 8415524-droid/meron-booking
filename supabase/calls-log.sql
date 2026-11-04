-- רישום אוטומטי של שיחות נכנסות מהמרכזייה ליומן השיחות. נקרא מהשרת, הסוד בכתובת הוא ההרשאה.
create or replace function public.pbx_log_call(p_secret text, p_call text, p_phone text, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c public.pbx_config; rid text := 'k_' || left(regexp_replace(coalesce(p_call,''), '[^A-Za-z0-9_-]', '', 'g'), 60);
begin
  select * into c from public.pbx_config where id = 1;
  if c.secret is distinct from p_secret or length(rid) < 4 then return; end if;
  insert into public.docs(col, id, data)
  values ('calls', rid, jsonb_build_object('phone', coalesce(p_phone,''), 'dir', 'in', 'auto', true, 'status', 'new',
      'at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) || coalesce(p_patch, '{}'::jsonb))
  on conflict (col, id) do update set data = public.docs.data || coalesce(p_patch, '{}'::jsonb);
end $$;
revoke execute on function public.pbx_log_call(text,text,text,jsonb) from public, anon;
grant execute on function public.pbx_log_call(text,text,text,jsonb) to anon, authenticated;
