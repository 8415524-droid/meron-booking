-- קישור צפייה בלבד לכל מי שיש לו את הקישור. למחוק בהשקה: למחוק את המשתמש guest@meron-booking.app ב-Authentication.
drop policy if exists docs_guest_read on public.docs;
create policy docs_guest_read on public.docs for select to authenticated
  using (public.my_role() = 'guest' and col not in ('payroll','employees'));
insert into public.staff (email, role, note) values ('guest@meron-booking.app','guest','קישור צפייה בלבד')
on conflict (email) do update set role='guest';
