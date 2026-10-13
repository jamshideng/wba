-- ============================================================
--  0066 — USTOZ MAOSHI (SoffCRM'dan, 1-funksiya)
--
--  Qaror (Jamshid, 13.10): maosh O'QUVCHI SONI bo'yicha —
--  oyda ustoz guruhlarida o'qigan har bir o'quvchi uchun belgilangan summa.
--  Ustiga qo'lda: avans (−), bonus (+), jarima (−).
--
--  Qoidalar:
--    • Stavka teachers jadvalida EMAS — u hammaga ochiq (teachers_read
--      using true). Shuning uchun alohida teacher_salaries (0003 dagi
--      eslatmadagi reja). teachers.maosh_turi/maosh_qiymati ishlatilmaydi.
--    • "Oyda o'qigan o'quvchi" = o'sha davr uchun hisob-fakturasi bor
--      (bekor emas) qatnashuv. Tanaffusdagi o'quvchiga faktura chiqmaydi —
--      demak maoshga ham kirmaydi. Ikki guruhida o'qisa — ikki marta.
--    • Ko'radi va yozadi — FAQAT admin/direktor (Jamshid, 13.10: ustoz
--      panelida ko'rinmaydi, ustoz o'z maoshini ham ko'rmaydi).
--    • Avans/bonus/jarima o'chirilmaydi — bekor qilinadi, sababi bilan.
-- ============================================================

create table if not exists teacher_salaries (
  teacher_id  text primary key references teachers (id) on delete cascade,
  turi        salary_type not null default 'oquvchi_soni',
  qiymati     numeric(14, 0) not null check (qiymati >= 0),
  updated_at  timestamptz not null default now()
);

comment on table teacher_salaries is
  'Ustoz maosh stavkasi. oquvchi_soni — bitta o''quvchi uchun summa (so''m). Faqat admin/direktor ko''radi.';

alter table teacher_salaries enable row level security;
alter table teacher_salaries force row level security;

drop policy if exists teacher_salaries_read on teacher_salaries;
create policy teacher_salaries_read on teacher_salaries for select to authenticated
  using (app_is_admin());

drop policy if exists teacher_salaries_write on teacher_salaries;
create policy teacher_salaries_write on teacher_salaries for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

grant select, insert, update, delete on teacher_salaries to authenticated;
grant all on teacher_salaries to service_role;

drop trigger if exists teacher_salaries_audit on teacher_salaries;
create trigger teacher_salaries_audit after insert or update or delete on teacher_salaries
  for each row execute function audit_trigger();

-- ------------------------------------------------------------
-- Avans / bonus / jarima
-- ------------------------------------------------------------
create table if not exists maosh_harakatlar (
  id          bigint generated always as identity primary key,
  teacher_id  text not null references teachers (id) on delete restrict,
  davr        text not null check (davr ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  turi        text not null check (turi in ('avans', 'bonus', 'jarima')),
  summa       numeric(14, 0) not null check (summa > 0),
  izoh        text,
  kiritgan    uuid references profiles (id) default auth.uid(),
  bekor       boolean not null default false,
  bekor_sabab text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (not bekor or bekor_sabab is not null)
);

create index if not exists maosh_harakatlar_davr on maosh_harakatlar (davr, teacher_id) where not bekor;

comment on table maosh_harakatlar is
  'Ustoz maoshiga qo''l bilan qo''shiladigan avans (−), bonus (+), jarima (−). O''chirilmaydi — bekor qilinadi.';

alter table maosh_harakatlar enable row level security;
alter table maosh_harakatlar force row level security;

drop policy if exists maosh_harakatlar_read on maosh_harakatlar;
create policy maosh_harakatlar_read on maosh_harakatlar for select to authenticated
  using (app_is_admin());

drop policy if exists maosh_harakatlar_insert on maosh_harakatlar;
create policy maosh_harakatlar_insert on maosh_harakatlar for insert to authenticated
  with check (app_is_admin() and not bekor);

drop policy if exists maosh_harakatlar_update on maosh_harakatlar;
create policy maosh_harakatlar_update on maosh_harakatlar for update to authenticated
  using (app_is_admin()) with check (app_is_admin());

grant select, insert, update on maosh_harakatlar to authenticated;
grant all on maosh_harakatlar to service_role;

create or replace function maosh_harakat_qulf() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.bekor then
    raise exception 'Bekor qilingan yozuv o''zgarmaydi.';
  end if;
  if new.teacher_id is distinct from old.teacher_id or new.davr is distinct from old.davr
     or new.turi is distinct from old.turi or new.summa is distinct from old.summa
     or new.kiritgan is distinct from old.kiritgan then
    raise exception 'Yozuv o''zgarmaydi — bekor qilib, to''g''risini qayta kiriting.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists maosh_harakatlar_qulf on maosh_harakatlar;
create trigger maosh_harakatlar_qulf before update on maosh_harakatlar
  for each row execute function maosh_harakat_qulf();

drop trigger if exists maosh_harakatlar_audit on maosh_harakatlar;
create trigger maosh_harakatlar_audit after insert or update or delete on maosh_harakatlar
  for each row execute function audit_trigger();

-- ------------------------------------------------------------
-- Oylik maosh hisobi. Faqat admin/direktor (yoki service_role) —
-- boshqaga xato.
-- Stavkasi yo'q ustoz: stavka = null, hisob = null ("aniqlanmagan").
-- ------------------------------------------------------------
create or replace function ustoz_maosh(p_davr text)
returns table (
  teacher_id  text,
  ism         text,
  stavka      numeric,
  oquvchilar  bigint,
  hisob       numeric,
  avans       numeric,
  bonus       numeric,
  jarima      numeric,
  yakuniy     numeric
)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not app_is_admin() and auth.uid() is not null then
    raise exception 'Maosh faqat admin va direktorga ochiq.';
  end if;
  if p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy YYYY-MM ko''rinishida bo''lsin.';
  end if;

  return query
  with oq as (
    select g.teacher_id as tid, count(distinct e.id) as n
    from invoices i
    join enrollments e on e.id = i.enrollment_id
    join groups g on g.id = e.group_id
    where i.davr = p_davr and i.holat <> 'bekor'
    group by g.teacher_id
  ),
  h as (
    select m.teacher_id as tid,
      coalesce(sum(m.summa) filter (where m.turi = 'avans'), 0)  as av,
      coalesce(sum(m.summa) filter (where m.turi = 'bonus'), 0)  as bo,
      coalesce(sum(m.summa) filter (where m.turi = 'jarima'), 0) as ja
    from maosh_harakatlar m
    where m.davr = p_davr and not m.bekor
    group by m.teacher_id
  )
  select
    t.id,
    t.ism,
    s.qiymati,
    coalesce(oq.n, 0),
    s.qiymati * coalesce(oq.n, 0),
    coalesce(h.av, 0),
    coalesce(h.bo, 0),
    coalesce(h.ja, 0),
    s.qiymati * coalesce(oq.n, 0) - coalesce(h.av, 0) + coalesce(h.bo, 0) - coalesce(h.ja, 0)
  from teachers t
  left join teacher_salaries s on s.teacher_id = t.id
  left join oq on oq.tid = t.id
  left join h on h.tid = t.id
  where (t.holat = 'faol' or oq.n is not null or h.tid is not null)
  order by t.ism;
end;
$$;

revoke execute on function ustoz_maosh(text) from public, anon;
grant  execute on function ustoz_maosh(text) to authenticated, service_role;

-- Qoida endi kelishilgan
update settings set qiymat = '"oquvchi_soni"'::jsonb, updated_at = now()
where kalit = 'maosh.qoida' and qiymat = 'null'::jsonb;
