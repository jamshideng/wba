-- ============================================================
-- 0147 — Kelmagan darslar bo'yicha avtomatik tuzatish (Jamshid, 28.11)
--
-- Admin endi summa yozmaydi: oy darslaridan "kelmadi" sanalarini tanlaydi,
-- summa bazada hisoblanadi:
--   chegirma = round(oylik_tolov / oydagi_darslar) × tanlangan
--   (oddiy yaxlitlash: 0,5 va undan yuqori — yuqoriga; ustoz tomonida ham
--    round(stavka / n) × tuzatilgan darslar — ko'rsatilgan raqam = haqiqiy summa)
--   oylik_tolov    = invoices.summa + invoices.tuzatish (chegirmalardan keyin,
--                    tuzatishlardan oldin)
--   oydagi_darslar = oy tugagan bo'lsa o'tilgan darslar, tugamagan bo'lsa
--                    max(o'tilgan, jadval bo'yicha) — asl oy (kochirilgan_dan) bo'yicha
--
-- 1) payments.qaytarish — "naqd qaytarildi" manfiy to'lov qatori (usul='naqd').
--    Qarz formulasi o'zgarmaydi: qarz = Σ invoices − Σ payments.
-- 2) tuzatishlar: turi (qolda|darslar), maosh_holati, qaytarish, payment_id.
--    Mavjud barcha qatorlar 'qolda' — summasi, sanasi, qarzi tegilmaydi.
-- 3) tuzatish_darslar — tuzatish qaysi darslar uchun; bitta yozilish + dars
--    faqat bir marta (unikal indeks, bekor qilinganlar hisobga olinmaydi).
-- 4) tuzatish_oyna / tuzatish_darslar_qosh / tuzatish_bekor (yangilandi).
-- 5) Ustoz oyligi: maosh_dars_holati (har dars) → maosh_qatorlari
--    (tuzatilgan dars stavka/n ayiriladi, 12 lik qoidadan keyin, 0 dan kam emas;
--    ketma-ket 3+ sababli ayirilgan dars ikkinchi marta ayirilmaydi).
--    maosh_ayirmalar — har sana va sababi.
-- 6) Qulflangan oy: o'quvchiga darhol, ustoz qismi 'kutilmoqda' +
--    bildirishnoma; tuzatish_maosh_qaror — keyingi oylik yoki o'tkazib yuborish.
-- 7) settings['tuzatish.korinish'] — ota-ona/ustozga tafsilot (standart yoqiq).
-- ============================================================


-- ------------------------------------------------------------
-- 1. Naqd qaytarish — manfiy to'lov
-- ------------------------------------------------------------
alter table payments add column if not exists qaytarish boolean not null default false;
alter table payments drop constraint if exists payments_summa_check;
alter table payments add constraint payments_summa_check
  check ((not qaytarish and summa > 0) or (qaytarish and summa < 0));
comment on column payments.qaytarish is
  'Naqd qaytarish (0147): summa manfiy, tuzatishdan keyin ortiqcha to''lov qaytarilganda.';


-- Kassa hisobotlari: to'lovlar soniga qaytarish kirmaydi; tushum (kirim),
-- qaytarish va sof alohida. Usul/kun/ustoz kesimlari — sof (kassadagi pul).
do $$
declare
  f      text;
  v_def  text;
begin
  foreach f in array array['tushum_hisobot_ichki(date, date)', 'tushum_hisobot_rls(date, date)'] loop
    v_def := pg_get_functiondef(f::regprocedure);
    continue when v_def like '%0147: qaytarish%';
    if position('''tushum'',          (select coalesce(sum(summa), 0) from t),' in v_def) = 0
       or position('''soni'',            (select count(*) from t),' in v_def) = 0 then
      raise exception '0147: % kutilgan ko''rinishda emas', f;
    end if;
    v_def := replace(v_def, '''tushum'',          (select coalesce(sum(summa), 0) from t),',
      '/* 0147: qaytarish */ ''tushum'', (select coalesce(sum(summa), 0) from t where summa > 0),
    ''qaytarish'', (select coalesce(-sum(summa), 0) from t where summa < 0),
    ''sof'', (select coalesce(sum(summa), 0) from t),');
    v_def := replace(v_def, '''soni'',            (select count(*) from t),',
      '''soni'', (select count(*) from t where summa > 0),');
    v_def := replace(v_def, '''odam'',            (select count(distinct student_id) from t),',
      '''odam'', (select count(distinct student_id) from t where summa > 0),');
    execute v_def;
  end loop;

  v_def := pg_get_functiondef('kunlik_qoshimcha(date)'::regprocedure);
  if v_def not like '%0147: qaytarish%' then
    if position('''soni'',     (select count(*) from t),' in v_def) = 0 then
      raise exception '0147: kunlik_qoshimcha kutilgan ko''rinishda emas';
    end if;
    execute replace(v_def, '''soni'',     (select count(*) from t),',
      '/* 0147: qaytarish */ ''soni'', (select count(*) from t where summa > 0),
    ''qaytarish'', coalesce((select -sum(summa) from t where summa < 0), 0),');
  end if;

  v_def := pg_get_functiondef('hisobot_grafik_ichki(date, date)'::regprocedure);
  if v_def not like '%0147: qaytarish%' then
    if position('(select count(*) from tol, oraliq o where sana between o.dan and o.gacha)' in v_def) = 0 then
      raise exception '0147: hisobot_grafik_ichki kutilgan ko''rinishda emas';
    end if;
    execute replace(v_def, '(select count(*) from tol, oraliq o where sana between o.dan and o.gacha)',
      '/* 0147: qaytarish */ (select count(*) from tol, oraliq o where sana between o.dan and o.gacha and summa > 0)');
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. tuzatishlar — yangi ustunlar
-- ------------------------------------------------------------
alter table tuzatishlar
  add column if not exists turi          text not null default 'qolda',
  add column if not exists maosh_holati  text,
  add column if not exists qaytarish     text not null default 'keyingi_oy',
  add column if not exists payment_id    bigint references payments (id) on delete restrict,
  add column if not exists tekshirdim    boolean not null default false,
  add column if not exists maosh_qaror_qildi uuid references profiles (id) on delete set null,
  add column if not exists maosh_qaror_vaqti timestamptz;

alter table tuzatishlar drop constraint if exists tuzatishlar_turi_check;
alter table tuzatishlar add constraint tuzatishlar_turi_check check (turi in ('qolda', 'darslar'));
alter table tuzatishlar drop constraint if exists tuzatishlar_maosh_holati_check;
alter table tuzatishlar add constraint tuzatishlar_maosh_holati_check check (
  (turi = 'qolda' and maosh_holati is null)
  or (turi = 'darslar' and maosh_holati in ('oylikda', 'kutilmoqda', 'keyingi_oy', 'otkazildi')));
alter table tuzatishlar drop constraint if exists tuzatishlar_qaytarish_check;
alter table tuzatishlar add constraint tuzatishlar_qaytarish_check check (qaytarish in ('keyingi_oy', 'naqd'));

comment on column tuzatishlar.turi is
  'qolda — 28.11.2026 gacha qo''lda yozilgan (sanaga bog''lanmagan, ustoz oyligiga ta''sir qilmaydi); darslar — tanlangan kelmagan darslar (0147).';
comment on column tuzatishlar.maosh_holati is
  'Ustoz qismi: oylikda — o''sha oy oyligidan; kutilmoqda — oy qulflangan, direktor qarori kutiladi; keyingi_oy — keyingi oylikdan (maosh_harakatlar); otkazildi — ayirilmaydi.';


-- ------------------------------------------------------------
-- 3. tuzatish_darslar
-- ------------------------------------------------------------
create table if not exists tuzatish_darslar (
  id               bigserial primary key,
  tuzatish_id      bigint not null references tuzatishlar (id) on delete restrict,
  enrollment_id    uuid   not null references enrollments (id) on delete cascade,
  lesson_id        uuid   not null references lessons (id) on delete restrict,
  sana             date   not null,
  teacher_id       text   references teachers (id) on delete set null,  -- darsni o'tgan (zamena bo'lsa o'rinbosar)
  maosh_harakat_id bigint references maosh_harakatlar (id) on delete set null,
  bekor            boolean not null default false,
  created_at       timestamptz not null default now()
);

create unique index if not exists tuzatish_darslar_bir_marta
  on tuzatish_darslar (enrollment_id, lesson_id) where not bekor;
create index if not exists tuzatish_darslar_tuzatish on tuzatish_darslar (tuzatish_id);
create index if not exists tuzatish_darslar_dars on tuzatish_darslar (lesson_id) where not bekor;

comment on table tuzatish_darslar is
  'Tuzatish qaysi darslar uchun berilgani (0147). O''chirilmaydi — tuzatish bekor qilinsa bekor=true, sana yana bo''shaydi.';

alter table tuzatish_darslar enable row level security;
alter table tuzatish_darslar force row level security;

drop policy if exists tuzatish_darslar_staff_read on tuzatish_darslar;
create policy tuzatish_darslar_staff_read on tuzatish_darslar for select to authenticated
  using (app_is_staff());

drop trigger if exists tuzatish_darslar_audit on tuzatish_darslar;
create trigger tuzatish_darslar_audit after insert or update or delete on tuzatish_darslar
  for each row execute function audit_trigger();

drop trigger if exists tuzatish_darslar_ochirilmaydi on tuzatish_darslar;
create trigger tuzatish_darslar_ochirilmaydi before delete on tuzatish_darslar
  for each row execute function tuzatish_ochirilmaydi();


-- Bildirishnoma filtri {"rol": "rahbariyat"} — admin, direktor, manager
do $$
declare
  v_def text := pg_get_functiondef('bildirishnoma_menga(text[], jsonb)'::regprocedure);
  v_joy text := 'if v_rolf = ''manager'' then';
begin
  if v_def like '%rahbariyat%' then
    return;
  end if;
  if position(v_joy in v_def) = 0 then
    raise exception '0147: bildirishnoma_menga kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_joy,
    'if v_rolf = ''rahbariyat'' then return app_is_admin(); end if;  /* 0147 */
  if v_rolf = ''direktor'' then return app_is_direktor(); end if;
  ' || v_joy);
end $$;

-- Naqd qaytarish tasdiq navbatiga tushmaydi (Jamshid, 28.11): yozilganda
-- tasdiqlangan, lekin tasdiqlovchi bo'sh — direktor bildirishnoma oladi.
do $$
declare
  v_def text := pg_get_functiondef('payments_tasdiq_himoya()'::regprocedure);
  v_joy text := 'if ozgardi and not app_is_direktor() then';
begin
  if v_def like '%0147: qaytarish%' then
    return;
  end if;
  if position(v_joy in v_def) = 0 then
    raise exception '0147: payments_tasdiq_himoya kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_joy,
    '/* 0147: qaytarish */
  if tg_op = ''INSERT'' and new.qaytarish then
    new.tasdiqlangan := true;
    new.tasdiqladi := null;
    new.tasdiqlangan_vaqt := now();
    return new;
  end if;
  ' || v_joy);
end $$;


-- ------------------------------------------------------------
-- 4. Sozlama: kim tafsilotni ko'radi
-- ------------------------------------------------------------
insert into settings (kalit, qiymat, tavsif)
values ('tuzatish.korinish', '{"ota_ona": true, "ustoz": true}'::jsonb,
        'Tuzatish tafsilotlari (sana, sabab) ota-ona kabineti va ustoz oyligida ko''rinsinmi (0147).')
on conflict (kalit) do nothing;

create or replace function tuzatish_korinadimi(p_kim text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (qiymat ->> p_kim)::boolean from settings where kalit = 'tuzatish.korinish'), true)
$$;
revoke execute on function tuzatish_korinadimi(text) from public, anon;
grant execute on function tuzatish_korinadimi(text) to authenticated, service_role;

-- O'quvchi va ota-ona — o'z tuzatish sanalarini (sozlama yoqiq bo'lsa)
drop policy if exists tuzatish_darslar_own_read on tuzatish_darslar;
create policy tuzatish_darslar_own_read on tuzatish_darslar for select to authenticated
  using (tuzatish_korinadimi('ota_ona') and exists (
    select 1 from enrollments e
    where e.id = tuzatish_darslar.enrollment_id
      and (e.student_id = app_student_id() or app_farzandmi(e.student_id))
  ));


-- ------------------------------------------------------------
-- 5. Oydagi darslar soni (o'quvchi chegirmasi uchun, 12 emas — haqiqiy)
-- ------------------------------------------------------------
create or replace function tuzatish_oy_darslari(p_group text, p_davr text) returns int
language sql stable security definer set search_path = public as $$
  with oy as (
    select to_date(p_davr || '-01', 'YYYY-MM-DD') as bosh,
           (to_date(p_davr || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date as oxir
  ),
  otil as (
    select count(*)::int as n from lessons l, oy
    where l.group_id = p_group and l.otkazildi
      and coalesce(l.kochirilgan_dan, l.sana) between oy.bosh and oy.oxir
  )
  select case when oy.oxir < bugun_toshkent() then otil.n
              else greatest(otil.n, guruh_oy_darslari(p_group, p_davr)) end
  from oy, otil
$$;
revoke execute on function tuzatish_oy_darslari(text, text) from public, anon;
grant execute on function tuzatish_oy_darslari(text, text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 6. Tuzatish oynasi — oy darslari va holati
-- ------------------------------------------------------------
create or replace function tuzatish_oyna(p_enrollment uuid, p_davr text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  e       enrollments%rowtype;
  v_bosh  date;
  v_oxir  date;
  v_inv   invoices%rowtype;
  v_n     int;
  v_r     jsonb;
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Tuzatish oynasi faqat rahbariyat uchun.';
  end if;
  if p_davr is null or p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy noto''g''ri (masalan 2026-11).';
  end if;
  select * into e from enrollments where id = p_enrollment;
  if not found then
    raise exception 'Yozilish topilmadi.';
  end if;

  v_bosh := to_date(p_davr || '-01', 'YYYY-MM-DD');
  v_oxir := (v_bosh + interval '1 month' - interval '1 day')::date;
  select * into v_inv from invoices where enrollment_id = p_enrollment and davr = p_davr and holat <> 'bekor';
  v_n := tuzatish_oy_darslari(e.group_id, p_davr);

  with darslar as (
    -- o'tilgan darslar (asl oyi bo'yicha)
    select l.id as lesson_id, l.sana, l.zamena_teacher_id is not null as zamena,
           (select a.holat::text from attendance a where a.lesson_id = l.id and a.student_id = e.student_id) as davomat
    from lessons l
    where l.group_id = e.group_id and l.otkazildi
      and coalesce(l.kochirilgan_dan, l.sana) between v_bosh and v_oxir
      and l.sana >= e.boshlandi and (e.tugadi is null or l.sana <= e.tugadi)
  ),
  kelajak as (
    -- hali o'tilmagan rejadagi kunlar (faqat ko'rsatish uchun)
    select null::uuid as lesson_id, k::date as sana, false as zamena, null::text as davomat
    from generate_series(greatest(v_bosh, bugun_toshkent()), v_oxir, interval '1 day') k
    where guruh_dars_kuni(e.group_id, k::date)
      and k::date >= e.boshlandi and (e.tugadi is null or k::date <= e.tugadi)
      and not exists (select 1 from darslar d where d.sana = k::date)
      and not exists (select 1 from lessons l where l.group_id = e.group_id and l.sana = k::date and l.otkazildi)
  ),
  hammasi as (
    select d.*, td.tuzatish_id
    from (select * from darslar union all select * from kelajak) d
    left join tuzatish_darslar td on td.lesson_id = d.lesson_id and td.enrollment_id = p_enrollment and not td.bekor
  )
  select jsonb_build_object(
    'enrollment_id', p_enrollment,
    'davr', p_davr,
    'oylik', case when v_inv.id is null then null else v_inv.summa + v_inv.tuzatish end,
    'tuzatish_jami', coalesce(v_inv.tuzatish, 0),
    -- hozirgi qoldiq summa va shu oy uchun to'langan — ortiqcha to'lovni oynada hisoblash uchun
    'qoldiq', coalesce(v_inv.summa, 0),
    'tolangan', (select coalesce(sum(p.summa), 0) from payments p
                 where p.enrollment_id = p_enrollment and p.davr = p_davr and not p.bekor),
    'n', v_n,
    'bir_dars', case when v_inv.id is null or v_n = 0 then null
                     else round((v_inv.summa + v_inv.tuzatish) / v_n) end,
    'qulf', maosh_oy_qulfmi(p_davr),
    'darslar', coalesce((select jsonb_agg(jsonb_build_object(
        'lesson_id', h.lesson_id, 'sana', h.sana, 'zamena', h.zamena,
        'holat', case when h.tuzatish_id is not null then 'ayirilgan'
                      when h.lesson_id is null then 'otilmagan'
                      when h.davomat = 'keldi' then 'keldi'
                      when h.davomat in ('kelmadi', 'sababli') then 'kelmadi'
                      else 'belgilanmagan' end,
        'tuzatish_id', h.tuzatish_id) order by h.sana) from hammasi h), '[]'::jsonb),
    'qolda', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'summa', t.summa, 'sabab', t.sabab, 'sana', t.created_at) order by t.created_at)
      from tuzatishlar t
      where t.enrollment_id = p_enrollment and t.davr = p_davr and t.turi = 'qolda' and not t.bekor), '[]'::jsonb)
  ) into v_r;

  return v_r;
end;
$$;
revoke execute on function tuzatish_oyna(uuid, text) from public, anon;
grant execute on function tuzatish_oyna(uuid, text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 7. Yangi tuzatish — tanlangan darslar
-- ------------------------------------------------------------
create or replace function tuzatish_darslar_qosh(
  p_enrollment uuid,
  p_davr       text,
  p_darslar    uuid[],
  p_izoh       text    default null,
  p_qaytarish  text    default 'keyingi_oy',
  p_tekshirdim boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e         enrollments%rowtype;
  v_inv     invoices%rowtype;
  v_bosh    date;
  v_oxir    date;
  v_n       int;
  v_k       int;
  v_oylik   numeric;
  v_bir     numeric;
  v_summa   numeric;
  v_tol     numeric;
  v_ortiqcha numeric;
  v_qaytar  numeric;
  v_id      bigint;
  v_qulf    boolean;
  v_pay     bigint;
  v_yomon   int;
  v_sanalar text;
  v_fish    text;
  v_matn    text;
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Tuzatishni faqat admin, direktor yoki menejer kiritadi.';
  end if;
  if p_davr is null or p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy noto''g''ri (masalan 2026-11).';
  end if;
  if p_qaytarish not in ('keyingi_oy', 'naqd') then
    raise exception 'Qaytarish turi noto''g''ri.';
  end if;
  v_k := coalesce(cardinality(array(select distinct unnest(p_darslar))), 0);
  if v_k = 0 then
    raise exception 'Kamida bitta kelmagan darsni tanlang.';
  end if;

  select * into e from enrollments where id = p_enrollment for update;
  if not found then
    raise exception 'Yozilish topilmadi.';
  end if;
  select * into v_inv from invoices
   where enrollment_id = p_enrollment and davr = p_davr and holat <> 'bekor' for update;
  if not found then
    raise exception 'Bu oy uchun hisob-faktura yo''q — avval oy hisoblansin.';
  end if;

  -- Eski qo'lda tuzatish bor oyda — admin tekshirganini tasdiqlasin
  if not p_tekshirdim and exists (
    select 1 from tuzatishlar t
    where t.enrollment_id = p_enrollment and t.davr = p_davr and t.turi = 'qolda' and not t.bekor
  ) then
    raise exception 'Bu oyda qo''lda tuzatish bor — "Tekshirdim, ikki marta emas" belgisini qo''ying.';
  end if;

  v_bosh := to_date(p_davr || '-01', 'YYYY-MM-DD');
  v_oxir := (v_bosh + interval '1 month' - interval '1 day')::date;

  -- Har bir tanlangan dars: shu guruh, shu oy, o'tilgan, bola o'qigan davrda, "kelmadi"
  select count(*) into v_yomon
  from unnest(array(select distinct unnest(p_darslar))) x(id)
  left join lessons l on l.id = x.id
  left join attendance a on a.lesson_id = l.id and a.student_id = e.student_id
  where l.id is null
     or l.group_id <> e.group_id
     or not l.otkazildi
     or coalesce(l.kochirilgan_dan, l.sana) not between v_bosh and v_oxir
     or l.sana < e.boshlandi or (e.tugadi is not null and l.sana > e.tugadi)
     or a.holat is null
     or a.holat::text not in ('kelmadi', 'sababli');
  if v_yomon > 0 then
    raise exception 'Faqat shu oydagi "kelmadi" belgilangan darslarni tanlash mumkin (% ta dars mos emas).', v_yomon;
  end if;

  if exists (
    select 1 from tuzatish_darslar td
    where td.enrollment_id = p_enrollment and not td.bekor and td.lesson_id = any (p_darslar)
  ) then
    raise exception 'Tanlangan darslardan biri allaqachon qayta hisoblangan.';
  end if;

  v_n := tuzatish_oy_darslari(e.group_id, p_davr);
  if v_n <= 0 then
    raise exception 'Bu oyda guruh darslari topilmadi.';
  end if;
  v_oylik := v_inv.summa + v_inv.tuzatish;
  -- Jamshid 28.11: bir dars narxi yaxlitlanadi, keyin darslar soniga ko'paytiriladi —
  -- oynada ko'rsatilgan "k × bir dars" bilan haqiqiy summa doim bir xil
  v_bir   := round(v_oylik / v_n);
  v_summa := v_bir * v_k;
  if v_summa <= 0 then
    raise exception 'Hisoblangan summa 0 — oylik to''lov yo''q.';
  end if;
  if v_summa > v_inv.summa then
    raise exception 'Qayta hisob summasi (% so''m) oyning qolgan summasidan (% so''m) katta.', v_summa, v_inv.summa;
  end if;

  -- Ortiqcha to'lov: shu oy uchun to'langan − tuzatishdan keyingi summa
  select coalesce(sum(p.summa), 0) into v_tol
  from payments p where p.enrollment_id = p_enrollment and p.davr = p_davr and not p.bekor;
  v_ortiqcha := greatest(0, v_tol - (v_inv.summa - v_summa));
  if p_qaytarish = 'naqd' and v_ortiqcha <= 0 then
    raise exception 'Bu oy uchun ortiqcha to''lov chiqmaydi — naqd qaytarib bo''lmaydi.';
  end if;
  -- Naqd — jami ortiqcha (Jamshid 28.11): to'langan − shu oyning barcha qayta hisoblaridan
  -- keyingi summasi; avvalgi qayta hisobdan keyingi oyga o'tgan ortiqcha ham qaytadi.
  -- Oy qisman to'langan bo'lsa — avval qarz yopiladi, faqat ortgani qaytadi.
  v_qaytar := v_ortiqcha;

  select string_agg(to_char(l.sana, 'DD.MM'), ', ' order by l.sana) into v_sanalar
  from lessons l where l.id = any (p_darslar);

  v_qulf := maosh_oy_qulfmi(p_davr);

  insert into tuzatishlar (enrollment_id, davr, summa, sabab, kiritdi, turi, maosh_holati, qaytarish, tekshirdim)
  values (p_enrollment, p_davr, v_summa,
          v_k || ' dars kelmadi (' || v_sanalar || ')' || coalesce(' — ' || nullif(trim(p_izoh), ''), ''),
          auth.uid(), 'darslar', case when v_qulf then 'kutilmoqda' else 'oylikda' end,
          p_qaytarish, p_tekshirdim)
  returning id into v_id;

  insert into tuzatish_darslar (tuzatish_id, enrollment_id, lesson_id, sana, teacher_id)
  select v_id, p_enrollment, l.id, l.sana, coalesce(l.zamena_teacher_id, g.teacher_id)
  from lessons l join groups g on g.id = l.group_id
  where l.id = any (p_darslar);

  perform tuzatish_hisobla(p_enrollment, p_davr);

  -- Naqd qaytarish — manfiy to'lov, summa keyingi oyga o'tmaydi
  if p_qaytarish = 'naqd' then
    insert into payments (student_id, enrollment_id, sana, davr, summa, usul, qabul_qildi, izoh, qaytarish,
                          tasdiqlangan, tasdiqlangan_vaqt)
    values (e.student_id, p_enrollment, bugun_toshkent(), p_davr, -v_qaytar, 'naqd', auth.uid(),
            'Naqd qaytarildi — tuzatish #' || v_id, true, true, now())
    returning id into v_pay;
    update tuzatishlar set payment_id = v_pay where id = v_id;

    -- Kassadan haqiqiy pul chiqadi — direktorga xabar (tasdiq shart emas)
    select fish into v_fish from students where id = e.student_id;
    insert into bildirishnomalar (turi, sarlavha, matn, havola, havola_matn, kimga, filtr, tugash, yaratdi, manba)
    values ('eslatma', 'Kassadan naqd qaytarildi: ' || v_qaytar || ' so''m',
            left(coalesce(v_fish, e.student_id) || ', ' || p_davr || ', darslar: ' || v_sanalar
                 || coalesce(E'\nIzoh: ' || nullif(trim(p_izoh), ''), ''), 2000),
            '/crm/oquvchilar/' || e.student_id, 'Ko''rish', array['xodim'],
            jsonb_build_object('rol', 'direktor'), now() + interval '30 days', auth.uid(), 'naqd_qaytarish');
  end if;

  -- Qulflangan oy — rahbariyatga bildirishnoma
  if v_qulf then
    select fish into v_fish from students where id = e.student_id;
    v_matn := left(coalesce(v_fish, e.student_id) || ', ' || v_sanalar || ', ' || v_summa || ' so''m', 2000);
    insert into bildirishnomalar (turi, sarlavha, matn, havola, havola_matn, kimga, filtr, tugash, yaratdi, manba)
    values ('eslatma', left(p_davr || ' oyligi qulflangan, lekin o''quvchiga tuzatish berildi', 120), v_matn,
            '/crm/maosh?davr=' || p_davr, 'Qaror', array['xodim'],
            jsonb_build_object('rol', 'rahbariyat'),
            now() + interval '30 days', auth.uid(), 'tuzatish_qulf');
  end if;

  return jsonb_build_object('id', v_id, 'summa', v_summa, 'darslar', v_k, 'n', v_n,
                            'bir_dars', v_bir, 'kutilmoqda', v_qulf,
                            'qaytarildi', case when p_qaytarish = 'naqd' then v_qaytar else 0 end);
end;
$$;
revoke execute on function tuzatish_darslar_qosh(uuid, text, uuid[], text, text, boolean) from public, anon;
grant execute on function tuzatish_darslar_qosh(uuid, text, uuid[], text, text, boolean) to authenticated, service_role;


-- ------------------------------------------------------------
-- 8. Bekor qilish — sanalar bo'shaydi, naqd qaytarish va keyingi oy ayirmasi ham
-- ------------------------------------------------------------
create or replace function tuzatish_bekor(p_id bigint, p_sabab text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t tuzatishlar;
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Tuzatishni faqat admin, direktor yoki menejer bekor qiladi.';
  end if;

  update tuzatishlar
     set bekor = true, bekor_sabab = nullif(trim(p_sabab), ''), bekor_qildi = auth.uid()
   where id = p_id and not bekor
  returning * into v_t;

  if v_t.id is null then
    raise exception 'Tuzatish topilmadi yoki allaqachon bekor qilingan.';
  end if;

  update tuzatish_darslar set bekor = true where tuzatish_id = v_t.id and not bekor;

  -- Keyingi oylikka yozilgan ayirma — o'sha oy qulflanmagan bo'lsa bekor
  update maosh_harakatlar m
     set bekor = true, bekor_sabab = 'Tuzatish #' || v_t.id || ' bekor qilindi'
   where not m.bekor and not maosh_oy_qulfmi(m.davr)
     and m.id in (select td.maosh_harakat_id from tuzatish_darslar td where td.tuzatish_id = v_t.id);

  if v_t.payment_id is not null then
    update payments set bekor = true, bekor_sabab = 'Tuzatish #' || v_t.id || ' bekor qilindi'
     where id = v_t.payment_id and not bekor;
  end if;

  perform tuzatish_hisobla(v_t.enrollment_id, v_t.davr);
end;
$$;

-- Dars bo'yicha tuzatish summasi formula bilan — qo'lda tahrirlanmaydi
do $$
declare
  v_def text := pg_get_functiondef('tuzatish_tahrir(bigint, numeric, text)'::regprocedure);
  v_joy text := 'if p_summa is null or p_summa <= 0 then';
begin
  if v_def like '%0147: darslar%' then
    return;
  end if;
  if position(v_joy in v_def) = 0 then
    raise exception '0147: tuzatish_tahrir kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_joy,
    '/* 0147: darslar */
  if exists (select 1 from tuzatishlar where id = p_id and turi = ''darslar'') then
    raise exception ''Dars bo''''yicha tuzatish tahrirlanmaydi — bekor qilib, qayta kiriting.'';
  end if;
  ' || v_joy);
end $$;


-- ------------------------------------------------------------
-- 9. Ustoz oyligi — har dars holati va maosh_qatorlari
-- ------------------------------------------------------------
-- maosh_qatorlari (0137 + 0145) dagi CTE'lar shu yerga ko'chdi: bitta joyda
-- har dars uchun ketma-ket 3+ (ayir) va tuzatish (tuz) belgisi.
create or replace function maosh_dars_holati(p_davr text)
returns table (
  ustoz        text,
  guruh_ustozi text,
  group_id     text,
  lesson_id    uuid,
  sana         date,
  zamena       boolean,
  eid          uuid,
  student_id   text,
  n            int,
  ayir         boolean,   -- ketma-ket 3+ kelmaslik
  tuz          boolean    -- tuzatish berilgan va ustoz oyligidan ayiriladi (oylikda)
)
language sql stable security definer set search_path = public as $$
  with oy as (
    select to_date(p_davr || '-01', 'YYYY-MM-DD') as bosh,
           (to_date(p_davr || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date as oxir
  ),
  dars as (
    select l.id, l.group_id, l.sana, coalesce(l.zamena_teacher_id, g.teacher_id) as ustoz,
           g.teacher_id as guruh_ustozi, l.zamena_teacher_id is not null as zamena
    from lessons l
    join groups g on g.id = l.group_id
    cross join oy
    where l.otkazildi and coalesce(l.kochirilgan_dan, l.sana) between oy.bosh and oy.oxir
  ),
  nn as materialized (
    select g.id as group_id,
           greatest(12,
             (select count(*) from dars d where d.group_id = g.id),
             case when oy.oxir < bugun_toshkent() then 0 else guruh_oy_darslari(g.id, p_davr) end
           )::int as n
    from groups g cross join oy
    where exists (select 1 from dars d where d.group_id = g.id)
  ),
  qator as (
    select d.*, e.id as eid, e.student_id,
           coalesce(a.holat = 'kelmadi', false) as yoq
    from dars d
    join enrollments e on e.group_id = d.group_id
     and d.sana >= e.boshlandi and (e.tugadi is null or d.sana <= e.tugadi)
    left join attendance a on a.lesson_id = d.id and a.student_id = e.student_id
  ),
  orol as (
    select q.*,
           row_number() over (partition by q.eid order by q.sana)
         - row_number() over (partition by q.eid, q.yoq order by q.sana) as orol
    from qator q
  ),
  seriya as (
    select o.*, o.yoq and count(*) over (partition by o.eid, o.yoq, o.orol) >= 3 as ayir
    from orol o
  )
  select s.ustoz, s.guruh_ustozi, s.group_id, s.id, s.sana, s.zamena, s.eid, s.student_id, nn.n, s.ayir,
         exists (select 1 from tuzatish_darslar td join tuzatishlar t on t.id = td.tuzatish_id
                 where td.lesson_id = s.id and td.enrollment_id = s.eid and not td.bekor
                   and not t.bekor and t.maosh_holati = 'oylikda')
  from seriya s
  join nn on nn.group_id = s.group_id
$$;
revoke execute on function maosh_dars_holati(text) from public, anon, authenticated;
grant execute on function maosh_dars_holati(text) to service_role;

-- Chiqish ustunlari o'zgarmaydi (maosh_jonli, tafsilot va boshqalar shunday o'qiydi).
-- summa = asosiy (0145: 12+ dars to'liq) − stavka/n × tuzatilgan (ayir bo'lmagan), ≥ 0
create or replace function maosh_qatorlari(p_davr text)
returns table (
  teacher_id    text,
  group_id      text,
  guruh         text,
  enrollment_id uuid,
  student_id    text,
  fish          text,
  stavka        numeric,
  n             int,
  darslar       int,
  ayirildi      int,
  hisob_darslar int,
  summa         numeric,
  zamena        boolean
)
language sql stable security definer set search_path = public as $$
  select s.ustoz, s.group_id, g.nom, s.eid, s.student_id, st.fish,
         gs.stavka, s.n,
         count(*)::int,
         count(*) filter (where s.ayir)::int,
         count(*) filter (where not s.ayir)::int,
         greatest(0,
           /* 0145: 12+ dars — to'liq oy */
           round(gs.stavka * count(*) filter (where not s.ayir)
                 / case when sum(count(*) filter (where not s.ayir)) over (partition by s.eid) >= 12
                        then sum(count(*) filter (where not s.ayir)) over (partition by s.eid)
                        else s.n end)
           /* 0147: tuzatilgan dars — 12 lik qoidadan keyin, har doim stavka/n */
           - round(gs.stavka / s.n) * count(*) filter (where s.tuz and not s.ayir)),
         bool_or(s.zamena)
  from maosh_dars_holati(p_davr) s
  join groups g on g.id = s.group_id
  join students st on st.id = s.student_id
  left join teacher_salaries ts on ts.teacher_id = s.guruh_ustozi
  cross join lateral (
    select case when g.turi = 'umumiy' then ts.qiymati
                else (select (st2.qiymat ->> g.turi)::numeric from settings st2 where st2.kalit = 'maosh.guruh_turi')
           end as stavka
  ) gs
  where s.ustoz is not null
  group by s.ustoz, s.group_id, g.nom, s.eid, s.student_id, st.fish, gs.stavka, s.n, s.zamena
$$;
revoke execute on function maosh_qatorlari(text) from public, anon, authenticated;
grant execute on function maosh_qatorlari(text) to service_role;

-- Har ayirilgan sana va sababi (hisobot + ustoz paneli)
create or replace function maosh_ayirmalar(p_davr text, p_ustoz text default null)
returns table (
  teacher_id text, group_id text, guruh text, student_id text, fish text,
  sana date, sabab text, summa numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_admin() then
    if p_ustoz is distinct from app_teacher_id() then
      raise exception 'Bu ustozning maoshini ko''ra olmaysiz.';
    end if;
    if not tuzatish_korinadimi('ustoz') then
      return;
    end if;
  end if;
  if p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy YYYY-MM ko''rinishida bo''lsin.';
  end if;

  return query
  select h.ustoz, h.group_id, g.nom, h.student_id, st.fish, h.sana,
         case when h.ayir then 'ketma_ket' else 'tuzatish' end,
         round(gs.stavka / h.n)
  from maosh_dars_holati(p_davr) h
  join groups g on g.id = h.group_id
  join students st on st.id = h.student_id
  left join teacher_salaries ts on ts.teacher_id = h.guruh_ustozi
  cross join lateral (
    select case when g.turi = 'umumiy' then ts.qiymati
                else (select (st2.qiymat ->> g.turi)::numeric from settings st2 where st2.kalit = 'maosh.guruh_turi')
           end as stavka
  ) gs
  where (h.ayir or h.tuz)
    and (p_ustoz is null or h.ustoz = p_ustoz)
  order by h.sana, st.fish;
end;
$$;
revoke execute on function maosh_ayirmalar(text, text) from public, anon;
grant execute on function maosh_ayirmalar(text, text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 10. Qulflangan oy — direktor qarori
-- ------------------------------------------------------------
alter table maosh_harakatlar drop constraint if exists maosh_harakatlar_turi_check;
alter table maosh_harakatlar add constraint maosh_harakatlar_turi_check
  check (turi in ('avans', 'bonus', 'jarima', 'tuzatish', 'oquvchi_tuzatish'));

-- maosh_jonli: oquvchi_tuzatish — ayiriladi (jarima ustunida jamlanadi)
do $$
declare
  v_def text := pg_get_functiondef('maosh_jonli(text)'::regprocedure);
  v_joy text := 'filter (where m.turi = ''jarima'')';
begin
  if v_def like '%oquvchi_tuzatish%' then
    return;
  end if;
  if position(v_joy in v_def) = 0 then
    raise exception '0147: maosh_jonli kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_joy, 'filter (where m.turi in (''jarima'', ''oquvchi_tuzatish''))');
end $$;

create or replace function tuzatish_maosh_qaror(p_id bigint, p_qaror text) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_t     tuzatishlar;
  v_davr  text;
  v_oy    text;
  v_r     record;
  v_h     bigint;
  v_soni  int := 0;
begin
  if auth.uid() is not null and not app_is_direktor() then
    raise exception 'Qulflangan oy bo''yicha qarorni faqat direktor qabul qiladi.';
  end if;
  if p_qaror not in ('keyingi_oy', 'otkazish') then
    raise exception 'Qaror: keyingi_oy yoki otkazish.';
  end if;

  select * into v_t from tuzatishlar where id = p_id for update;
  if not found or v_t.bekor or v_t.maosh_holati is distinct from 'kutilmoqda' then
    raise exception 'Bu tuzatish bo''yicha qaror kutilmayapti.';
  end if;

  if p_qaror = 'keyingi_oy' then
    -- Tuzatish oyidan keyingi birinchi qulflanmagan oy
    v_davr := to_char(to_date(v_t.davr || '-01', 'YYYY-MM-DD') + interval '1 month', 'YYYY-MM');
    while maosh_oy_qulfmi(v_davr) loop
      v_davr := to_char(to_date(v_davr || '-01', 'YYYY-MM-DD') + interval '1 month', 'YYYY-MM');
    end loop;
    v_oy := (array['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust',
                   'Sentabr','Oktabr','Noyabr','Dekabr'])[substr(v_t.davr, 6, 2)::int];

    -- Har dars: o'tgan ustozdan stavka/n; ketma-ket 3+ sababli ayirilgan dars — yo'q
    for v_r in
      select td.id as td_id, h.ustoz, h.sana, st.fish, round(gs.stavka / h.n) as summa
      from tuzatish_darslar td
      join maosh_dars_holati(v_t.davr) h on h.lesson_id = td.lesson_id and h.eid = td.enrollment_id
      join groups g on g.id = h.group_id
      join students st on st.id = h.student_id
      left join teacher_salaries ts on ts.teacher_id = h.guruh_ustozi
      cross join lateral (
        select case when g.turi = 'umumiy' then ts.qiymati
                    else (select (st2.qiymat ->> g.turi)::numeric from settings st2 where st2.kalit = 'maosh.guruh_turi')
               end as stavka
      ) gs
      where td.tuzatish_id = v_t.id and not td.bekor and not h.ayir and h.ustoz is not null
    loop
      if coalesce(v_r.summa, 0) > 0 then
        insert into maosh_harakatlar (teacher_id, davr, turi, summa, izoh)
        values (v_r.ustoz, v_davr, 'oquvchi_tuzatish', v_r.summa,
                v_oy || ' tuzatishi: ' || v_r.fish || ', ' || to_char(v_r.sana, 'DD.MM'))
        returning id into v_h;
        update tuzatish_darslar set maosh_harakat_id = v_h where id = v_r.td_id;
        v_soni := v_soni + 1;
      end if;
    end loop;
  end if;

  update tuzatishlar
     set maosh_holati = case when p_qaror = 'keyingi_oy' then 'keyingi_oy' else 'otkazildi' end,
         maosh_qaror_qildi = auth.uid(), maosh_qaror_vaqti = now()
   where id = v_t.id;

  insert into audit_log (profile_id, amal, jadval, obyekt_id, eski, yangi)
  values (auth.uid(), 'TUZATISH_MAOSH_QAROR', 'tuzatishlar', v_t.id::text,
          jsonb_build_object('maosh_holati', v_t.maosh_holati),
          jsonb_build_object('qaror', p_qaror, 'davr', v_davr, 'harakatlar', v_soni));

  return v_soni;
end;
$$;
revoke execute on function tuzatish_maosh_qaror(bigint, text) from public, anon;
grant execute on function tuzatish_maosh_qaror(bigint, text) to authenticated, service_role;
