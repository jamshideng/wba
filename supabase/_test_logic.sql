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
--  13. PANELLAR (0020): foiz, keyingi darslar, reyting, Q5
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

-- ============================================================
--  14. TELEGRAM (0021): ulanish, token, huquq, auditoriya
-- ============================================================

reset request.jwt.claim.sub;

\echo '--- tel9: har xil yozilgan raqam bir xil bo''ladi ---'
select tel9('+998-90-111-22-33') = '901112233' and tel9('90 111 22 33') = '901112233'
   and tel9('998901112233') = '901112233' and tel9('12345') is null as tel9_togri;

update students set ota_tel = '+998-90-111-22-33' where id = 'S001';
update students set shaxsiy_tel = '93 000 00 02', ota_tel = '+998 93 000 00 02' where id = 'S002';
update teachers set telefon = '(90) 777-88-99' where id = 'U01';

\echo '--- telefon: ota-ona, o''quvchi (o''z raqami ota-ona bo''lib qo''shilmaydi), ustoz ---'
do $$
declare v text;
begin
  select string_agg(kim || ':' || ism, ', ' order by kim) into v from telegram_ula_telefon('+998901112233', 1001, 'Ota');
  if v is distinct from 'ota_ona:Anvarbekov Amirxan' then raise exception 'XATO: ota-ona ulanmadi: %', v; end if;

  select string_agg(kim, ',' order by kim) into v from telegram_ula_telefon('998930000002', 1002, 'Muslima');
  if v is distinct from 'oquvchi' then raise exception 'XATO: o''quvchi o''z raqami bilan: %', v; end if;

  select string_agg(kim, ',') into v from telegram_ula_telefon('907778899', 1003, 'Diana');
  if v is distinct from 'ustoz' then raise exception 'XATO: ustoz ulanmadi: %', v; end if;

  select count(*)::text into v from telegram_ula_telefon('+998 99 999 99 99', 1004, 'Begona');
  if v <> '0' then raise exception 'XATO: begona raqam ulandi'; end if;

  -- qayta ulash ikkilantirmaydi
  perform telegram_ula_telefon('+998901112233', 1001, 'Ota');
  if (select count(*) from telegram_ulanish where chat_id = 1001) <> 1 then raise exception 'XATO: ulanish ikkilandi'; end if;
  raise notice 'OK: telefon bilan ulash to''g''ri';
end $$;

set role authenticated;

\echo '--- token: o''quvchi saytda oladi, bot bir marta ishlatadi ---'
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';   -- o'quvchi S001
create temp table _tok as select telegram_token_ol() as t;

\echo '--- oddiy foydalanuvchi ulash funksiyasini chaqira olmaydi ---'
do $$
begin
  perform telegram_ula_telefon('+998901112233', 5555, 'buzg''unchi');
  raise exception 'XATO: authenticated telefon bilan ulay oldi!';
exception when insufficient_privilege then raise notice 'OK: ulash faqat serverga';
end $$;

\echo '--- o''quvchi faqat o''z ulanishlarini ko''radi ---'
select count(*) = 0 as begona_korinmaydi from telegram_ulanish where student_id <> 'S001';

reset role;
do $$
declare v text; t text := (select t from _tok);
begin
  select string_agg(kim || ':' || ism, ',') into v from telegram_ula_token(t, 2002, 'Amirxan');
  if v not like '%oquvchi:Anvarbekov Amirxan%' then raise exception 'XATO: token bilan ulanmadi: %', v; end if;
  select count(*)::text into v from telegram_ula_token(t, 2003, 'Ikkinchi');
  if v <> '0' then raise exception 'XATO: token ikki marta ishladi'; end if;
  raise notice 'OK: token bir martalik';
end $$;

set role authenticated;

\echo '--- auditoriya: admin ko''radi, ustoz yo''q ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
select kim, nishon, chat_id is not null as ulangan
from elon_oluvchilar(array['ota_ona'], '{"guruh":"N01"}') order by nishon, chat_id;

do $$
begin
  if not exists (select 1 from elon_oluvchilar(array['ota_ona'], '{}') where nishon = 'S001' and chat_id = 1001) then
    raise exception 'XATO: ulangan ota-ona auditoriyada yo''q';
  end if;
  if exists (select 1 from elon_oluvchilar(array['ustoz'], '{"qarzdor":true}')) then
    raise exception 'XATO: qarzdor filtri ustozni qo''shdi';
  end if;
  raise notice 'OK: auditoriya to''g''ri';
end $$;

insert into elonlar (turi, matn, kimga) values ('majlis', 'Sinov', array['ustoz']) returning id, yaratdi is not null as yaratdi_bor;

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz
do $$
begin
  perform * from elon_oluvchilar(array['oquvchi'], '{}');
  raise exception 'XATO: ustoz auditoriyani ko''rdi!';
exception when others then
  if sqlerrm like '%huquqingiz yo%' then raise notice 'OK: auditoriya faqat adminga';
  else raise; end if;
end $$;
do $$
begin
  insert into elonlar (matn, kimga) values ('ustozdan', array['oquvchi']);
  raise exception 'XATO: ustoz e''lon yozdi!';
exception when insufficient_privilege or check_violation then raise notice 'OK: e''lonni faqat admin yozadi';
end $$;

reset role;

\echo '--- 0028: guruh kunlari, jurnal katagi, woblar ---'
reset request.jwt.claim.sub;
-- NX — haftaning hamma kuni: bugun har doim dars kuni
insert into groups (id, nom, teacher_id, boshlanish, tugash, oylik_narx, kunlar)
values ('NX', 'Jurnal sinovi', 'U01', '10:00', '11:30', 650000, '{7,1,2,3,4,5,6}');
insert into enrollments (student_id, group_id, boshlandi) values ('S003', 'NX', '2026-01-01');

do $$
begin
  if (select kunlar from groups where id = 'N02') <> '{2,4,6}'::smallint[] then
    raise exception 'XATO: juft guruh kunlari {2,4,6} emas';
  end if;
  if (select kun_turi from groups where id = 'NX') <> 'har_kuni' then
    raise exception 'XATO: 7 kunlik guruh kun_turi har_kuni emas';
  end if;
  update groups set kunlar = '{2,4,6}' where id = 'NX';
  if (select kun_turi from groups where id = 'NX') <> 'juft' then
    raise exception 'XATO: kunlar {2,4,6} → kun_turi juft bo''lmadi';
  end if;
  update groups set kunlar = '{1,2,3,4,5,6,7}' where id = 'NX';
  raise notice 'OK: kunlar ↔ kun_turi mos';
end $$;

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz Diana (NX ustozi)
do $$
begin
  if davomat_belgila('NX', bugun_toshkent(), '{"S003":"keldi"}') <> 1 then
    raise exception 'XATO: ustoz bugungi katakni saqlay olmadi';
  end if;
  if woblar_ber('NX', 'S003', 3) <> 3 or woblar_ber('NX', 'S003', 2) <> 5 then
    raise exception 'XATO: woblar_ber bugungi jamini noto''g''ri qaytardi';
  end if;
  begin
    perform davomat_belgila('NX', bugun_toshkent() - 1, '{"S003":"kelmadi"}');
    raise exception 'XATO: ustoz o''tgan kunni tuzatdi!';
  exception when others then
    if sqlerrm not like '%faqat admin%' then raise; end if;
  end;
  begin
    perform davomat_belgila('N02', bugun_toshkent(), '{"S001":"keldi"}');
    raise exception 'XATO: ustoz boshqa guruhga davomat qo''ydi!';
  exception when others then
    if sqlerrm not like '%huquqingiz yo%' then raise; end if;
  end;
  raise notice 'OK: ustoz — faqat o''z guruhi va faqat bugun';
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
do $$
begin
  if davomat_belgila('NX', bugun_toshkent() - 1, '{"S003":"kelmadi"}') <> 1 then
    raise exception 'XATO: admin o''tgan kunni tuzata olmadi';
  end if;
  begin
    perform davomat_belgila('NX', bugun_toshkent() + 1, '{"S003":"keldi"}');
    raise exception 'XATO: kelajak kunga davomat qo''yildi!';
  exception when others then
    if sqlerrm not like '%Kelasi kun%' then raise; end if;
  end;
  -- eski forma bo'sh ballar bilan saqlasa jurnal woblari o'chmasin
  perform davomat_saqla('NX', bugun_toshkent(), '{"S003":"keldi"}');
  if (select sum(ball) from woblr w join lessons l on l.id = w.lesson_id
      where l.group_id = 'NX' and l.sana = bugun_toshkent()) <> 5 then
    raise exception 'XATO: davomat_saqla jurnal woblarini o''chirdi';
  end if;
  -- null — belgini olib tashlaydi
  perform davomat_belgila('NX', bugun_toshkent(), '{"S003":null}');
  if exists (select 1 from attendance a join lessons l on l.id = a.lesson_id
             where l.group_id = 'NX' and l.sana = bugun_toshkent()) then
    raise exception 'XATO: null belgi o''chmadi';
  end if;
  raise notice 'OK: admin — o''tgan kun, kelajak yopiq, woblar saqlanadi';
end $$;

reset role;

\echo '--- 0029: tuzatishlar — faqat shu oydan ayiriladi ---'
reset request.jwt.claim.sub;
insert into enrollments (student_id, group_id, boshlandi) values ('S002', 'NX', '2026-09-01');

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz
do $$
begin
  perform tuzatish_qosh((select id from enrollments where student_id = 'S002' and group_id = 'NX'), '2026-09', 100000, 'kasal');
  raise exception 'XATO: ustoz tuzatish kiritdi!';
exception when others then
  if sqlerrm not like '%admin yoki direktor%' then raise; end if;
  raise notice 'OK: tuzatish faqat admin/direktorga';
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
do $$
declare
  v_e  uuid := (select id from enrollments where student_id = 'S002' and group_id = 'NX');
  v_t  bigint;
  v_09 numeric;
  v_10 numeric;
begin
  perform yozilish_hisoblari(v_e);
  v_t := tuzatish_qosh(v_e, '2026-09', 150000, 'kasal, 3 dars');
  -- kelajak oyga oldindan: hisob-faktura hali yo'q, yaratilganda ayiriladi
  perform tuzatish_qosh(v_e, '2030-01', 50000, 'oldindan');

  select summa into v_09 from invoices where enrollment_id = v_e and davr = '2026-09';
  if v_09 <> 500000 then raise exception 'XATO: 2026-09 = % (500000 kutilgan)', v_09; end if;
  select summa into v_10 from invoices where enrollment_id = v_e and davr = '2026-10';
  if v_10 is not null and v_10 <> 650000 then raise exception 'XATO: tuzatish boshqa oyga tegdi: %', v_10; end if;

  insert into invoices (enrollment_id, davr, summa, chegirma) values (v_e, '2030-01', 650000, 0);
  if (select summa from invoices where enrollment_id = v_e and davr = '2030-01') <> 600000 then
    raise exception 'XATO: kelajak oy yaratilganda tuzatish ayirilmadi';
  end if;

  perform chegirma_ozgartir(v_e, '{"chegirma_summa":"50000"}');
  if (select summa from invoices where enrollment_id = v_e and davr = '2026-09') <> 450000 then
    raise exception 'XATO: chegirma + tuzatish noto''g''ri';
  end if;

  perform tuzatish_bekor(v_t, 'xato kiritildi');
  if (select summa from invoices where enrollment_id = v_e and davr = '2026-09') <> 600000 then
    raise exception 'XATO: bekor qilingan tuzatish qaytmadi';
  end if;

  -- RLS'da o'chirish qoidasi yo'q (0 qator), jadval egasi uchun trigger to'sadi
  begin
    delete from tuzatishlar where id = v_t;
  exception when others then
    if sqlerrm not like '%o''chirilmaydi%' then raise; end if;
  end;
  if not exists (select 1 from tuzatishlar where id = v_t) then
    raise exception 'XATO: tuzatish o''chirildi!';
  end if;
  raise notice 'OK: tuzatish faqat o''z oyida, chegirma bilan, bekor qilinadi, o''chmaydi';
end $$;

reset role;

\echo '--- 0030: probniy davomati, VIP, arxiv, to''lov holati ---'
reset request.jwt.claim.sub;
insert into leads (id, ism, telefon, group_id, holat)
values ('bbbbbbbb-0000-0000-0000-000000000030', 'Probniy Sinov 0030', '+998901112233', 'NX', 'yangi');

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz Diana (NX)
do $$
begin
  perform probniy_belgila('NX', bugun_toshkent(), 'bbbbbbbb-0000-0000-0000-000000000030', 'keldi');
  if not exists (select 1 from jurnal_probniylar('NX', bugun_toshkent(), bugun_toshkent())
                 where belgilar ? bugun_toshkent()::text) then
    raise exception 'XATO: probniy belgisi jurnalda ko''rinmadi';
  end if;
  if exists (select 1 from jurnal_probniylar('N02', bugun_toshkent() - 30, bugun_toshkent())) then
    raise exception 'XATO: ustoz boshqa guruh probniylarini ko''rdi';
  end if;
  raise notice 'OK: ustoz probniyni o''z guruhida belgilaydi';
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
do $$
declare
  v_id text;
  v_e  uuid;
begin
  v_id := probniy_doimiy('bbbbbbbb-0000-0000-0000-000000000030');
  if not exists (select 1 from attendance a join lessons l on l.id = a.lesson_id
                 where a.student_id = v_id and l.group_id = 'NX' and l.sana = bugun_toshkent()) then
    raise exception 'XATO: probniy davomati o''quvchiga ko''chmadi';
  end if;
  raise notice 'OK: doimiy bo''lganda davomat tarixi saqlandi (%)', v_id;

  -- VIP: to'lamaydi, VIP olinsa narx qaytadi
  v_e := (select id from enrollments where student_id = 'S003' and group_id = 'NX');
  perform yozilish_hisoblari(v_e);
  perform vip_ozgartir(v_e, true, null);
  if exists (select 1 from invoices where enrollment_id = v_e and summa <> 0) then
    raise exception 'XATO: VIP oyda hisob 0 emas';
  end if;
  perform vip_ozgartir(v_e, false, null);
  if exists (select 1 from invoices where enrollment_id = v_e and summa <> 650000) then
    raise exception 'XATO: VIP olinganda narx qaytmadi';
  end if;
  raise notice 'OK: VIP — hisob 0, olinsa narx qaytadi';

  -- Arxiv: yozilishlar yopiladi, qarz qoladi, qaytariladi
  perform oquvchi_arxivla('S003', bugun_toshkent(), 'sinov');
  if (select holat from students where id = 'S003') <> 'ketgan'
     or exists (select 1 from enrollments where student_id = 'S003' and holat <> 'tugagan') then
    raise exception 'XATO: arxivlash yozilishlarni yopmadi';
  end if;
  if not exists (select 1 from v_arxiv_oquvchilar where student_id = 'S003') then
    raise exception 'XATO: arxiv ro''yxatida yo''q';
  end if;
  perform oquvchi_arxivdan('S003');
  if (select holat from students where id = 'S003') <> 'faol' then
    raise exception 'XATO: arxivdan qaytmadi';
  end if;
  raise notice 'OK: arxivga o''tkazish va qaytarish';
end $$;

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz
do $$
begin
  perform vip_ozgartir((select id from enrollments where student_id = 'S003' limit 1), true, null);
  raise exception 'XATO: ustoz VIP belgiladi!';
exception when others then
  if sqlerrm not like '%admin yoki direktor%' then raise; end if;
  raise notice 'OK: VIP faqat admin/direktorga';
end $$;

-- ============================================================
--  DAVOMAT QULFI (0031): ustoz o'tgan kunni REST orqali ham o'zgartira olmaydi
-- ============================================================
reset role;
reset request.jwt.claim.sub;
insert into lessons (group_id, sana, otkazildi) values ('N01', bugun_toshkent() - 2, true)
  on conflict (group_id, sana) do nothing;
insert into attendance (lesson_id, student_id, holat)
  select id, 'S001', 'keldi' from lessons where group_id = 'N01' and sana = bugun_toshkent() - 2
  on conflict do nothing;

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz Diana (N01)
\echo '--- 0031: ustoz o''tgan kun belgisini to''g''ridan o''zgartira olmaydi ---'
do $$
declare n int;
begin
  update attendance set holat = 'kelmadi'
   where student_id = 'S001'
     and lesson_id = (select id from lessons where group_id = 'N01' and sana = bugun_toshkent() - 2);
  get diagnostics n = row_count;
  if n > 0 then raise exception 'XATO: ustoz o''tgan kun davomatini REST orqali o''zgartirdi!'; end if;
  raise notice 'OK: o''tgan kun belgisi ustozga yopiq (0 qator)';

  begin
    insert into lessons (group_id, sana, otkazildi) values ('N01', bugun_toshkent() - 3, true);
    raise exception 'XATO: ustoz o''tgan kunga dars ochdi!';
  exception when insufficient_privilege then
    raise notice 'OK: o''tgan kunga dars ochish ustozga yopiq';
  end;
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
do $$
declare n int;
begin
  update attendance set holat = 'kechikdi'
   where student_id = 'S001'
     and lesson_id = (select id from lessons where group_id = 'N01' and sana = bugun_toshkent() - 2);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'XATO: admin o''tgan kunni tuzata olmadi'; end if;
  raise notice 'OK: admin o''tgan kunni tuzatdi';
end $$;

-- ============================================================
--  O'QUVCHI PROFILI QULFI (0032)
-- ============================================================
reset role;
reset request.jwt.claim.sub;
\echo '--- 0032: o''quvchi ismi/loginini o''zi o''zgartira olmaydi, admin o''zgartiradi ---'
do $$
declare v_id uuid;
begin
  select id into v_id from profiles where rol = 'oquvchi' limit 1;
  if v_id is null then raise notice 'SKIP: o''quvchi profili yo''q'; return; end if;
  perform set_config('request.jwt.claim.sub', v_id::text, true);
  begin
    update profiles set ism = 'Boshqa ism' where id = v_id;
    raise exception 'XATO: o''quvchi ismini o''zgartirdi!';
  exception when others then
    if sqlerrm not like '%adminiga murojaat%' then raise; end if;
    raise notice 'OK: o''quvchi ismi qulflangan';
  end;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  update profiles set ism = 'Admin tuzatdi' where id = v_id;
  if (select ism from profiles where id = v_id) <> 'Admin tuzatdi' then
    raise exception 'XATO: admin o''quvchi ismini o''zgartira olmadi';
  end if;
  raise notice 'OK: admin o''quvchi profilini o''zgartira oladi';
end $$;

-- ============================================================
--  XARAJATLAR (0033): huquq, o'zgarmaslik, oylik moliya
-- ============================================================
reset role;
reset request.jwt.claim.sub;
set role authenticated;
\echo '--- 0033: xarajatlar ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
do $$
declare v_id bigint; v jsonb;
begin
  insert into xarajatlar (toifa, summa, sana, izoh) values ('ijara', 3000000, bugun_toshkent(), 'sinov')
    returning id into v_id;
  v := oylik_moliya(to_char(bugun_toshkent(), 'YYYY-MM'));
  if (v ->> 'xarajat')::numeric < 3000000 then raise exception 'XATO: oylik_moliya xarajatni sanamadi: %', v; end if;
  if (v ->> 'foyda')::numeric <> (v ->> 'tushum')::numeric - (v ->> 'xarajat')::numeric then
    raise exception 'XATO: foyda noto''g''ri: %', v;
  end if;
  begin
    update xarajatlar set summa = 1 where id = v_id;
    raise exception 'XATO: xarajat summasi o''zgardi!';
  exception when others then
    if sqlerrm not like '%bekor qilib%' then raise; end if;
  end;
  update xarajatlar set bekor = true, bekor_sabab = 'sinov' where id = v_id;
  if (oylik_moliya(to_char(bugun_toshkent(), 'YYYY-MM')) ->> 'xarajat')::numeric >= (v ->> 'xarajat')::numeric then
    raise exception 'XATO: bekor xarajat hisobda qoldi';
  end if;
  raise notice 'OK: admin yozadi, summa o''zgarmaydi, bekor hisobdan chiqadi';
end $$;

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';   -- qabulxona
do $$
begin
  perform count(*) from xarajatlar;
  begin
    insert into xarajatlar (toifa, summa) values ('ofis', 1000);
    raise exception 'XATO: qabulxona xarajat yozdi!';
  exception when insufficient_privilege then
    raise notice 'OK: qabulxona faqat ko''radi';
  end;
end $$;

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz
do $$
declare n int;
begin
  select count(*) into n from xarajatlar;
  if n > 0 then raise exception 'XATO: ustoz xarajatlarni ko''rdi!'; end if;
  begin
    perform oylik_moliya(to_char(bugun_toshkent(), 'YYYY-MM'));
    raise exception 'XATO: ustoz moliyani ko''rdi!';
  exception when others then
    if sqlerrm not like '%faqat xodimlarga%' then raise; end if;
  end;
  raise notice 'OK: ustozga xarajat va moliya yopiq';
end $$;

reset role;
\echo ''
\echo '--- 0036: dam olish kunlari ---'
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz
do $$
begin
  insert into dam_kunlar (sana, sabab) values (bugun_toshkent() + 1, 'ustozdan');
  raise exception 'XATO: ustoz dam kuni qo''shdi!';
exception when insufficient_privilege or others then
  if sqlerrm like 'XATO%' then raise; end if;
  raise notice 'OK: dam kunini faqat admin qo''shadi';
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
insert into dam_kunlar (sana, sabab) values (bugun_toshkent() - 2, 'Sinov bayrami');
do $$
begin
  if guruh_dars_kunimi('{1,2,3,4,5,6,7}', bugun_toshkent() - 2) then
    raise exception 'XATO: dam kuni dars kuni deb hisoblandi';
  end if;
  begin
    perform davomat_belgila('NX', bugun_toshkent() - 2, '{"S003":"keldi"}');
    if exists (select 1 from lessons where group_id = 'NX' and sana = bugun_toshkent() - 2) then
      -- shu kuni avvaldan dars ochilgan bo'lsa ruxsat — yangisi ochilmasligi kerak
      null;
    end if;
  exception when others then
    if sqlerrm not like '%dars kuni emas%' then raise; end if;
  end;
  if exists (select 1 from jsonb_array_elements(tushum_hisobot(bugun_toshkent() - 2, bugun_toshkent() - 2) -> 'qilinmagan')) then
    raise exception 'XATO: dam kuni "qilinmagan dars" bo''lib chiqdi';
  end if;
  raise notice 'OK: dam kuni — davomat so''ralmaydi, qilinmagan dars yo''q';
end $$;
reset role;

\echo '--- 0037/0038: woblar chegarasi, kunlik hisobot bir marta ---'
reset role;
update settings set qiymat = '6'::jsonb where kalit = 'woblr.max_ball_dars';
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz Diana (NX)
do $$
begin
  -- S002 (NX, 0029 bloki): 5 + 1 = 6 — mumkin, yana +1 — chegaradan oshadi
  perform woblar_ber('NX', 'S002', 5);
  perform woblar_ber('NX', 'S002', 1);
  begin
    perform woblar_ber('NX', 'S002', 1);
    raise exception 'XATO: woblar chegarasidan oshdi!';
  exception when others then
    if sqlerrm not like '%eng ko''pi%' then raise; end if;
  end;
  raise notice 'OK: bir darsda woblar Sozlamalardagi chegaradan oshmaydi';
end $$;
reset role;
update settings set qiymat = 'null'::jsonb where kalit = 'woblr.max_ball_dars';

do $$
begin
  if not kunlik_band('2026-10-01') then raise exception 'XATO: birinchi chaqiruv band qilolmadi'; end if;
  if kunlik_band('2026-10-01') then raise exception 'XATO: ikkinchi chaqiruv ham band qildi — hisobot ikki marta ketadi'; end if;
  if not kunlik_band('2026-10-02') then raise exception 'XATO: ertasi kuni band qilinmadi'; end if;
  raise notice 'OK: kunlik hisobot kuniga bir marta';
end $$;

\echo '--- 0040: Woblar market ---'
reset role;
insert into woblr_rewards (id, nom, narx_ball, qolgan_soni, cheksiz, holat) values
  ('cccccccc-0000-0000-0000-000000000001', 'Daftar',      2, 2, false, 'faol'),
  ('cccccccc-0000-0000-0000-000000000002', 'Qimmat sovga', 100000, 5, false, 'faol'),
  ('cccccccc-0000-0000-0000-000000000003', 'Stiker',      1, 0, true,  'faol'),
  ('cccccccc-0000-0000-0000-000000000004', 'Yopiq',       1, 9, false, 'yopilgan');
create temp table market_t (kalit text primary key, qiymat text);
grant all on market_t to authenticated;
insert into market_t values ('b0', woblar_balansi('S001')::text);

set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';   -- o'quvchi S001
do $$
declare
  v_kod text;
  v_b0  int := (select qiymat::int from market_t where kalit = 'b0');
begin
  if v_b0 < 5 then raise exception 'XATO: test uchun S001 da kamida 5 woblar bo''lishi kerak (%).', v_b0; end if;

  v_kod := market_buyurtma('cccccccc-0000-0000-0000-000000000001', 1);
  if v_kod !~ '^WM-[2-9A-HJ-NP-Z]{6}$' then raise exception 'XATO: kod shakli noto''g''ri: %', v_kod; end if;
  if (select balans from v_woblr_balance where student_id = 'S001') <> v_b0 - 2 then
    raise exception 'XATO: buyurtmadan keyin balans kamaymadi';
  end if;
  if (select qolgan_soni from woblr_rewards where id = 'cccccccc-0000-0000-0000-000000000001') <> 1 then
    raise exception 'XATO: ombor kamaymadi';
  end if;
  insert into market_t values ('kod1', v_kod);

  begin
    perform market_buyurtma('cccccccc-0000-0000-0000-000000000001', 2);
    raise exception 'XATO: omborda yo''q narsa sotildi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;
  begin
    perform market_buyurtma('cccccccc-0000-0000-0000-000000000002', 1);
    raise exception 'XATO: woblar yetmasa ham sotildi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;
  begin
    perform market_buyurtma('cccccccc-0000-0000-0000-000000000004', 1);
    raise exception 'XATO: yopilgan mahsulot sotildi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;
  begin
    perform market_buyurtma('cccccccc-0000-0000-0000-000000000003', 0);
    raise exception 'XATO: 0 dona buyurtma o''tdi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;

  -- To'g'ridan-to'g'ri yozish yopiq: faqat funksiyalar orqali
  begin
    insert into woblr_redemptions (student_id, reward_id, ball, kod, holat)
    values ('S001', 'cccccccc-0000-0000-0000-000000000003', 0, 'WM-TEST22', 'kutilmoqda');
    raise exception 'XATO: o''quvchi buyurtmani to''g''ridan-to''g''ri yozdi (0 woblar)';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;
  update woblr_redemptions set holat = 'berildi' where kod = v_kod;
  if (select holat from woblr_redemptions where kod = v_kod) <> 'kutilmoqda' then
    raise exception 'XATO: o''quvchi o''zi "berildi" qilib qo''ydi';
  end if;
  begin
    perform market_berildi(v_kod);
    raise exception 'XATO: o''quvchi market_berildi chaqira oldi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;
  begin
    insert into woblr_rewards (nom, narx_ball) values ('Bepul', 0);
    raise exception 'XATO: o''quvchi mahsulot qo''shdi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;

  -- Bekor: woblar va ombor qaytadi
  perform market_bekor(v_kod, null);
  if (select balans from v_woblr_balance where student_id = 'S001') <> v_b0 then
    raise exception 'XATO: bekor qilinganda woblar qaytmadi';
  end if;
  if (select qolgan_soni from woblr_rewards where id = 'cccccccc-0000-0000-0000-000000000001') <> 2 then
    raise exception 'XATO: bekor qilinganda ombor qaytmadi';
  end if;
  begin
    perform market_bekor(v_kod, null);
    raise exception 'XATO: bekor qilingan buyurtma qayta bekor bo''ldi (woblar ikki marta qaytadi)';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;

  -- Cheksiz: ombor sanalmaydi
  perform market_buyurtma('cccccccc-0000-0000-0000-000000000003', 3);
  if (select qolgan_soni from woblr_rewards where id = 'cccccccc-0000-0000-0000-000000000003') <> 0 then
    raise exception 'XATO: cheksiz mahsulot ombori o''zgardi';
  end if;

  update market_t set qiymat = market_buyurtma('cccccccc-0000-0000-0000-000000000001', 1) where kalit = 'kod1';
  raise notice 'OK: market — sotib olish, chegaralar, bekor qilish';
end $$;

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz
do $$
begin
  perform market_berildi((select qiymat from market_t where kalit = 'kod1'));
  raise exception 'XATO: ustoz buyurtmani berildi qildi';
exception when others then if sqlerrm like 'XATO%' then raise; end if;
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
do $$
declare v_kod text := (select qiymat from market_t where kalit = 'kod1');
begin
  perform market_berildi(v_kod);
  if (select holat from woblr_redemptions where kod = v_kod) <> 'berildi' then
    raise exception 'XATO: admin berildi qilolmadi';
  end if;
  begin
    perform market_berildi(v_kod);
    raise exception 'XATO: bitta chek ikki marta berildi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;
  raise notice 'OK: market — admin beradi, chek bir marta';
end $$;

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';   -- o'quvchi
do $$
begin
  perform market_bekor((select qiymat from market_t where kalit = 'kod1'), null);
  raise exception 'XATO: berilgan narsani o''quvchi bekor qilib woblarni qaytardi';
exception when others then if sqlerrm like 'XATO%' then raise; end if;
end $$;
reset role;
reset request.jwt.claim.sub;

\echo '--- 0042: oldindan buyurtma ---'
reset role;
insert into woblr_rewards (id, nom, narx_ball, qolgan_soni, cheksiz, holat, rejim) values
  ('cccccccc-0000-0000-0000-000000000005', 'Bozor futbolkasi', 1, 5, false, 'faol', 'oldindan');
-- S001 ga yana woblar (oldingi bloklar sarflagan)
insert into woblr (student_id, lesson_id, teacher_id, bergan_profile, ball, sabab)
select 'S001', l.id, 'U01', '33333333-3333-3333-3333-333333333333', 5, 'faollik'
from lessons l where l.group_id = 'N01' order by l.sana desc limit 1;

set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';   -- o'quvchi S001
do $$
declare v_kod text; v_kod2 text;
begin
  v_kod := market_buyurtma('cccccccc-0000-0000-0000-000000000005', 1);
  if (select holat from woblr_redemptions where kod = v_kod) <> 'buyurtma' then
    raise exception 'XATO: oldindan tovar buyurtmasi "buyurtma" holatida emas';
  end if;
  begin
    perform market_keldi(v_kod);
    raise exception 'XATO: o''quvchi o''zi "keldi" qildi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;
  v_kod2 := market_buyurtma('cccccccc-0000-0000-0000-000000000005', 1);
  perform market_bekor(v_kod2, null);   -- kelmagan buyurtmani ham bekor qilsa bo'ladi
  if (select qolgan_soni from woblr_rewards where id = 'cccccccc-0000-0000-0000-000000000005') <> 4 then
    raise exception 'XATO: oldindan buyurtma bekor bo''lganda joy qaytmadi';
  end if;
  update market_t set qiymat = v_kod where kalit = 'kod1';
  raise notice 'OK: oldindan buyurtma — o''quvchi qismi';
end $$;

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz
do $$
begin
  perform * from market_mahsulot_keldi('cccccccc-0000-0000-0000-000000000005', true);
  raise exception 'XATO: ustoz mahsulotni "keldi" qildi';
exception when others then if sqlerrm like 'XATO%' then raise; end if;
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
do $$
declare v_soni int; v_kod text := (select qiymat from market_t where kalit = 'kod1');
begin
  select count(*) into v_soni from market_mahsulot_keldi('cccccccc-0000-0000-0000-000000000005', true);
  if v_soni <> 1 then raise exception 'XATO: keldi qilinganda % ta buyurtma tayyor bo''ldi (1 kutilgan)', v_soni; end if;
  if (select holat from woblr_redemptions where kod = v_kod) <> 'kutilmoqda' then
    raise exception 'XATO: buyurtma tayyor bo''lmadi';
  end if;
  if (select rejim from woblr_rewards where id = 'cccccccc-0000-0000-0000-000000000005') <> 'sotuvda' then
    raise exception 'XATO: mahsulot sotuvga o''tmadi';
  end if;
  perform market_berildi(v_kod);
  raise notice 'OK: oldindan buyurtma — keldi, sotuvga o''tdi, berildi';
end $$;
reset role;
reset request.jwt.claim.sub;

\echo '--- 0043: mahsulotni o''chirish ---'
reset role;
insert into woblr_rewards (id, nom, narx_ball, qolgan_soni, cheksiz, holat) values
  ('cccccccc-0000-0000-0000-000000000006', 'O''chiriladigan', 1, 5, false, 'faol');
insert into woblr (student_id, lesson_id, teacher_id, bergan_profile, ball, sabab)
select 'S001', l.id, 'U01', '33333333-3333-3333-3333-333333333333', 3, 'faollik'
from lessons l where l.group_id = 'N01' order by l.sana desc limit 1;

set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';   -- o'quvchi
do $$
begin
  update market_t set qiymat = market_buyurtma('cccccccc-0000-0000-0000-000000000006', 1) where kalit = 'kod1';
  insert into market_t values ('kod3', market_buyurtma('cccccccc-0000-0000-0000-000000000006', 1));
  begin
    perform * from market_mahsulot_ochir('cccccccc-0000-0000-0000-000000000006');
    raise exception 'XATO: o''quvchi mahsulotni o''chirdi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
do $$
declare
  v_berilgan text := (select qiymat from market_t where kalit = 'kod1');
  v_ochiq    text := (select qiymat from market_t where kalit = 'kod3');
  v_b0 int; v_soni int;
begin
  perform market_berildi(v_berilgan);
  select balans into v_b0 from v_woblr_balance where student_id = 'S001';
  select count(*) into v_soni from market_mahsulot_ochir('cccccccc-0000-0000-0000-000000000006');
  if v_soni <> 1 then raise exception 'XATO: % ta buyurtma bekor bo''ldi (1 kutilgan)', v_soni; end if;
  if exists (select 1 from woblr_rewards where id = 'cccccccc-0000-0000-0000-000000000006') then
    raise exception 'XATO: mahsulot o''chmadi';
  end if;
  if (select balans from v_woblr_balance where student_id = 'S001') <> v_b0 + 1 then
    raise exception 'XATO: ochiq buyurtmaning wobli qaytmadi';
  end if;
  if (select holat from woblr_redemptions where kod = v_berilgan) <> 'berildi'
     or (select mahsulot_nomi from woblr_redemptions where kod = v_berilgan) <> 'O''chiriladigan' then
    raise exception 'XATO: berilgan buyurtma tarixi buzildi';
  end if;
  raise notice 'OK: mahsulot o''chirildi — ochiq buyurtma bekor, tarix saqlandi';
end $$;
reset role;
reset request.jwt.claim.sub;

\echo '--- 0046: tanaffus — qaytish sanasi ---'
do $$
begin
  update students set holat = 'tanaffus', qaytish_sana = '2026-10-05', tanaffus_sabab = 'Kasallik' where id = 'S002';
  if (select qaytish_sana from students where id = 'S002') is distinct from '2026-10-05'::date then
    raise exception 'XATO: qaytish sanasi saqlanmadi';
  end if;
  update students set holat = 'faol' where id = 'S002';
  if (select qaytish_sana from students where id = 'S002') is not null
     or (select tanaffus_sabab from students where id = 'S002') is not null then
    raise exception 'XATO: faolga qaytganda tanaffus maydonlari tozalanmadi';
  end if;
  raise notice 'OK: tanaffus — qaytish sanasi saqlanadi, faolda tozalanadi';
end $$;

\echo '--- 0047: bildirishnomalar ---'
reset role;
insert into bildirishnomalar (id, turi, sarlavha, kimga, filtr, yaratdi) values
  (9001, 'eslatma',   'N01 o''quvchilariga', array['oquvchi'], '{"guruh":"N01"}', '11111111-1111-1111-1111-111111111111'),
  (9002, 'sorovnoma', 'Hammaga savol',       array['oquvchi','ustoz'], '{}',   '11111111-1111-1111-1111-111111111111'),
  (9003, 'elon',      'Faqat ustozlarga',    array['ustoz'], '{}',              '11111111-1111-1111-1111-111111111111');
insert into bildirishnomalar (id, turi, sarlavha, kimga, holat) values (9004, 'elon', 'Yopilgan', array['oquvchi'], 'yopilgan');
insert into bildirishnoma_variantlar (id, bildirishnoma_id, matn, tartib) values (9101, 9002, 'Ha', 0), (9102, 9002, 'Yo''q', 1);

set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';   -- o'quvchi S001 (N01)
do $$
declare v jsonb := mening_bildirishnomalarim();
begin
  if not (v @> '[{"id":9001}]' and v @> '[{"id":9002}]') then raise exception 'XATO: o''quvchi o''ziga tegishlisini ko''rmadi: %', v; end if;
  if v @> '[{"id":9003}]' then raise exception 'XATO: ustozlarniki o''quvchiga chiqdi'; end if;
  if v @> '[{"id":9004}]' then raise exception 'XATO: yopilgan bildirishnoma chiqdi'; end if;
  if (select count(*) from bildirishnomalar where id = 9003) <> 0 then raise exception 'XATO: RLS — o''quvchi begona bildirishnomani o''qidi'; end if;

  begin
    perform sorovnomaga_javob(9002, array[9101, 9102]::bigint[]);
    raise exception 'XATO: bitta tanlovli so''rovnomada 2 ta ovoz o''tdi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;
  begin
    perform sorovnomaga_javob(9002, array[999999]::bigint[]);
    raise exception 'XATO: begona variantga ovoz o''tdi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;
  begin
    insert into bildirishnoma_javoblar (bildirishnoma_id, variant_id, profile_id) values (9002, 9101, auth.uid());
    raise exception 'XATO: javob to''g''ridan-to''g''ri yozildi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;

  perform sorovnomaga_javob(9002, array[9101]::bigint[]);
  perform sorovnomaga_javob(9002, array[9102]::bigint[]);   -- fikrini o'zgartirdi
  if (select count(*) from bildirishnoma_javoblar where bildirishnoma_id = 9002) <> 1 then
    raise exception 'XATO: ovoz almashtirilganda eski ovoz qoldi';
  end if;
  if (select ovoz from sorovnoma_natija(9002) where variant_id = 9102) <> 1 then raise exception 'XATO: natija noto''g''ri'; end if;

  perform bildirishnoma_belgila(9001, true);
  if (mening_bildirishnomalarim() -> 0 ->> 'id') is null then null; end if;
  if not (select yopildi_at is not null from bildirishnoma_holat where bildirishnoma_id = 9001 and profile_id = auth.uid()) then
    raise exception 'XATO: yopildi belgilanmadi';
  end if;
  raise notice 'OK: bildirishnoma — o''quvchi: ko''rinish, ovoz, yopish';
end $$;

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- ustoz
do $$
declare v jsonb := mening_bildirishnomalarim();
begin
  if not (v @> '[{"id":9003}]' and v @> '[{"id":9002}]') then raise exception 'XATO: ustoz o''ziga tegishlisini ko''rmadi'; end if;
  if v @> '[{"id":9001}]' then raise exception 'XATO: o''quvchilarniki ustozga chiqdi'; end if;
  begin
    perform * from sorovnoma_natija(9002);
    raise exception 'XATO: ovoz bermagan natijani ko''rdi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;
  begin
    insert into bildirishnomalar (turi, sarlavha, kimga) values ('elon', 'Ustoz e''loni', array['oquvchi']);
    raise exception 'XATO: ustoz bildirishnoma yaratdi';
  exception when others then if sqlerrm like 'XATO%' then raise; end if;
  end;
  raise notice 'OK: bildirishnoma — ustoz: faqat o''ziniki, yarata olmaydi';
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- admin
do $$
begin
  if (select count(*) from bildirishnomalar where id between 9001 and 9004) <> 4 then raise exception 'XATO: admin hammasini ko''rmadi'; end if;
  if (select javob_bergan from bildirishnoma_statistika() where bildirishnoma_id = 9002) <> 1 then raise exception 'XATO: statistika noto''g''ri'; end if;
  raise notice 'OK: bildirishnoma — admin: hammasi va statistika';
end $$;
reset role;
reset request.jwt.claim.sub;

-- ============================================================
--  OTA-ONA QARZI (0050): ota-ona farzandining qarzini o'quvchining o'zi bilan bir xil ko'radi
-- ============================================================
reset role;
reset request.jwt.claim.sub;
insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 's001-ota@wba.uz')
  on conflict do nothing;
update profiles set rol = 'ota_ona', ism = 'Sinov Ota', oquvchi_id = 'S001'
  where id = '88888888-8888-8888-8888-888888888888';
\echo '--- 0050: ota-ona qarzi = o''quvchi qarzi ---'
set role authenticated;
do $$
declare v_oquvchi numeric; v_ota numeric;
begin
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
  select coalesce(sum(qarz), 0) into v_oquvchi from v_enrollment_balance where student_id = 'S001';
  perform set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
  select coalesce(sum(qarz), 0) into v_ota from v_enrollment_balance where student_id = 'S001';
  if v_ota is distinct from v_oquvchi then
    raise exception 'XATO: ota-ona qarzi % , o''quvchiniki %', v_ota, v_oquvchi;
  end if;
  raise notice 'OK: ota-ona qarzni to''g''ri ko''radi (%)', v_ota;
end $$;
reset role;
reset request.jwt.claim.sub;

\echo '=== TEST TUGADI ==='
