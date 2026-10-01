-- ============================================================
--  0046 — Tanaffus: qaytish sanasi va sababi (LevelUp "Ожидают возврата")
--
--  O'quvchi vaqtincha kelmay tursa (ta'til, kasallik, safar) — holat
--  "tanaffus" va u aytgan qaytish kuni yoziladi. Dashboard'da "qaytishi
--  kutilayotganlar" ro'yxati: bugun/ertaga qaytadiganlar va muddati
--  o'tganlar — admin bir kun oldin va o'sha kuni qo'ng'iroq qiladi.
--
--  Holat tanaffusdan boshqasiga o'tsa — sana va sabab o'zi tozalanadi.
-- ============================================================

alter table students add column if not exists qaytish_sana   date;
alter table students add column if not exists tanaffus_sabab text;

comment on column students.qaytish_sana is 'Tanaffusdagi o''quvchi qachon qaytishini aytgan (faqat holat = tanaffus).';
comment on column students.tanaffus_sabab is 'Tanaffus sababi: ta''til, kasallik, safar…';

create or replace function tanaffus_tozala() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.holat <> 'tanaffus' then
    new.qaytish_sana := null;
    new.tanaffus_sabab := null;
  end if;
  return new;
end;
$$;

drop trigger if exists students_tanaffus_tozala on students;
create trigger students_tanaffus_tozala before insert or update on students
  for each row execute function tanaffus_tozala();

create index if not exists students_qaytish_idx on students (qaytish_sana) where holat = 'tanaffus';
