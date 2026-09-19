-- Faqat LOKAL TEST. Bizneс-mantiq va RLS haqiqatan ishlayaptimi — tekshiradi.
\set ON_ERROR_STOP on
\pset pager off

-- ============================================================
--  1. Namuna ma'lumot
-- ============================================================

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@wba.uz'),
  ('22222222-2222-2222-2222-222222222222', 'kassa@wba.uz'),
  ('33333333-3333-3333-3333-333333333333', 'diana@wba.uz'),
  ('44444444-4444-4444-4444-444444444444', 'oquvchi@wba.uz'),
  ('55555555-5555-5555-5555-555555555555', 'komila@wba.uz');

update profiles set rol = 'admin',     ism = 'Jamshid'  where id = '11111111-1111-1111-1111-111111111111';
update profiles set rol = 'qabulxona', ism = 'Kassa'    where id = '22222222-2222-2222-2222-222222222222';
update profiles set rol = 'ustoz',     ism = 'Diana'    where id = '33333333-3333-3333-3333-333333333333';
update profiles set rol = 'oquvchi',   ism = 'Amirxan'  where id = '44444444-4444-4444-4444-444444444444';
update profiles set rol = 'ustoz',     ism = 'Komila'   where id = '55555555-5555-5555-5555-555555555555';

insert into teachers (id, profile_id, ism) values
  ('U01', '33333333-3333-3333-3333-333333333333', 'Diana'),
  ('U02', '55555555-5555-5555-5555-555555555555', 'Komila Bozorova');

insert into groups (id, nom, subject_id, teacher_id, boshlanish, tugash, kun_turi, oylik_narx) values
  ('N01', 'Beginner', 'ingliz-tili', 'U01', '08:30', '10:00', 'toq',  650000),
  ('N02', 'IELTS',    'ingliz-tili', 'U02', '16:30', '18:00', 'juft', 800000);

insert into students (id, profile_id, fish, qoshilgan_sana) values
  ('S001', '44444444-4444-4444-4444-444444444444', 'Anvarbekov Amirxan', '2026-09-01'),
  ('S002', null, 'Muslima G''ayratova', '2026-09-01'),
  ('S003', null, 'Mohinur Anvarova',   '2026-09-01');

-- S001: tanishuv oyi chegirmasi — 1 oyga 100 000
insert into enrollments (student_id, group_id, boshlandi, chegirma_summa, chegirma_oy, chegirma_sabab) values
  ('S001', 'N01', '2026-09-01', 100000, 1, 'Tanishuv oyi');
-- S002: chegirmasiz
insert into enrollments (student_id, group_id, boshlandi) values
  ('S002', 'N01', '2026-09-01');
-- S003: ikki guruhda — dublikat ism muammosining testi
insert into enrollments (student_id, group_id, boshlandi) values
  ('S003', 'N01', '2026-09-01'),
  ('S003', 'N02', '2026-09-01');

-- ============================================================
--  2. Hisob-fakturalar
-- ============================================================

\echo '--- create_monthly_invoices(2026-09) ---'
select create_monthly_invoices('2026-09') as yaratildi;

\echo '--- takroriy chaqiruv dublikat yaratmasligi kerak (0) ---'
select create_monthly_invoices('2026-09') as yaratildi;

\echo '--- sentabr hisoblari ---'
select e.student_id, e.group_id, i.summa, i.chegirma
from invoices i join enrollments e on e.id = i.enrollment_id
where i.davr = '2026-09' order by e.student_id, e.group_id;

\echo '--- oktabr: S001 chegirmasi tugagan bo''lishi kerak (650000) ---'
select create_monthly_invoices('2026-10');
select e.student_id, i.summa, i.chegirma
from invoices i join enrollments e on e.id = i.enrollment_id
where i.davr = '2026-10' and e.student_id = 'S001';

-- ============================================================
--  3. To'lovlar va qarz
-- ============================================================

insert into payments (student_id, enrollment_id, sana, davr, summa, usul, qabul_qildi)
select 'S001', e.id, '2026-09-05', '2026-09', 550000, 'naqd',
       '22222222-2222-2222-2222-222222222222'
from enrollments e where e.student_id = 'S001';

\echo '--- balanslar (S001 sentabr to''lagan, oktabr qarz) ---'
select student_id, hisoblangan, chegirma, tolangan, qarz
from v_student_balance order by student_id;

\echo '--- qarzdorlar, eng kattadan ---'
select student_id, fish, qarz, guruhlar from v_qarzdorlar;

\echo '--- dashboard ---'
select oquvchilar, guruhlar, ustozlar, qarzdorlar, jami_qarz,
       tasdiqlanmagan_soni, tasdiqlanmagan_summa
from v_dashboard;

-- ============================================================
--  4. Darslar, davomat, WOBLR
-- ============================================================

\echo '--- generate_lessons: toq kun, 01–15 sentabr (du/chor/juma) ---'
select generate_lessons('N01', '2026-09-01', '2026-09-15') as darslar;

insert into attendance (lesson_id, student_id, holat, belgiladi)
select l.id, 'S001',
       case when extract(day from l.sana)::int % 3 = 0 then 'kelmadi' else 'keldi' end::attendance_status,
       '33333333-3333-3333-3333-333333333333'
from lessons l where l.group_id = 'N01';

insert into woblr (student_id, lesson_id, teacher_id, bergan_profile, ball, sabab)
select 'S001', l.id, 'U01', '33333333-3333-3333-3333-333333333333', 2, 'faollik'
from lessons l where l.group_id = 'N01' limit 3;

\echo '--- oylik davomat ---'
select student_id, davr, darslar, kelgan, foiz from v_attendance_monthly;

\echo '--- WOBLR balansi ---'
select student_id, jami_ball, sarflangan, balans from v_woblr_balance where jami_ball is not null or balans <> 0;

\echo '--- reyting ---'
select * from woblr_leaderboard();

-- ============================================================
--  5. To'lovni o'chirib bo'lmasligi
-- ============================================================

\echo '--- DELETE payments xato berishi KERAK ---'
do $$
begin
  delete from payments where student_id = 'S001';
  raise exception 'XATO: to''lov o''chirildi — trigger ishlamadi!';
exception
  when others then
    if sqlerrm like '%o''chirib bo''lmaydi%' then
      raise notice 'OK: to''lovni o''chirish to''sildi';
    else
      raise;
    end if;
end $$;

\echo '--- audit_log to''lganmi ---'
select jadval, amal, count(*) from audit_log group by jadval, amal order by jadval, amal;

-- ============================================================
--  6. RLS — har rol nimani ko'radi
-- ============================================================

\echo ''
\echo '=========== RLS: ADMIN ==========='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'students' as jadval, count(*) from students
union all select 'payments', count(*) from payments
union all select 'audit_log', count(*) from audit_log
union all select 'invoices', count(*) from invoices;

\echo '=========== RLS: QABULXONA (audit_log = 0 bo''lishi kerak) ==========='
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'students' as jadval, count(*) from students
union all select 'payments', count(*) from payments
union all select 'audit_log', count(*) from audit_log
union all select 'invoices', count(*) from invoices;

\echo '--- qabulxona to''lovni tasdiqlay olmasligi kerak (0 qator) ---'
with u as (update payments set tasdiqlangan = true where student_id = 'S001' returning 1)
select count(*) as ozgargan from u;

\echo '=========== RLS: USTOZ Diana (N01) — 3 o''quvchi, 0 to''lov ==========='
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select 'students' as jadval, count(*) from students
union all select 'payments', count(*) from payments
union all select 'groups', count(*) from groups
union all select 'woblr', count(*) from woblr;

\echo '=========== RLS: USTOZ Komila (N02) — faqat S003 ==========='
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select id, fish from students order by id;

\echo '=========== RLS: O''QUVCHI S001 — faqat o''zi ==========='
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select 'students' as jadval, count(*) from students
union all select 'payments', count(*) from payments
union all select 'invoices', count(*) from invoices
union all select 'attendance', count(*) from attendance;

\echo '--- o''quvchi reytingni ko''ra oladi (funksiya orqali) ---'
select count(*) as reyting_qatorlari from woblr_leaderboard();

\echo '--- o''quvchi boshqa o''quvchini o''zgartira olmasligi kerak (0 qator) ---'
with u as (update students set fish = 'BUZILDI' where id = 'S002' returning 1)
select count(*) as ozgargan from u;

reset role;

-- ============================================================
--  7. DIREKTOR · ikki bosqichli chegirma · dam olish guruhi
-- ============================================================

-- Oldingi bo'limdagi "kim kirgan" belgisi reset role dan keyin ham qoladi.
-- Sozlash superuser nomidan bo'lsin (Supabase'da ham shunday: auth.uid() bo'sh).
reset request.jwt.claim.sub;

insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666', 'farrux@wba.uz');
update profiles set rol = 'direktor', ism = 'Farrux'
  where id = '66666666-6666-6666-6666-666666666666';

-- Farrux direktor ham, ustoz ham — bitta odam, ikki rol
insert into teachers (id, profile_id, ism) values
  ('U03', '66666666-6666-6666-6666-666666666666', 'Farrux');

insert into groups (id, nom, subject_id, teacher_id, boshlanish, tugash, kun_turi, oylik_narx) values
  ('N03', 'Matematika', 'matematika', 'U03', '10:00', '11:30', 'dam_olish', 650000);

insert into students (id, fish, qoshilgan_sana) values
  ('S004', 'Boymuradov Abubakir', '2026-09-01');

-- Direktor qoidasi: 400 000 to'lagan -> 1 oy 250 000 chegirma,
-- keyin 50 000 DOIMIY (necha oy ko'rsatilmagan)
insert into enrollments
  (student_id, group_id, boshlandi, chegirma_summa, chegirma_oy,
   chegirma2_summa, chegirma2_oy, chegirma_sabab)
values
  ('S004', 'N03', '2026-09-01', 250000, 1, 50000, null, '400 000 to''lagan');

select create_monthly_invoices('2026-09');
select create_monthly_invoices('2026-10');
select create_monthly_invoices('2026-11');

\echo '--- S004: sentabr 400 000, keyingi oylar 600 000 (2-bosqich doimiy) ---'
select i.davr, i.summa, i.chegirma
from invoices i join enrollments e on e.id = i.enrollment_id
where e.student_id = 'S004' order by i.davr;

\echo '--- dam olish guruhi: faqat shanba va yakshanba (4 ta dars) ---'
select generate_lessons('N03', '2026-09-01', '2026-09-14') as darslar;
select to_char(sana, 'Dy DD.MM') as kun from lessons where group_id = 'N03' order by sana;

-- ── Tasdiq: imzo faqat direktorda ──
set role authenticated;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
\echo '--- ADMIN tasdiqlay olmasligi KERAK ---'
do $$
begin
  update payments set tasdiqlangan = true where student_id = 'S001';
  raise exception 'XATO: admin tasdiqladi — trigger ishlamadi!';
exception
  when others then
    if sqlerrm like '%faqat direktor%' then
      raise notice 'OK: admin tasdiqlay olmadi';
    else
      raise;
    end if;
end $$;

set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
\echo '--- DIREKTOR tasdiqlaydi (1 qator) ---'
with u as (update payments set tasdiqlangan = true where student_id = 'S001' returning 1)
select count(*) as tasdiqlandi from u;

\echo '--- imzo va vaqt o''z-o''zidan yozilgan bo''lishi kerak ---'
select tasdiqlangan,
       tasdiqladi is not null        as imzo_bor,
       tasdiqlangan_vaqt is not null as vaqt_bor
from payments where student_id = 'S001';

\echo '--- direktor ustoz sifatida o''z darsiga davomat qo''ya oladi ---'
with d as (
  insert into attendance (lesson_id, student_id, holat, belgiladi)
  select l.id, 'S004', 'keldi', '66666666-6666-6666-6666-666666666666'
  from lessons l where l.group_id = 'N03' order by l.sana limit 1
  returning 1
)
select count(*) as belgilandi from d;

\echo '--- ustoz Diana boshqa guruhning darsiga TEGA OLMASLIGI kerak ---'
-- Ikki qatlam himoya: darsni ham ko'rmaydi (SELECT hech narsa qaytarmaydi),
-- ko'rgan taqdirda ham INSERT siyosati o'tkazmaydi.
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
declare v_soni int;
begin
  begin
    insert into attendance (lesson_id, student_id, holat, belgiladi)
    select l.id, 'S004', 'keldi', '33333333-3333-3333-3333-333333333333'
    from lessons l where l.group_id = 'N03' order by l.sana limit 1;
    get diagnostics v_soni = row_count;
    if v_soni = 0 then
      raise notice 'OK: begona guruhning darsi ko''rinmadi, hech narsa yozilmadi';
    else
      raise exception 'XATO: begona guruhga % qator davomat yozildi!', v_soni;
    end if;
  exception
    when insufficient_privilege or check_violation then
      raise notice 'OK: RLS begona guruhga yozishga ruxsat bermadi';
  end;
end $$;

-- ============================================================
--  8. DAVOMAT EKRANI — bitta amalda saqlash
-- ============================================================

set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';

\echo '--- davomat_saqla: dars ochiladi, belgi va ball birga yoziladi ---'
select davomat_saqla(
  'N03', current_date,
  jsonb_build_object('S004', 'keldi'),
  jsonb_build_object('S004', 2)
) as natija;

\echo '--- qayta saqlash: belgi yangilanadi, BALL IKKILANMAYDI ---'
select davomat_saqla(
  'N03', current_date,
  jsonb_build_object('S004', 'kechikdi'),
  jsonb_build_object('S004', 3)
) as natija;

select a.holat as davomat, (select sum(ball) from woblr w where w.lesson_id = a.lesson_id) as ball
from attendance a
join lessons l on l.id = a.lesson_id
where l.group_id = 'N03' and l.sana = current_date and a.student_id = 'S004';

\echo '--- ball 0 qilinsa yozuv o''chadi ---'
select davomat_saqla('N03', current_date, jsonb_build_object('S004', 'keldi'), jsonb_build_object('S004', 0));
select count(*) as ball_yozuvlari from woblr w
join lessons l on l.id = w.lesson_id
where l.group_id = 'N03' and l.sana = current_date;

\echo '--- server nomidan (auth.uid() bo''sh) davomat yozilishi kerak (0013) ---'
reset role;
reset request.jwt.claim.sub;
select davomat_saqla('N03', current_date, jsonb_build_object('S004', 'sababli')) -> 'davomat' as server_yozdi;
set role authenticated;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';

\echo '--- begona guruhga saqlashga urinish XATO berishi kerak ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  perform davomat_saqla('N03', current_date, jsonb_build_object('S004', 'keldi'));
  raise exception 'XATO: begona guruhga davomat saqlandi!';
exception
  when others then
    if sqlerrm like '%huquqingiz yo%' then
      raise notice 'OK: begona guruhga saqlashga ruxsat berilmadi';
    else
      raise;
    end if;
end $$;

\echo '--- kelasi kunga davomat qo''yib bo''lmasligi kerak ---'
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
do $$
begin
  perform davomat_saqla('N03', current_date + 1, jsonb_build_object('S004', 'keldi'));
  raise exception 'XATO: kelasi kunga davomat yozildi!';
exception
  when others then
    if sqlerrm like '%Kelasi kunga%' then
      raise notice 'OK: kelasi kun to''sildi';
    else
      raise;
    end if;
end $$;

reset role;

-- ============================================================
--  9. ROL XAVFSIZLIGI — o'zini admin qilib ro'yxatdan o'tolmasin
-- ============================================================

\echo '--- user_metadata da rol=admin yozgan odam OQUVCHI bo''lishi kerak ---'
insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-7777-7777-7777-777777777777', 'buzgunchi@example.com',
   '{"ism": "Buzg''unchi", "rol": "admin"}');
select ism, rol from profiles where id = '77777777-7777-7777-7777-777777777777';

\echo '--- profilga email ham ko''chirilgan bo''lishi kerak (0012) ---'
select email, rol from profiles where id = '77777777-7777-7777-7777-777777777777';

\echo '--- app_metadata (faqat server yozadi) dagi rol qabul qilinadi ---'
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('88888888-8888-8888-8888-888888888888', 'yangi.ustoz@wba.uz',
   '{"ism": "Yangi ustoz"}', '{"rol": "ustoz"}');
select ism, rol from profiles where id = '88888888-8888-8888-8888-888888888888';

do $$
begin
  if (select rol from profiles where id = '77777777-7777-7777-7777-777777777777') <> 'oquvchi' then
    raise exception 'XATO: user_metadata orqali rol olib bo''lindi!';
  end if;
  if (select rol from profiles where id = '88888888-8888-8888-8888-888888888888') <> 'ustoz' then
    raise exception 'XATO: app_metadata dagi rol qabul qilinmadi';
  end if;
  raise notice 'OK: rolni faqat server bera oladi';
end $$;

-- ============================================================
--  10. BOSHQARUV AMALLARI (0010)
-- ============================================================

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin

\echo '--- keyingi_id: S004 dan keyin S005 bo''lishi kerak ---'
select keyingi_id('students', 'S') as keyingi;

\echo '--- oquvchi_qosh: 1-avgustdan, 50 000 DOIMIY chegirma bilan ---'
select oquvchi_qosh(jsonb_build_object(
  'fish', 'Yangi O''quvchi', 'shaxsiy_tel', '+998901234567',
  'group_id', 'N01', 'boshlandi', '2026-08-01',
  'chegirma_summa', 50000, 'chegirma_oy', ''
)) as yangi_id;

\echo '--- o''tgan oylar ham hisoblangan bo''lishi kerak (avgust + sentabr, har biri 600 000) ---'
select i.davr, i.summa, i.chegirma
from invoices i join enrollments e on e.id = i.enrollment_id
where e.student_id = 'S005' order by i.davr;

\echo '--- ikkinchi marta shu guruhga biriktirish XATO berishi kerak ---'
do $$
begin
  perform guruhga_biriktir('S005', 'N01', '2026-09-01');
  raise exception 'XATO: o''quvchi bir guruhga ikki marta biriktirildi!';
exception when others then
  if sqlerrm like '%allaqachon o''qiyapti%' then
    raise notice 'OK: takroriy biriktirish to''sildi';
  else raise; end if;
end $$;

\echo '--- guruhdan chiqarish: holat tugagan, keyingi oylar hisobdan olinadi ---'
select guruhdan_chiqar(
  (select id from enrollments where student_id = 'S005' and group_id = 'N01'),
  '2026-08-20'
);
select e.holat, e.tugadi, (select count(*) from invoices i where i.enrollment_id = e.id) as hisoblar
from enrollments e where e.student_id = 'S005';

\echo '--- probniy: guruhsiz "doimiy" qilib bo''lmaydi ---'
insert into leads (id, ism, telefon, holat) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Guruhsiz Bola', '+998900000001', 'yangi'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Probniy Bola',  '+998900000002', 'yangi');
update leads set group_id = 'N02', sinov_sana = '2026-09-15'
 where id = 'aaaaaaaa-0000-0000-0000-000000000002';

do $$
begin
  perform probniy_doimiy('aaaaaaaa-0000-0000-0000-000000000001');
  raise exception 'XATO: guruhsiz probniy o''quvchi qilindi!';
exception when others then
  if sqlerrm like '%Guruh tanlanmagan%' then
    raise notice 'OK: guruhsiz probniy o''tkazilmadi';
  else raise; end if;
end $$;

\echo '--- probniy -> doimiy: o''quvchi + qatnashuv + holat yozildi ---'
select probniy_doimiy('aaaaaaaa-0000-0000-0000-000000000002') as oquvchi_id;
select l.holat, l.student_id, s.fish, s.shaxsiy_tel, e.group_id
from leads l
join students s on s.id = l.student_id
join enrollments e on e.student_id = s.id
where l.id = 'aaaaaaaa-0000-0000-0000-000000000002';

\echo '--- tushum_hisobot: sentabr ---'
select r ->> 'tushum' as tushum, r ->> 'soni' as tolovlar,
       r -> 'davomat' as davomat, r -> 'darslar' as darslar, r -> 'probniy' as probniy
from (select tushum_hisobot('2026-09-01', '2026-09-30') as r) x;

\echo '--- ustoz o''quvchi qo''sha olmasligi kerak ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  perform oquvchi_qosh(jsonb_build_object('fish', 'Begona'));
  raise exception 'XATO: ustoz o''quvchi qo''shdi!';
exception when others then
  if sqlerrm like '%huquqingiz yo%' then
    raise notice 'OK: ustozga o''quvchi qo''shish yopiq';
  else raise; end if;
end $$;

\echo '--- ustoz hisobotda pulni ko''rmasligi kerak (tushum 0) ---'
select tushum_hisobot('2026-09-01', '2026-09-30') ->> 'tushum' as ustoz_korgan_tushum;

reset role;

-- ============================================================
--  11. DIREKTOR ROLI HIMOYASI (0011)
-- ============================================================

set role authenticated;

\echo '--- admin O''ZINI direktor qila olmasligi kerak ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
begin
  update profiles set rol = 'direktor' where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'XATO: admin o''zini direktor qildi!';
exception when others then
  if sqlerrm like '%O''z rolingizni%' then raise notice 'OK: o''z rolini o''zgartirish to''sildi';
  else raise; end if;
end $$;

\echo '--- admin BOSHQANI direktor qila olmasligi kerak ---'
do $$
begin
  update profiles set rol = 'direktor' where id = '22222222-2222-2222-2222-222222222222';
  raise exception 'XATO: admin boshqaga direktor rolini berdi!';
exception when others then
  if sqlerrm like '%faqat direktor%' then raise notice 'OK: direktor rolini admin bera olmadi';
  else raise; end if;
end $$;

\echo '--- admin oddiy rolni o''zgartira oladi (qabulxona -> ustoz -> qabulxona) ---'
update profiles set rol = 'ustoz' where id = '22222222-2222-2222-2222-222222222222';
update profiles set rol = 'qabulxona' where id = '22222222-2222-2222-2222-222222222222';
select ism, rol from profiles where id = '22222222-2222-2222-2222-222222222222';

\echo '--- direktor boshqaga direktor rolini bera oladi va qaytarib oladi ---'
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
update profiles set rol = 'direktor' where id = '22222222-2222-2222-2222-222222222222';
update profiles set rol = 'qabulxona' where id = '22222222-2222-2222-2222-222222222222';
select ism, rol from profiles where id = '22222222-2222-2222-2222-222222222222';

reset role;

-- ============================================================
--  12. CHEGIRMANI TAHRIRLASH (0014)
-- ============================================================

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin

\echo '--- S004: 250 000 x1 oy -> 50 000 doimiy edi. Endi 100 000 DOIMIY: hamma oy 550 000 ---'
select chegirma_ozgartir(
  (select id from enrollments where student_id = 'S004' and group_id = 'N03'),
  jsonb_build_object('chegirma_summa', 100000, 'chegirma_oy', '', 'chegirma_sabab', 'direktor qarori')
) as ozgardi;
select i.davr, i.summa, i.chegirma from invoices i
join enrollments e on e.id = i.enrollment_id where e.student_id = 'S004' order by i.davr;

\echo '--- chegirma olib tashlandi: to''liq narx 650 000 ---'
select chegirma_ozgartir(
  (select id from enrollments where student_id = 'S004' and group_id = 'N03'),
  jsonb_build_object('chegirma_summa', 0)
) as ozgardi;
select i.davr, i.summa, i.chegirma from invoices i
join enrollments e on e.id = i.enrollment_id where e.student_id = 'S004' order by i.davr;

\echo '--- ustoz chegirmani o''zgartira olmasligi kerak ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  perform chegirma_ozgartir((select id from enrollments where student_id = 'S001' limit 1), '{"chegirma_summa": 999}');
  raise exception 'XATO: ustoz chegirma berdi!';
exception when others then
  if sqlerrm like '%huquqingiz yo%' then raise notice 'OK: ustozga chegirma yopiq';
  else raise; end if;
end $$;

reset role;

-- ============================================================
--  13. PANELLAR (0018): foiz, keyingi darslar, reyting, Q5
-- ============================================================

reset request.jwt.claim.sub;

\echo '--- kelajakdagi dars foizga kirmaydi, o''tgani kiradi ---'
do $$
declare
  v_oldin int;
  v_keyin int;
  v_dars  uuid;
begin
  select coalesce(sum(darslar), 0) into v_oldin from v_attendance_monthly where student_id = 'S001';

  insert into lessons (group_id, sana, otkazildi) values ('N01', bugun_toshkent() + 7, true)
  on conflict (group_id, sana) do update set otkazildi = true
  returning id into v_dars;
  insert into attendance (lesson_id, student_id, holat) values (v_dars, 'S001', 'kelmadi')
  on conflict (lesson_id, student_id) do update set holat = 'kelmadi';

  select coalesce(sum(darslar), 0) into v_keyin from v_attendance_monthly where student_id = 'S001';
  if v_keyin <> v_oldin then
    raise exception 'XATO: kelajakdagi dars foizga kirdi (% -> %)', v_oldin, v_keyin;
  end if;
  raise notice 'OK: kelajakdagi dars sanalmadi';

  insert into lessons (group_id, sana, otkazildi) values ('N01', bugun_toshkent() - 400, true)
  returning id into v_dars;
  insert into attendance (lesson_id, student_id, holat) values (v_dars, 'S001', 'keldi');

  select coalesce(sum(darslar), 0) into v_keyin from v_attendance_monthly where student_id = 'S001';
  if v_keyin <> v_oldin + 1 then
    raise exception 'XATO: o''tgan dars sanalmadi (% -> %)', v_oldin, v_keyin;
  end if;
  raise notice 'OK: o''tgan dars sanaldi';
end $$;

set role authenticated;

\echo '--- keyingi_darslar: jadvaldan, faqat o''ziniki ---'
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';   -- o'quvchi S001
do $$
declare
  v_soni  int;
  v_yomon int;
begin
  select count(*), count(*) filter (where not dars_kunimi('toq', sana) or sana < bugun_toshkent())
    into v_soni, v_yomon
  from keyingi_darslar('S001', 5);
  if v_soni <> 5 or v_yomon <> 0 then
    raise exception 'XATO: keyingi_darslar % ta qaytardi, % tasi noto''g''ri kun', v_soni, v_yomon;
  end if;
  raise notice 'OK: keyingi 5 dars toq kunlarda, bugundan boshlab';

  select count(*) into v_soni from keyingi_darslar('S002', 5);
  if v_soni <> 0 then
    raise exception 'XATO: o''quvchi begona o''quvchining darslarini ko''rdi';
  end if;
  raise notice 'OK: begona o''quvchining darslari yopiq';
end $$;

\echo '--- reyting (Q6): o''quvchi markaz va o''z fanini ko''radi, boshqasini yo''q ---'
do $$
begin
  perform * from woblr_leaderboard();
  perform * from woblr_leaderboard(p_fan => 'ingliz-tili');
  perform * from woblr_leaderboard(p_group => 'N01');
  raise notice 'OK: markaz, o''z fani va o''z guruhi ochiq';

  begin
    perform * from woblr_leaderboard(p_fan => 'matematika');
    raise exception 'XATO: o''quvchi boshqa fan reytingini ko''rdi!';
  exception when others then
    if sqlerrm like '%fan reytingini%' then raise notice 'OK: boshqa fan yopiq';
    else raise; end if;
  end;

  begin
    perform * from woblr_leaderboard(p_group => 'N02');
    raise exception 'XATO: o''quvchi begona guruh reytingini ko''rdi!';
  exception when others then
    if sqlerrm like '%guruh reytingini%' then raise notice 'OK: begona guruh yopiq';
    else raise; end if;
  end;
end $$;

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz Diana (N01)
do $$
begin
  perform * from woblr_leaderboard(p_fan => 'ingliz-tili');
  raise notice 'OK: ustoz o''z fanini ko''radi';
  begin
    perform * from woblr_leaderboard(p_group => 'N02');
    raise exception 'XATO: ustoz begona guruh reytingini ko''rdi!';
  exception when others then
    if sqlerrm like '%guruh reytingini%' then raise notice 'OK: ustozga begona guruh yopiq';
    else raise; end if;
  end;
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
select count(*) >= 0 as admin_matematika_ochiq from woblr_leaderboard(p_fan => 'matematika');

\echo '--- Q5: ustoz o''tgan kunni saqlay olmaydi, admin saqlaydi ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz Diana
do $$
begin
  perform davomat_saqla('N01', bugun_toshkent(), jsonb_build_object('S001', 'keldi'));
  raise notice 'OK: ustoz bugungi darsni saqladi';
  begin
    perform davomat_saqla('N01', bugun_toshkent() - 1, jsonb_build_object('S001', 'keldi'));
    raise exception 'XATO: ustoz o''tgan kun davomatini o''zgartirdi!';
  exception when others then
    if sqlerrm like '%faqat admin%' then raise notice 'OK: o''tgan kun ustozga yopiq';
    else raise; end if;
  end;
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
select davomat_saqla('N01', bugun_toshkent() - 1, jsonb_build_object('S001', 'kechikdi')) -> 'davomat' as admin_otgan_kun;

reset role;
\echo ''
\echo '=== TEST TUGADI ==='
