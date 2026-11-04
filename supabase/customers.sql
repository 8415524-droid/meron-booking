-- כרטיסי לקוח: הנציג קורא וכותב אותם (המנהל כבר מורשה לכול).
drop policy if exists docs_agent_read on public.docs;
create policy docs_agent_read on public.docs for select to authenticated
  using (public.my_role() = 'agent' and col in ('properties','units','bookings','seasons','leads','tasks','cleans','settings','extical','ownblocks','ownprices','customers','calls'));
drop policy if exists docs_agent_write on public.docs;
create policy docs_agent_write on public.docs for all to authenticated
  using (public.my_role() = 'agent' and col in ('bookings','leads','customers','calls'))
  with check (public.my_role() = 'agent' and col in ('bookings','leads','customers','calls'));
