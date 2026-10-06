-- ============================================================
--  0060 — Ustozlar davomati (kechikishlar jurnali)
--
--  Qoida (Jamshid, 06.10): faqat KECHIKKAN yoziladi. Yozuv yo'q —
--  ustoz o'z vaqtida kelgan. Har kechikish aniq guruh bo'yicha.
--
--  Kiritish: Sheets'da (sheets_id bor) yoki saytda (sheets_id null).
--  Sinxron faqat sheets_id li yozuvlarga tegadi.
--  Hozircha asosiy kiritish Sheets'da ("Ustoz kechikishlari" varag'i,
--  Y_UstozKech.js); sayt uni scripts/kechikish-kochir.ts bilan
--  kuniga 6 marta o'qiydi (sheets_id = UK0001 bo'yicha ko'zgu).
--  To'liq saytga o'tilganda Sheets'dan kiritish to'xtatiladi.
--
--  Huquq: xodim hammasini ko'radi; ustoz — faqat o'zinikini.
-- ============================================================

create table if not exists ustoz_kechikish (
  id          uuid primary key default gen_random_uuid(),
  sheets_id   text unique,
  sana        date not null,
  group_id    text references groups (id) on delete set null,
  teacher_id  text not null references teachers (id) on delete cascade,
  daqiqa      int  not null check (daqiqa between 1 and 300),
  sabab       text check (sabab is null or length(sabab) <= 500),
  -- Admin yozgan aniq vaqt: Sheets'dan kelsa o'sha vaqt, saytda kiritilsa — hozir
  kiritilgan  timestamptz default now(),
  kiritdi     uuid references profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table ustoz_kechikish is 'Ustoz kechikishlari. Yozuv yo''q = o''z vaqtida kelgan. Manba hozircha Sheets.';

create index if not exists ustoz_kechikish_sana_idx    on ustoz_kechikish (sana desc);
create index if not exists ustoz_kechikish_ustoz_idx   on ustoz_kechikish (teacher_id, sana desc);
create index if not exists ustoz_kechikish_guruh_idx   on ustoz_kechikish (group_id);
create index if not exists ustoz_kechikish_kiritdi_idx on ustoz_kechikish (kiritdi);

drop trigger if exists ustoz_kechikish_set_updated_at on ustoz_kechikish;
create trigger ustoz_kechikish_set_updated_at before update on ustoz_kechikish
  for each row execute function set_updated_at();

drop trigger if exists ustoz_kechikish_audit on ustoz_kechikish;
create trigger ustoz_kechikish_audit after insert or update or delete on ustoz_kechikish
  for each row execute function audit_trigger();

alter table ustoz_kechikish enable row level security;
alter table ustoz_kechikish force row level security;

drop policy if exists ustoz_kechikish_staff on ustoz_kechikish;
create policy ustoz_kechikish_staff on ustoz_kechikish for all to authenticated
  using (app_is_staff()) with check (app_is_staff());

drop policy if exists ustoz_kechikish_ozi on ustoz_kechikish;
create policy ustoz_kechikish_ozi on ustoz_kechikish for select to authenticated
  using (teacher_id = app_teacher_id());

grant select, insert, update, delete on ustoz_kechikish to authenticated;

-- ------------------------------------------------------------
--  Oylik jamlanma: ustoz bo'yicha soni va daqiqasi
-- ------------------------------------------------------------

create or replace view v_ustoz_kechikish_oylik
with (security_invoker = on) as
select
  k.teacher_id,
  t.ism,
  to_char(k.sana, 'YYYY-MM') as davr,
  count(*)::int              as soni,
  sum(k.daqiqa)::int         as daqiqa,
  max(k.daqiqa)::int         as eng_kop
from ustoz_kechikish k
join teachers t on t.id = k.teacher_id
group by k.teacher_id, t.ism, to_char(k.sana, 'YYYY-MM');

grant select on v_ustoz_kechikish_oylik to authenticated;
