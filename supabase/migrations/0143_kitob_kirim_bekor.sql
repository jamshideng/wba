-- ============================================================
--  World Bridge Academy
--  0143_kitob_kirim_bekor.sql · KITOBLAR 2-BOSQICH (Jamshid, 23.11)
--
--  1. Katalog: izoh; kirimi/buyurtmasi bor kitob o'chirilmaydi (arxiv).
--  2. Kirim: tahrir (soni, sana, izoh) va sabab bilan bekor.
--  3. Buyurtma: o'quvchi bo'yicha holat (faol / olib_tashlandi / qaytarildi).
--     Berildidan oldin ustoz ro'yxatni o'zgartiradi; keyin rahbariyat
--     qaytaradi (hammasi yoki ayrim o'quvchilar). Hech narsa o'chirilmaydi.
--  4. Takroriy berish — ogohlantirish (taqiq emas).
--  5. Hisobot — sana bo'yicha.
--  6. Tuzatish: buyurtma faqat ustozning DOIMIY guruhiga (zamena emas),
--     faqat faol o'quvchiga (tanaffus/arxiv — rad).
--
--  Qoldiq endi o'quvchi qatorlaridan hisoblanadi:
--    berilgan = berildi buyurtmalardagi faol qatorlar
--    band     = kutilayotgan buyurtmalardagi faol qatorlar
--    omborda  = kirim (bekor emas) − berilgan;  bo'sh = omborda − band
-- ============================================================


-- ------------------------------------------------------------
-- 1. Katalog
-- ------------------------------------------------------------

alter table kitoblar add column if not exists izoh text;

/* Kirim yoki buyurtma bo'lgan kitob o'chirilmaydi — faqat arxiv */
create or replace function kitoblar_ochirish_himoya() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from kitob_kirim where kitob_id = old.id)
     or exists (select 1 from kitob_buyurtmalar where kitob_id = old.id) then
    raise exception 'Bu kitobning kirimi yoki buyurtmasi bor — o''chirilmaydi, arxivga o''tkazing.';
  end if;
  return old;
end;
$$;
drop trigger if exists kitoblar_ochirish_himoya on kitoblar;
create trigger kitoblar_ochirish_himoya before delete on kitoblar
  for each row execute function kitoblar_ochirish_himoya();


-- ------------------------------------------------------------
-- 2. Kirim: bekor ustunlari
-- ------------------------------------------------------------

alter table kitob_kirim add column if not exists bekor       boolean not null default false;
alter table kitob_kirim add column if not exists bekor_sabab text;
alter table kitob_kirim add column if not exists bekor_qildi uuid references profiles (id) on delete set null;
alter table kitob_kirim add column if not exists bekor_vaqt  timestamptz;
alter table kitob_kirim add column if not exists tahrir_vaqt timestamptz;
comment on column kitob_kirim.bekor is 'Xato kirim — qoldiqqa kirmaydi (0143). Qator o''chirilmaydi.';


-- ------------------------------------------------------------
-- 3. Buyurtma: o'quvchi bo'yicha holat
-- ------------------------------------------------------------

alter table kitob_buyurtmalar drop constraint if exists kitob_buyurtmalar_holat_check;
alter table kitob_buyurtmalar add constraint kitob_buyurtmalar_holat_check
  check (holat in ('kutilmoqda', 'berildi', 'bekor', 'qaytarildi'));
comment on column kitob_buyurtmalar.soni is 'Buyurtmadagi o''quvchilar soni (berilguncha o''zgaradi). Qoldiq o''quvchi qatorlaridan hisoblanadi.';

alter table kitob_buyurtma_oquvchilar add column if not exists id              uuid not null default gen_random_uuid();
alter table kitob_buyurtma_oquvchilar add column if not exists holat           text not null default 'faol';
alter table kitob_buyurtma_oquvchilar add column if not exists sabab           text;
alter table kitob_buyurtma_oquvchilar add column if not exists ozgartirdi      uuid references profiles (id) on delete set null;
alter table kitob_buyurtma_oquvchilar add column if not exists ozgartirish_vaqt timestamptz;
alter table kitob_buyurtma_oquvchilar add column if not exists created_at      timestamptz not null default now();
alter table kitob_buyurtma_oquvchilar drop constraint if exists kitob_buyurtma_oquvchilar_holat_check;
alter table kitob_buyurtma_oquvchilar add constraint kitob_buyurtma_oquvchilar_holat_check
  check (holat in ('faol', 'olib_tashlandi', 'qaytarildi'));
create unique index if not exists kitob_buyurtma_oquvchilar_id_uniq on kitob_buyurtma_oquvchilar (id);

drop trigger if exists kitob_buyurtma_oquvchilar_audit on kitob_buyurtma_oquvchilar;
create trigger kitob_buyurtma_oquvchilar_audit after insert or update or delete on kitob_buyurtma_oquvchilar
  for each row execute function audit_trigger();

/* Buyurtma o'quvchilari ham faqat funksiyalar orqali; o'chirish hech kimga yo'q */
drop trigger if exists kitob_buyurtma_oquvchilar_ochirilmaydi on kitob_buyurtma_oquvchilar;
create or replace function kitob_ochirilmaydi() returns trigger
language plpgsql as $$
begin
  raise exception 'Kitob yozuvlari o''chirilmaydi — holat va sabab bilan yopiladi.';
end;
$$;
create trigger kitob_buyurtma_oquvchilar_ochirilmaydi before delete on kitob_buyurtma_oquvchilar
  for each row execute function kitob_ochirilmaydi();
drop trigger if exists kitob_buyurtmalar_ochirilmaydi on kitob_buyurtmalar;
create trigger kitob_buyurtmalar_ochirilmaydi before delete on kitob_buyurtmalar
  for each row execute function kitob_ochirilmaydi();
drop trigger if exists kitob_kirim_ochirilmaydi on kitob_kirim;
create trigger kitob_kirim_ochirilmaydi before delete on kitob_kirim
  for each row execute function kitob_ochirilmaydi();


-- ------------------------------------------------------------
-- 4. Qoldiq (qaytarilgan ustuni qo'shildi — qaytish turi o'zgargani uchun drop)
-- ------------------------------------------------------------

drop function if exists kitob_qoldiq();
create function kitob_qoldiq()
returns table (
  kitob_id uuid, nom text, subject_id text, holat text, izoh text,
  kelgan int, berilgan int, qaytarilgan int, band int, omborda int, bosh int
)
language sql stable security definer set search_path = public as $$
  select k.id, k.nom, k.subject_id, k.holat, k.izoh,
         coalesce(ki.n, 0)::int                                          as kelgan,
         coalesce(o.berilgan, 0)::int                                    as berilgan,
         coalesce(o.qaytarilgan, 0)::int                                 as qaytarilgan,
         coalesce(o.band, 0)::int                                        as band,
         (coalesce(ki.n, 0) - coalesce(o.berilgan, 0))::int              as omborda,
         (coalesce(ki.n, 0) - coalesce(o.berilgan, 0) - coalesce(o.band, 0))::int as bosh
  from kitoblar k
  left join lateral (select sum(soni) as n from kitob_kirim where kitob_id = k.id and not bekor) ki on true
  left join lateral (
    select count(*) filter (where b.holat = 'berildi'    and bo.holat = 'faol')       as berilgan,
           count(*) filter (where b.holat = 'kutilmoqda' and bo.holat = 'faol')       as band,
           count(*) filter (where bo.holat = 'qaytarildi')                            as qaytarilgan
    from kitob_buyurtmalar b
    join kitob_buyurtma_oquvchilar bo on bo.buyurtma_id = b.id
    where b.kitob_id = k.id
  ) o on true
  where app_is_admin() or app_teacher_id() is not null
  order by k.holat, k.nom
$$;
revoke execute on function kitob_qoldiq() from public, anon;
grant  execute on function kitob_qoldiq() to authenticated, service_role;

/* Ichki: bir kitobning bo'sh qoldig'i (huquq tekshiruvisiz, faqat funksiyalar ichida) */
create or replace function kitob_bosh_ichki(p_kitob uuid) returns int
language sql stable security definer set search_path = public as $$
  select ((select coalesce(sum(soni), 0) from kitob_kirim where kitob_id = p_kitob and not bekor)
        - (select count(*) from kitob_buyurtmalar b join kitob_buyurtma_oquvchilar bo on bo.buyurtma_id = b.id
            where b.kitob_id = p_kitob and bo.holat = 'faol' and b.holat in ('berildi', 'kutilmoqda')))::int
$$;
revoke execute on function kitob_bosh_ichki(uuid) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 5. Kirim: tahrir va bekor
-- ------------------------------------------------------------

create or replace function kitob_kirim_tahrir(p_kirim uuid, p_soni int, p_sana date, p_izoh text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_k kitob_kirim;
begin
  if not app_is_admin() then
    raise exception 'Kirimni direktor, admin yoki manager tahrirlaydi.';
  end if;
  if p_soni is null or p_soni < 1 or p_soni > 10000 then
    raise exception 'Soni 1 dan 10000 gacha bo''lsin.';
  end if;
  select * into v_k from kitob_kirim where id = p_kirim;
  if v_k.id is null or v_k.bekor then
    raise exception 'Kirim topilmadi yoki bekor qilingan.';
  end if;

  perform 1 from kitoblar where id = v_k.kitob_id for update;
  if kitob_bosh_ichki(v_k.kitob_id) - v_k.soni + p_soni < 0 then
    raise exception 'Bunchalik kamaytirib bo''lmaydi: berilgan va band kitoblar uchun yetmay qoladi (bo''sh qoldiq %).',
      kitob_bosh_ichki(v_k.kitob_id);
  end if;

  update kitob_kirim
     set soni = p_soni, sana = coalesce(p_sana, sana), izoh = nullif(trim(p_izoh), ''), tahrir_vaqt = now()
   where id = v_k.id;
end;
$$;

create or replace function kitob_kirim_bekor(p_kirim uuid, p_sabab text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_k kitob_kirim;
begin
  if not app_is_admin() then
    raise exception 'Kirimni direktor, admin yoki manager bekor qiladi.';
  end if;
  if nullif(trim(p_sabab), '') is null then
    raise exception 'Bekor qilish sababini yozing.';
  end if;
  select * into v_k from kitob_kirim where id = p_kirim;
  if v_k.id is null or v_k.bekor then
    raise exception 'Kirim topilmadi yoki allaqachon bekor qilingan.';
  end if;

  perform 1 from kitoblar where id = v_k.kitob_id for update;
  if kitob_bosh_ichki(v_k.kitob_id) < v_k.soni then
    raise exception 'Bekor qilib bo''lmaydi: berilgan va band kitoblar uchun yetmay qoladi (bo''sh qoldiq %, kirim %).',
      greatest(kitob_bosh_ichki(v_k.kitob_id), 0), v_k.soni;
  end if;

  update kitob_kirim
     set bekor = true, bekor_sabab = trim(p_sabab), bekor_qildi = auth.uid(), bekor_vaqt = now()
   where id = v_k.id;
end;
$$;


-- ------------------------------------------------------------
-- 6. Buyurtma: o'quvchilarni tekshirish (QAT'IY: doimiy guruh, faol o'quvchi)
-- ------------------------------------------------------------

create or replace function kitob_oquvchilar_tekshir(p_group text, p_oquvchilar text[]) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare
  v_ids text[];
  v_yomon text;
begin
  select array_agg(distinct trim(x)) into v_ids
  from unnest(coalesce(p_oquvchilar, '{}')) x where nullif(trim(x), '') is not null;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Kamida bitta o''quvchini belgilang.';
  end if;
  if array_length(v_ids, 1) > 100 then
    raise exception 'Bitta buyurtmada 100 tadan ko''p bo''lmaydi.';
  end if;

  select string_agg(coalesce(s.fish, x), ', ') into v_yomon
  from unnest(v_ids) x
  left join students s on s.id = x
  where not exists (
    select 1 from enrollments e
    join students st on st.id = e.student_id
    where e.student_id = x and e.group_id = p_group and e.holat = 'faol' and st.holat = 'faol'
  );
  if v_yomon is not null then
    raise exception 'Bu o''quvchilar guruhda faol emas (tanaffus, arxiv yoki boshqa guruh): %', v_yomon;
  end if;
  return v_ids;
end;
$$;
revoke execute on function kitob_oquvchilar_tekshir(text, text[]) from public, anon, authenticated;

/* Ustoz — faqat o'zining DOIMIY guruhi (zamena huquq bermaydi) */
create or replace function kitob_ustoz_guruhimi(p_group text) returns boolean
language sql stable security definer set search_path = public as $$
  select app_teacher_id() is not null
     and exists (select 1 from groups where id = p_group and teacher_id = app_teacher_id())
$$;
revoke execute on function kitob_ustoz_guruhimi(text) from public, anon, authenticated;

create or replace function kitob_buyurtma(p_kitob uuid, p_group text, p_oquvchilar text[])
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_ustoz text := app_teacher_id();
  v_k     kitoblar;
  v_ids   text[];
  v_soni  int;
  v_bosh  int;
  v_kod   text;
  v_id    uuid;
begin
  if v_ustoz is null then
    raise exception 'Kitob buyurtmasini ustoz o''z guruhi uchun beradi.';
  end if;
  if not kitob_ustoz_guruhimi(p_group) then
    raise exception 'Bu guruh sizning doimiy guruhingiz emas.';
  end if;
  v_ids := kitob_oquvchilar_tekshir(p_group, p_oquvchilar);
  v_soni := array_length(v_ids, 1);

  select * into v_k from kitoblar where id = p_kitob for update;
  if v_k.id is null or v_k.holat <> 'faol' then
    raise exception 'Bu kitob hozir berilmaydi (arxivda yoki topilmadi).';
  end if;
  v_bosh := kitob_bosh_ichki(p_kitob);
  if v_bosh < v_soni then
    raise exception 'Omborda yetarli emas: % ta bo''sh, kerak %.', greatest(v_bosh, 0), v_soni;
  end if;

  v_kod := kitob_kod();
  insert into kitob_buyurtmalar (kod, kitob_id, kitob_nomi, teacher_id, group_id, soni, buyurtmachi)
  values (v_kod, v_k.id, v_k.nom, v_ustoz, p_group, v_soni, auth.uid())
  returning id into v_id;
  insert into kitob_buyurtma_oquvchilar (buyurtma_id, student_id)
  select v_id, s from unnest(v_ids) s;
  return v_kod;
end;
$$;

/* Berildidan oldin ro'yxatni o'zgartirish: ustoz (o'ziniki) yoki rahbariyat */
create or replace function kitob_buyurtma_ozgartir(p_kod text, p_oquvchilar text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_b    kitob_buyurtmalar;
  v_ids  text[];
  v_eski int;
begin
  select * into v_b from kitob_buyurtmalar where kod = upper(trim(p_kod)) for update;
  if v_b.id is null or v_b.holat <> 'kutilmoqda' then
    raise exception 'Faqat kutilayotgan (hali berilmagan) buyurtmani o''zgartirish mumkin.';
  end if;
  if not app_is_admin() and not (v_b.teacher_id = app_teacher_id() and kitob_ustoz_guruhimi(v_b.group_id)) then
    raise exception 'Bu buyurtmani o''zgartira olmaysiz.';
  end if;
  v_ids := kitob_oquvchilar_tekshir(v_b.group_id, p_oquvchilar);

  perform 1 from kitoblar where id = v_b.kitob_id for update;
  select count(*) into v_eski from kitob_buyurtma_oquvchilar where buyurtma_id = v_b.id and holat = 'faol';
  if kitob_bosh_ichki(v_b.kitob_id) + v_eski < array_length(v_ids, 1) then
    raise exception 'Omborda yetarli emas: % ta bo''sh, kerak %.',
      greatest(kitob_bosh_ichki(v_b.kitob_id) + v_eski, 0), array_length(v_ids, 1);
  end if;

  -- Ro'yxatdan chiqqanlar — o'chirilmaydi, holat bilan
  update kitob_buyurtma_oquvchilar
     set holat = 'olib_tashlandi', sabab = 'Ro''yxatdan olindi', ozgartirdi = auth.uid(), ozgartirish_vaqt = now()
   where buyurtma_id = v_b.id and holat = 'faol' and not (student_id = any (v_ids));
  -- Qayta qo'shilganlar
  update kitob_buyurtma_oquvchilar
     set holat = 'faol', sabab = null, ozgartirdi = auth.uid(), ozgartirish_vaqt = now()
   where buyurtma_id = v_b.id and holat = 'olib_tashlandi' and student_id = any (v_ids);
  -- Yangilar
  insert into kitob_buyurtma_oquvchilar (buyurtma_id, student_id)
  select v_b.id, s from unnest(v_ids) s
  on conflict (buyurtma_id, student_id) do nothing;

  update kitob_buyurtmalar set soni = array_length(v_ids, 1) where id = v_b.id;
end;
$$;

/* Bekor (berildidan oldin): ustoz o'ziniki yoki rahbariyat; sabab majburiy */
create or replace function kitob_bekor(p_kod text, p_sabab text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_b kitob_buyurtmalar;
begin
  if nullif(trim(p_sabab), '') is null then
    raise exception 'Bekor qilish sababini yozing.';
  end if;
  select * into v_b from kitob_buyurtmalar where kod = upper(trim(p_kod)) for update;
  if v_b.id is null or v_b.holat <> 'kutilmoqda' then
    raise exception 'Kod topilmadi yoki buyurtma allaqachon yopilgan.';
  end if;
  if not app_is_admin() and (v_b.teacher_id is null or v_b.teacher_id is distinct from app_teacher_id()) then
    raise exception 'Bu buyurtmani bekor qila olmaysiz.';
  end if;
  update kitob_buyurtmalar
     set holat = 'bekor', bekor_sabab = trim(p_sabab), bekor_qildi = auth.uid(), bekor_vaqt = now()
   where id = v_b.id;
end;
$$;

/* Qaytarish (berildidan keyin): faqat rahbariyat; p_oquvchilar null — hammasi */
create or replace function kitob_qaytar(p_kod text, p_oquvchilar text[], p_sabab text) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_b kitob_buyurtmalar;
  v_n int;
begin
  if not app_is_admin() then
    raise exception 'Qaytarishni direktor, admin yoki manager qiladi.';
  end if;
  if nullif(trim(p_sabab), '') is null then
    raise exception 'Qaytarish sababini yozing.';
  end if;
  select * into v_b from kitob_buyurtmalar where kod = upper(trim(p_kod)) for update;
  if v_b.id is null or v_b.holat <> 'berildi' then
    raise exception 'Faqat berilgan buyurtmadan qaytarish mumkin.';
  end if;

  update kitob_buyurtma_oquvchilar
     set holat = 'qaytarildi', sabab = trim(p_sabab), ozgartirdi = auth.uid(), ozgartirish_vaqt = now()
   where buyurtma_id = v_b.id and holat = 'faol'
     and (p_oquvchilar is null or student_id = any (p_oquvchilar));
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Qaytariladigan o''quvchi tanlanmadi.';
  end if;

  if not exists (select 1 from kitob_buyurtma_oquvchilar where buyurtma_id = v_b.id and holat = 'faol') then
    update kitob_buyurtmalar
       set holat = 'qaytarildi', bekor_sabab = trim(p_sabab), bekor_qildi = auth.uid(), bekor_vaqt = now()
     where id = v_b.id;
  end if;
  return v_n;
end;
$$;


-- ------------------------------------------------------------
-- 7. Takroriy berish — ogohlantirish uchun
-- ------------------------------------------------------------

/* Shu kitobni avval olgan / kutayotgan o'quvchilar. Ustoz faqat o'z
   doimiy guruhlaridagi o'quvchilar haqida so'ray oladi. */
create or replace function kitob_takroriy(p_kitob uuid, p_oquvchilar text[])
returns table (student_id text, kod text, holat text, sana timestamptz)
language sql stable security definer set search_path = public as $$
  select bo.student_id, b.kod, b.holat, coalesce(b.berildi_vaqt, b.created_at)
  from kitob_buyurtma_oquvchilar bo
  join kitob_buyurtmalar b on b.id = bo.buyurtma_id
  where b.kitob_id = p_kitob
    and bo.holat = 'faol'
    and b.holat in ('kutilmoqda', 'berildi')
    and bo.student_id = any (p_oquvchilar)
    and (
      app_is_admin()
      or exists (
        select 1 from enrollments e join groups g on g.id = e.group_id
        where e.student_id = bo.student_id and e.holat <> 'tugagan' and g.teacher_id = app_teacher_id()
      )
    )
  order by 4 desc
$$;


-- ------------------------------------------------------------
-- 8. Hisobot (rahbariyat): davr bo'yicha
-- ------------------------------------------------------------

create or replace function kitob_hisobot(p_dan date, p_gacha date)
returns table (kitob_id uuid, nom text, holat text, kelgan int, berilgan int, qaytarilgan int)
language sql stable security definer set search_path = public as $$
  select k.id, k.nom, k.holat,
    (select coalesce(sum(soni), 0) from kitob_kirim ki
      where ki.kitob_id = k.id and not ki.bekor and ki.sana between p_dan and p_gacha)::int,
    (select count(*) from kitob_buyurtmalar b join kitob_buyurtma_oquvchilar bo on bo.buyurtma_id = b.id
      where b.kitob_id = k.id and bo.holat in ('faol', 'qaytarildi') and b.berildi_vaqt is not null
        and (b.berildi_vaqt at time zone 'Asia/Tashkent')::date between p_dan and p_gacha)::int,
    (select count(*) from kitob_buyurtmalar b join kitob_buyurtma_oquvchilar bo on bo.buyurtma_id = b.id
      where b.kitob_id = k.id and bo.holat = 'qaytarildi'
        and (bo.ozgartirish_vaqt at time zone 'Asia/Tashkent')::date between p_dan and p_gacha)::int
  from kitoblar k
  where app_is_admin()
  order by k.holat, k.nom
$$;

create or replace function kitob_berilganlar(p_dan date, p_gacha date)
returns table (
  student_id text, fish text, kitob text, kod text, ustoz text, guruh text,
  berildi_vaqt timestamptz, holat text, sabab text
)
language sql stable security definer set search_path = public as $$
  select bo.student_id, s.fish, b.kitob_nomi, b.kod, t.ism, g.nom, b.berildi_vaqt, bo.holat, bo.sabab
  from kitob_buyurtma_oquvchilar bo
  join kitob_buyurtmalar b on b.id = bo.buyurtma_id
  left join students s on s.id = bo.student_id
  left join teachers t on t.id = b.teacher_id
  left join groups g on g.id = b.group_id
  where app_is_admin()
    and b.berildi_vaqt is not null
    and bo.holat in ('faol', 'qaytarildi')
    and (b.berildi_vaqt at time zone 'Asia/Tashkent')::date between p_dan and p_gacha
  order by s.fish, b.berildi_vaqt
$$;


-- ------------------------------------------------------------
-- 9. Huquqlar
-- ------------------------------------------------------------

revoke execute on function kitob_kirim_tahrir(uuid, int, date, text) from public, anon;
grant  execute on function kitob_kirim_tahrir(uuid, int, date, text) to authenticated, service_role;
revoke execute on function kitob_kirim_bekor(uuid, text) from public, anon;
grant  execute on function kitob_kirim_bekor(uuid, text) to authenticated, service_role;
revoke execute on function kitob_buyurtma_ozgartir(text, text[]) from public, anon;
grant  execute on function kitob_buyurtma_ozgartir(text, text[]) to authenticated, service_role;
revoke execute on function kitob_qaytar(text, text[], text) from public, anon;
grant  execute on function kitob_qaytar(text, text[], text) to authenticated, service_role;
revoke execute on function kitob_takroriy(uuid, text[]) from public, anon;
grant  execute on function kitob_takroriy(uuid, text[]) to authenticated, service_role;
revoke execute on function kitob_hisobot(date, date) from public, anon;
grant  execute on function kitob_hisobot(date, date) to authenticated, service_role;
revoke execute on function kitob_berilganlar(date, date) from public, anon;
grant  execute on function kitob_berilganlar(date, date) to authenticated, service_role;
