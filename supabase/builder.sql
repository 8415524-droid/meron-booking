insert into public.staff (email, role, note) values ('builder@meron-booking.app','admin','כניסה ישירה בזמן הבנייה. למחוק בהשקה.')
on conflict (email) do update set role='admin';
