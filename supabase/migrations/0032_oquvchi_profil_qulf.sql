-- ============================================================
--  0032 — O'QUVCHI PROFILI QULFI (Jamshid 01.10)
--
--  O'quvchi va ota-ona o'z ismini, loginini va parolini o'zi o'zgartirmaydi —
--  ko'p o'ynab, bazani og'irlashtirmasin. Profilda unga faqat
--  "Telegramga ulash" qoladi; ism/login/parol — admin orqali.
--
--  Sayt formalari va server amallari ham yopilgan; bu trigger REST
--  orqali to'g'ridan yozishni ham to'xtatadi. Admin (o'quvchi
--  profilidan) va service_role (auth.uid() bo'sh) bemalol o'zgartiradi.
-- ============================================================

create or replace function profil_oquvchi_qulf() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null
     and auth.uid() = old.id
     and old.rol in ('oquvchi', 'ota_ona')
     and not app_is_admin()
     and (new.ism is distinct from old.ism or new.email is distinct from old.email) then
    raise exception 'Ism va loginni o''zingiz o''zgartira olmaysiz — markaz adminiga murojaat qiling.';
  end if;
  return new;
end;
$$;

drop trigger if exists profil_oquvchi_qulf on profiles;
create trigger profil_oquvchi_qulf before update on profiles
  for each row execute function profil_oquvchi_qulf();
