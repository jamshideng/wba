-- ============================================================
--  World Bridge Academy
--  0029_tuzatishlar.sql · oyma-oy qo'lda ayirish (Sheets "Tuzatishlar")
--
--  Bola bir necha dars sababli kelmasa yoki oy o'rtasida boshlasa,
--  markaz O'SHA OY uchun aniq summani ayiradi (Y_Tuzatish.js,
--  docs/HISOB-KITOB.md §4). Chegirmadan farqi: faqat bitta oy, admin
--  aniq summa yozadi, davomatdan avtomatik hisoblanmaydi.
--
--    to'lashi kerak (oy) = narx − chegirma − Σ tuzatish(oy), 0 dan kam emas
--
--  1. tuzatishlar jadvali — o'chirilmaydi, bekor qilinadi (to'lovdagidek).
--  2. invoices.tuzatish — shu oyga ayirilgan summa. Oy narxi endi
--     summa + chegirma + tuzatish.
--  3. Yangi hisob-faktura yaratilganda (create_monthly_invoices,
--     yozilish_hisoblari) o'sha oyning tuzatishi o'zi ayiriladi —
--     kelajak oyga oldindan yozilgan tuzatish qarzni oldindan
--     kamaytirmaydi, o'sha oy hisoblanganda ayiriladi.
--  4. tuzatish_qosh / tuzatish_bekor — faqat admin va direktor;
--     har o'zgarish audit_log'ga tushadi.
--  5. chegirma_ozgartir — oy narxini tuzatish bilan birga hisoblaydi.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Jadval
-- ------------------------------------------------------------

create table if not exists tuzatishlar (
  id            bigserial primary key,
  enrollment_id uuid not null references enrollments (id) on delete cascade,
  davr          text not null check (davr ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  summa         numeric(12, 2) not null check (summa > 0),
  sabab         text not null check (length(trim(sabab)) > 0),
  kiritdi       uuid references profiles (id) on delete set null,
  bekor         boolean not null default false,
  bekor_sabab   text,
  bekor_qildi   uuid references profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists tuzatishlar_yozilish_idx on tuzatishlar (enrollment_id, davr);

comment on table tuzatishlar is
  'Oyma-oy qo''lda ayirish (Sheets "Tuzatishlar"). O''chirilmaydi — bekor qilinadi. Faqat tuzatish_qosh/tuzatish_bekor orqali yoziladi.';

alter table tuzatishlar enable row level security;
alter table tuzatishlar force row level security;

-- Pulni ko'radiganlar o'qiydi; yozish faqat funksiyalar orqali (security definer)
drop policy if exists tuzatishlar_staff_read on tuzatishlar;
create policy tuzatishlar_staff_read on tuzatishlar for select to authenticated
  using (app_is_staff());

drop policy if exists tuzatishlar_own_read on tuzatishlar;
create policy tuzatishlar_own_read on tuzatishlar for select to authenticated
  using (exists (
    select 1 from enrollments e
    where e.id = tuzatishlar.enrollment_id and e.student_id = app_student_id()
  ));

drop trigger if exists tuzatishlar_audit on tuzatishlar;
create trigger tuzatishlar_audit after insert or update or delete on tuzatishlar
  for each row execute function audit_trigger();

-- To'lov kabi: o'chirish yo'q
create or replace function tuzatish_ochirilmaydi() returns trigger
language plpgsql as $$
begin
  raise exception 'Tuzatish o''chirilmaydi — bekor qiling.';
end;
$$;

drop trigger if exists tuzatishlar_ochirilmaydi on tuzatishlar;
create trigger tuzatishlar_ochirilmaydi before delete on tuzatishlar
  for each row execute function tuzatish_ochirilmaydi();


-- ------------------------------------------------------------
-- 2. invoices.tuzatish
-- ------------------------------------------------------------

alter table invoices add column if not exists tuzatish numeric(12, 2) not null default 0
  check (tuzatish >= 0);

comment on column invoices.tuzatish is
  'Shu oyga qo''lda ayirilgan summa (tuzatishlar). Oy narxi = summa + chegirma + tuzatish.';

create or replace function tuzatish_jami(p_enrollment uuid, p_davr text) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(summa), 0) from tuzatishlar
  where enrollment_id = p_enrollment and davr = p_davr and not bekor
$$;

-- Bitta oyning hisob-fakturasini tuzatishlar bilan qayta hisoblaydi
create or replace function tuzatish_hisobla(p_enrollment uuid, p_davr text) returns void
language sql security definer set search_path = public as $$
  update invoices i
     set tuzatish = t.qiymat,
         summa    = (i.summa + i.tuzatish) - t.qiymat
    from (
      select least(tuzatish_jami(p_enrollment, p_davr), inv.summa + inv.tuzatish) as qiymat, inv.id
      from invoices inv
      where inv.enrollment_id = p_enrollment and inv.davr = p_davr
    ) t
   where i.id = t.id
     and i.tuzatish is distinct from t.qiymat
$$;


-- ------------------------------------------------------------
-- 3. Yangi hisob-faktura — o'sha oyning tuzatishi o'zi ayiriladi
-- ------------------------------------------------------------

create or replace function invoice_tuzatish_qoy() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v numeric;
begin
  v := least(tuzatish_jami(new.enrollment_id, new.davr), new.summa);
  if v > 0 then
    new.tuzatish := coalesce(new.tuzatish, 0) + v;
    new.summa    := new.summa - v;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_tuzatish on invoices;
create trigger invoices_tuzatish before insert on invoices
  for each row execute function invoice_tuzatish_qoy();


-- ------------------------------------------------------------
-- 4. Qo'shish / bekor qilish
-- ------------------------------------------------------------

create or replace function tuzatish_qosh(
  p_enrollment uuid,
  p_davr       text,
  p_summa      numeric,
  p_sabab      text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Tuzatishni faqat admin yoki direktor kiritadi.';
  end if;
  if p_davr is null or p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy noto''g''ri (masalan 2026-10).';
  end if;
  if p_summa is null or p_summa <= 0 then
    raise exception 'Ayiriladigan summa 0 dan katta bo''lsin.';
  end if;
  if coalesce(trim(p_sabab), '') = '' then
    raise exception 'Sababini yozing (masalan: kasal, 3 dars).';
  end if;
  if not exists (select 1 from enrollments where id = p_enrollment) then
    raise exception 'Yozilish topilmadi.';
  end if;

  insert into tuzatishlar (enrollment_id, davr, summa, sabab, kiritdi)
  values (p_enrollment, p_davr, p_summa, trim(p_sabab), auth.uid())
  returning id into v_id;

  perform tuzatish_hisobla(p_enrollment, p_davr);
  return v_id;
end;
$$;

create or replace function tuzatish_bekor(p_id bigint, p_sabab text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t tuzatishlar;
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Tuzatishni faqat admin yoki direktor bekor qiladi.';
  end if;

  update tuzatishlar
     set bekor = true, bekor_sabab = nullif(trim(p_sabab), ''), bekor_qildi = auth.uid()
   where id = p_id and not bekor
  returning * into v_t;

  if v_t.id is null then
    raise exception 'Tuzatish topilmadi yoki allaqachon bekor qilingan.';
  end if;

  perform tuzatish_hisobla(v_t.enrollment_id, v_t.davr);
end;
$$;

revoke execute on function tuzatish_qosh(uuid, text, numeric, text) from public, anon;
grant  execute on function tuzatish_qosh(uuid, text, numeric, text) to authenticated, service_role;
revoke execute on function tuzatish_bekor(bigint, text) from public, anon;
grant  execute on function tuzatish_bekor(bigint, text) to authenticated, service_role;
revoke execute on function tuzatish_hisobla(uuid, text) from public, anon, authenticated;
grant  execute on function tuzatish_hisobla(uuid, text) to service_role;


-- ------------------------------------------------------------
-- 5. chegirma_ozgartir — oy narxi tuzatish bilan
-- ------------------------------------------------------------

create or replace function chegirma_ozgartir(p_enrollment uuid, p jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_c1   numeric := coalesce(nullif(p ->> 'chegirma_summa', '')::numeric, 0);
  v_c2   numeric := coalesce(nullif(p ->> 'chegirma2_summa', '')::numeric, 0);
  v_soni int;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Chegirmani o''zgartirish huquqingiz yo''q.';
  end if;
  if v_c1 < 0 or v_c2 < 0 then
    raise exception 'Chegirma manfiy bo''lmaydi.';
  end if;

  update enrollments set
    chegirma_summa  = v_c1,
    chegirma_oy     = case when v_c1 > 0 then nullif(p ->> 'chegirma_oy', '')::int else 0 end,
    chegirma2_summa = v_c2,
    chegirma2_oy    = case when v_c2 > 0 then nullif(p ->> 'chegirma2_oy', '')::int else 0 end,
    chegirma_sabab  = coalesce(nullif(p ->> 'chegirma_sabab', ''), chegirma_sabab)
  where id = p_enrollment;

  if not found then
    raise exception 'Yozilish topilmadi.';
  end if;

  -- Oy narxi (summa + chegirma + tuzatish) saqlanadi; avval chegirma, qolganidan tuzatish
  with e as (
    select * from enrollments where id = p_enrollment
  ),
  narxlar as (
    select i.id, i.davr, (i.summa + i.chegirma + i.tuzatish) as narx,
           least(
             chegirma_oyda(oy_raqami(e.boshlandi, i.davr),
                           e.chegirma_summa, e.chegirma_oy,
                           e.chegirma2_summa, e.chegirma2_oy),
             i.summa + i.chegirma + i.tuzatish
           ) as cheg
    from invoices i, e
    where i.enrollment_id = e.id and i.holat <> 'bekor'
  ),
  yangi as (
    select n.id, n.narx, n.cheg,
           least(tuzatish_jami(p_enrollment, n.davr), n.narx - n.cheg) as tuz
    from narxlar n
  )
  update invoices i
     set chegirma = y.cheg,
         tuzatish = y.tuz,
         summa    = y.narx - y.cheg - y.tuz
    from yangi y
   where i.id = y.id
     and (i.chegirma is distinct from y.cheg or i.tuzatish is distinct from y.tuz);

  get diagnostics v_soni = row_count;
  return v_soni;
end;
$$;
