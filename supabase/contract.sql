-- הרשאות לבעלי נכסים (חסימת תאריכים ומחירים), הרשאות קריאה לנציג, וקבלת זיכוי.
drop policy if exists docs_owner_self on public.docs;
create policy docs_owner_self on public.docs for all to authenticated
  using (public.my_role() = 'owner' and col in ('ownblocks','ownprices') and data->>'houseId' = any(public.my_houses()))
  with check (public.my_role() = 'owner' and col in ('ownblocks','ownprices') and data->>'houseId' = any(public.my_houses()));

drop policy if exists docs_agent_read on public.docs;
create policy docs_agent_read on public.docs for select to authenticated
  using (public.my_role() = 'agent' and col in ('properties','units','bookings','seasons','leads','tasks','cleans','settings','extical','ownblocks','ownprices'));

-- קבלת זיכוי: אותו מספור רץ של הקבלות, תמיד מפנה לקבלה המקורית, לא מעל הסכום ששולם.
create or replace function public.issue_credit(p_receipt text, p_amount numeric, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.docs; n int; used numeric; d jsonb; rid text := 'r_' || replace(gen_random_uuid()::text,'-','');
begin
  if public.my_role() not in ('admin','agent') then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad amount'; end if;
  select * into r from public.docs where col = 'receipts' and id = p_receipt;
  if r.id is null or coalesce(r.data->>'kind','') = 'credit' then raise exception 'receipt not found'; end if;
  select coalesce(sum((c.data->>'amount')::numeric),0) into used from public.docs c
    where c.col = 'receipts' and c.data->>'kind' = 'credit' and c.data->>'ref' = p_receipt;
  if used + p_amount > (r.data->>'amount')::numeric then raise exception 'credit exceeds receipt'; end if;
  update public.receipt_counter set last_no = last_no + 1 where id = 1 returning last_no into n;
  d := (r.data - 'token' - 'no' - 'by') || jsonb_build_object(
    'kind','credit','ref',p_receipt,'refNo',r.data->'no','no',n,'token',replace(gen_random_uuid()::text,'-',''),
    'amount',p_amount,'reason',coalesce(p_reason,''),
    'date',to_char(now() at time zone 'Asia/Jerusalem','YYYY-MM-DD'),'time',to_char(now() at time zone 'Asia/Jerusalem','HH24:MI'),
    'by',coalesce(auth.jwt() ->> 'email',''));
  insert into public.docs(col,id,data) values ('receipts', rid, d);
  return d || jsonb_build_object('id', rid);
end $$;
revoke execute on function public.issue_credit(text,numeric,text) from public, anon;
grant execute on function public.issue_credit(text,numeric,text) to authenticated;
