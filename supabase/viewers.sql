-- מורשי צפייה בלבד: רואים הכול כמו מנהל, בלי יכולת לערוך
drop policy if exists docs_viewer_read on public.docs;
create policy docs_viewer_read on public.docs for select to authenticated
  using (public.my_role() = 'viewer');
insert into public.staff (email, role, note) values
  ('7624930@gmail.com','viewer','יעקב ויספיש'),
  ('a053410@gmail.com','viewer','שמואל ויספיש'),
  ('4150090@gmail.com','viewer','חנוך פרומן')
on conflict (email) do update set role = excluded.role, note = excluded.note;
