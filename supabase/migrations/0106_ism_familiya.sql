-- ============================================================
--  0106 — Ism va familiya alohida (Jamshid, 31.10)
-- ============================================================
--  O'quvchi va ustozda ism (majburiy) va familiya (ixtiyoriy) alohida
--  kiritiladi. students.fish va teachers.ism o'chmaydi: ularni butun tizim
--  o'qiydi, endi trigger "Ism Familiya" qilib yig'adi.
--    · ismi/familiya o'zgarsa — to'liq nom qayta yig'iladi;
--    · faqat to'liq nom kelsa (oquvchi_qosh, lid/probniy, eski skriptlar) —
--      hammasi ismi ga yoziladi, familiya bo'sh qoladi.
--  Nom o'zgarsa kirish profilidagi ism ham, ustozda guruh nomi ham yangilanadi.
--  Eski yozuvlar ro'yxat tekshirilgach alohida yangilanadi; ungacha ismi
--  to'liq nomga teng, ko'rinish o'zgarmaydi.
-- ============================================================

alter table students add column if not exists ismi text;
alter table students add column if not exists familiya text;
alter table teachers add column if not exists ismi text;
alter table teachers add column if not exists familiya text;

update students set ismi = fish where ismi is null;
update teachers set ismi = ism where ismi is null;

/* Bo'sh joylar tozalanadi, bo'sh familiya — NULL */
create or replace function ism_yigish(p_ismi text, p_familiya text) returns text
language sql immutable as $$
  select btrim(regexp_replace(coalesce(p_ismi, '') || ' ' || coalesce(p_familiya, ''), '\s+', ' ', 'g'))
$$;

create or replace function students_ism_tarkibi() returns trigger
language plpgsql as $$
begin
  new.ismi := nullif(btrim(new.ismi), '');
  new.familiya := nullif(btrim(new.familiya), '');
  if tg_op = 'INSERT' then
    if new.ismi is null then new.ismi := btrim(new.fish); new.familiya := null; end if;
  elsif (new.ismi, new.familiya) is not distinct from (old.ismi, old.familiya)
        and new.fish is distinct from old.fish then
    new.ismi := btrim(new.fish); new.familiya := null;
  end if;
  if new.ismi is null then raise exception 'Ism kiritilmagan.'; end if;
  new.fish := ism_yigish(new.ismi, new.familiya);
  return new;
end;
$$;

drop trigger if exists students_ism_tarkibi on students;
create trigger students_ism_tarkibi before insert or update on students
  for each row execute function students_ism_tarkibi();

create or replace function teachers_ism_tarkibi() returns trigger
language plpgsql as $$
begin
  new.ismi := nullif(btrim(new.ismi), '');
  new.familiya := nullif(btrim(new.familiya), '');
  if tg_op = 'INSERT' then
    if new.ismi is null then new.ismi := btrim(new.ism); new.familiya := null; end if;
  elsif (new.ismi, new.familiya) is not distinct from (old.ismi, old.familiya)
        and new.ism is distinct from old.ism then
    new.ismi := btrim(new.ism); new.familiya := null;
  end if;
  if new.ismi is null then raise exception 'Ism kiritilmagan.'; end if;
  new.ism := ism_yigish(new.ismi, new.familiya);
  return new;
end;
$$;

drop trigger if exists teachers_ism_tarkibi on teachers;
create trigger teachers_ism_tarkibi before insert or update on teachers
  for each row execute function teachers_ism_tarkibi();

/* O'quvchi nomi o'zgarsa — kirish profilidagi ism */
create or replace function students_ism_tarqat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is not null then
    update profiles set ism = new.fish where id = new.profile_id and ism is distinct from new.fish;
  end if;
  return null;
end;
$$;

drop trigger if exists students_ism_tarqat on students;
create trigger students_ism_tarqat after update on students
  for each row when (new.fish is distinct from old.fish)
  execute function students_ism_tarqat();

/* Ustoz nomi o'zgarsa — profil va guruh nomi ("Fan · Ustoz · vaqt") */
create or replace function teachers_ism_tarqat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is not null then
    update profiles set ism = new.ism where id = new.profile_id and ism is distinct from new.ism;
  end if;
  update groups
     set nom = replace(nom, ' · ' || old.ism || ' · ', ' · ' || new.ism || ' · ')
   where teacher_id = new.id and position(' · ' || old.ism || ' · ' in nom) > 0;
  return null;
end;
$$;

drop trigger if exists teachers_ism_tarqat on teachers;
create trigger teachers_ism_tarqat after update on teachers
  for each row when (new.ism is distinct from old.ism)
  execute function teachers_ism_tarqat();

alter table students alter column ismi set not null;
alter table teachers alter column ismi set not null;

comment on column students.fish is 'To''liq nom "Ism Familiya" — trigger yig''adi (0106). Kiritish ismi va familiya orqali.';
comment on column teachers.ism is 'To''liq nom "Ism Familiya" — trigger yig''adi (0106). Kiritish ismi va familiya orqali.';
