-- ============================================================
--  0137 — Davomat faqat 2 holat + davomat vaqti (Jamshid, 22.11)
-- ============================================================
--  Reyting (0138–0141) uchun tayyorgarlik.
--  1. attendance_status: faqat 'keldi' va 'kelmadi'. 'kechikdi' va
--     'sababli' enum'dan, funksiyalardan va v_attendance_monthly'dan
--     olib tashlanadi. Prod'da 22.11 holatiga bunday yozuv 0 ta, lekin
--     ehtiyot uchun: kechikdi -> keldi, sababli -> kelmadi.
--  2. lessons.davomat_vaqti — darsning davomati BIRINCHI marta to'liq
--     bo'lgan vaqt (davomat_holati: har faol o'quvchiga belgi). Bir marta
--     yoziladi, keyin o'zgarmaydi. Ustoz reytingidagi "davomatni dars
--     kunidan keyin belgilash" hodisasi shundan olinadi.
--  Funksiya matnlari prod sxema zaxirasidan (22.11 22:13) olingan, faqat
--  kechikdi/sababli qatorlari o'zgartirilgan.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Eski qiymatlar (ehtiyot uchun)
-- ------------------------------------------------------------
update attendance      set holat = 'keldi'   where holat = 'kechikdi';
update attendance      set holat = 'kelmadi' where holat = 'sababli';
update probniy_davomat set holat = 'keldi'   where holat = 'kechikdi';
update probniy_davomat set holat = 'kelmadi' where holat = 'sababli';

-- ------------------------------------------------------------
-- 2. Enum'ni qayta yaratish
-- ------------------------------------------------------------
drop view if exists v_attendance_monthly;

alter type attendance_status rename to attendance_status_eski;
create type attendance_status as enum ('keldi', 'kelmadi');

alter table attendance
  alter column holat type attendance_status using holat::text::attendance_status;
alter table probniy_davomat
  alter column holat type attendance_status using holat::text::attendance_status;

-- Imzoda eski tur bor — o'chirib, yangisi bilan quyida qayta yaratiladi
drop function if exists probniy_belgila(text, date, uuid, attendance_status_eski);

-- ------------------------------------------------------------
-- 3. Funksiyalar (kechikdi/sababli olib tashlangan)
-- ------------------------------------------------------------

-- ertangi_maslahat
CREATE OR REPLACE FUNCTION "public"."ertangi_maslahat"("p_kun" "date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with e as (select p_kun + 1 as k)
  select jsonb_build_object(
    'ertaga', (select k from e),
    'vazifalar', coalesce((
      select jsonb_agg(jsonb_build_object('nom', v.nom,
               'vaqt', to_char(v.muddat at time zone 'Asia/Tashkent', 'DD/MM/YYYY HH24:MI'),
               'kim', coalesce(l.ism, st.fish), 'tel', coalesce(l.telefon, st.shaxsiy_tel, st.ota_tel, st.ona_tel),
               'otgan', (v.muddat at time zone 'Asia/Tashkent')::date <= p_kun)
             order by v.muddat)
      from crm_vazifalar v
      cross join e
      left join leads l on l.id = v.lead_id
      left join students st on st.id = v.student_id
      where v.holat in ('yangi', 'jarayonda')
        and (v.muddat at time zone 'Asia/Tashkent')::date <= e.k), '[]'::jsonb),
    'tugilgan', coalesce((
      select jsonb_agg(jsonb_build_object('ism', x.ism, 'kim', x.kim) order by x.ism)
      from (
        select st.fish as ism, 'o‘quvchi' as kim, st.tugilgan_sana as ts from students st where st.holat = 'faol'
        union all
        select l.ism, 'probniy', l.tugilgan_sana from leads l where l.holat in ('yangi', 'qongiroq', 'keldi')
      ) x, e
      where x.ts is not null and to_char(x.ts, 'MM-DD') = to_char(e.k, 'MM-DD')), '[]'::jsonb),
    'tugilgan_yoq', (select count(*) from students where holat = 'faol' and tugilgan_sana is null),
    'faol_soni', (select count(*) from students where holat = 'faol'),
    'probniylar', coalesce((
      select jsonb_agg(jsonb_build_object('ism', l.ism, 'tel', l.telefon, 'fan', coalesce(s.nom, '—'),
               'kun', p_kun - (l.created_at at time zone 'Asia/Tashkent')::date,
               'kelgan', exists (select 1 from probniy_davomat pd where pd.lead_id = l.id and pd.holat = 'keldi'))
             order by l.created_at)
      from leads l left join groups g on g.id = l.group_id left join subjects s on s.id = coalesce(g.subject_id, l.subject_id)
      where l.holat in ('yangi', 'qongiroq', 'keldi') and l.student_id is null), '[]'::jsonb),
    'qarzdorlar', coalesce((
      select jsonb_agg(jsonb_build_object('guruh', x.nom, 'vaqt', x.boshlanish, 'oquvchilar', x.royxat) order by x.boshlanish, x.nom)
      from (
        select g.nom, g.boshlanish,
               jsonb_agg(jsonb_build_object('fish', st.fish, 'qarz', b.qarz) order by b.qarz desc) as royxat
        from groups g
        cross join e
        join enrollments en on en.group_id = g.id and en.holat = 'faol'
        join v_enrollment_balance b on b.enrollment_id = en.id and b.qarz > 0
        join students st on st.id = en.student_id
        where g.holat = 'faol' and guruh_dars_kuni(g.id, e.k)
        group by g.id, g.nom, g.boshlanish
      ) x), '[]'::jsonb)
  )
$$;

-- hisobot_davomat
CREATE OR REPLACE FUNCTION "public"."hisobot_davomat"("p_dan" "date", "p_gacha" "date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  with b as (
    select a.student_id, a.holat::text as holat, l.sana, l.group_id
    from attendance a join lessons l on l.id = a.lesson_id
    where l.sana between p_dan and p_gacha
  ),
  -- Jadval bo'yicha dars kunlari (bugungacha)
  kun as (
    select g.id as group_id, k.sana::date as sana
    from groups g
    cross join generate_series(p_dan::timestamp, least(p_gacha, bugun_toshkent())::timestamp, interval '1 day') k(sana)
    where g.holat = 'faol' and guruh_dars_kunimi(guruh_kunlari(g.id, k.sana::date), k.sana::date)
  ),
  -- Har dars kuni × o'sha kuni guruhda bo'lgan o'quvchi = bitta kutilgan belgi
  slot as (
    select k.group_id, k.sana, e.student_id,
           (select a.holat::text from lessons l join attendance a on a.lesson_id = l.id
             where l.group_id = k.group_id and l.sana = k.sana and a.student_id = e.student_id
             limit 1) as holat
    from kun k
    join enrollments e on e.group_id = k.group_id
     and e.boshlandi <= k.sana and (e.tugadi is null or e.tugadi >= k.sana)
  ),
  dars as (
    select s.group_id, s.sana,
           (count(s.holat) > 0 or exists (
              select 1 from lessons l where l.group_id = s.group_id and l.sana = s.sana and l.otkazildi
           )) as otildi
    from slot s group by s.group_id, s.sana
  ),
  hafta as (
    select date_trunc('week', sana)::date as hafta,
           count(*) as belgi,
           count(*) filter (where holat = 'keldi') as kelgan
    from b group by 1
  ),
  guruh as (
    select g.id, g.nom, coalesce(t.ism, '—') as ustoz,
      (select count(*) from enrollments e where e.group_id = g.id and e.holat = 'faol') as oquvchi,
      (select count(*) from b where b.group_id = g.id) as belgi,
      (select count(*) from b where b.group_id = g.id and b.holat = 'keldi') as kelgan,
      (select count(*) from dars d where d.group_id = g.id) as dars_reja,
      (select count(*) from dars d where d.group_id = g.id and d.otildi) as dars_otildi,
      (select count(*) from slot s where s.group_id = g.id) as kutilgan,
      (select count(*) from slot s where s.group_id = g.id and s.holat = 'keldi') as s_keldi,
      (select count(*) from slot s where s.group_id = g.id and s.holat = 'kelmadi') as s_kelmadi,
      (select count(*) from slot s where s.group_id = g.id and s.holat is null) as s_belgilanmagan
    from groups g left join teachers t on t.id = g.teacher_id
    where g.holat = 'faol'
  ),
  qoldiruvchi as (
    select b.student_id, s.fish,
           string_agg(distinct gr.nom, ', ') as guruh,
           count(*) as belgi,
           count(*) filter (where b.holat = 'kelmadi') as kelmadi
    from b join students s on s.id = b.student_id
    join groups gr on gr.id = b.group_id
    where s.holat = 'faol'
    group by b.student_id, s.fish
    having count(*) filter (where b.holat = 'kelmadi') >= 2
  )
  select jsonb_build_object(
    'jami_belgi', (select count(*) from b),
    'jami_kelgan', (select count(*) from b where holat = 'keldi'),
    'darslar', jsonb_build_object(
      'reja',          (select count(*) from dars),
      'otildi',        (select count(*) from dars where otildi),
      'belgilanmagan', (select count(*) from dars where not otildi)
    ),
    'belgilar', jsonb_build_object(
      'kutilgan',      (select count(*) from slot),
      'keldi',         (select count(*) from slot where holat = 'keldi'),
      'kelmadi',       (select count(*) from slot where holat = 'kelmadi'),
      'belgilanmagan', (select count(*) from slot where holat is null)
    ),
    'haftalar', coalesce((select jsonb_agg(to_jsonb(h) order by h.hafta) from hafta h), '[]'::jsonb),
    'guruhlar', coalesce((select jsonb_agg(to_jsonb(g) order by g.oquvchi desc, g.nom) from guruh g), '[]'::jsonb),
    'qoldiruvchilar', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.kelmadi desc, q.fish)
      from (select * from qoldiruvchi order by kelmadi desc, fish limit 20) q
    ), '[]'::jsonb)
  )
$$;

-- hisobot_davomat_ichki
CREATE OR REPLACE FUNCTION "public"."hisobot_davomat_ichki"("p_dan" "date", "p_gacha" "date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with b as (
    select a.student_id, a.holat::text as holat, l.sana, l.group_id
    from attendance a join lessons l on l.id = a.lesson_id
    where l.sana between p_dan and p_gacha
  ),
  hafta as (
    select date_trunc('week', sana)::date as hafta,
           count(*) as belgi,
           count(*) filter (where holat = 'keldi') as kelgan
    from b group by 1
  ),
  guruh as (
    select g.id, g.nom, coalesce(t.ism, '—') as ustoz,
      (select count(*) from enrollments e where e.group_id = g.id and e.holat = 'faol') as oquvchi,
      (select count(*) from b where b.group_id = g.id) as belgi,
      (select count(*) from b where b.group_id = g.id and b.holat = 'keldi') as kelgan
    from groups g left join teachers t on t.id = g.teacher_id
    where g.holat = 'faol'
  ),
  qoldiruvchi as (
    select b.student_id, s.fish,
           string_agg(distinct gr.nom, ', ') as guruh,
           count(*) as belgi,
           count(*) filter (where b.holat = 'kelmadi') as kelmadi
    from b join students s on s.id = b.student_id
    join groups gr on gr.id = b.group_id
    where s.holat = 'faol'
    group by b.student_id, s.fish
    having count(*) filter (where b.holat = 'kelmadi') >= 2
  )
  select jsonb_build_object(
    'jami_belgi', (select count(*) from b),
    'jami_kelgan', (select count(*) from b where holat = 'keldi'),
    'haftalar', coalesce((select jsonb_agg(to_jsonb(h) order by h.hafta) from hafta h), '[]'::jsonb),
    'guruhlar', coalesce((select jsonb_agg(to_jsonb(g) order by g.oquvchi desc, g.nom) from guruh g), '[]'::jsonb),
    'qoldiruvchilar', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.kelmadi desc, q.fish)
      from (select * from qoldiruvchi order by kelmadi desc, fish limit 20) q
    ), '[]'::jsonb)
  )
$$;

-- hisobot_grafik_ichki
CREATE OR REPLACE FUNCTION "public"."hisobot_grafik_ichki"("p_dan" "date", "p_gacha" "date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with oraliq as (
    select p_dan as dan, p_gacha as gacha,
           (p_dan - (p_gacha - p_dan + 1))::date as odan,
           (p_dan - 1)::date as ogacha
  ),
  kun as (
    select k::date as sana from oraliq o, generate_series(o.dan, o.gacha, interval '1 day') k
  ),
  tol as (
    select p.sana, p.summa, p.enrollment_id from payments p, oraliq o
    where not p.bekor and p.sana between o.odan and o.gacha
  ),
  bel as (
    select l.sana, a.holat::text as holat from attendance a join lessons l on l.id = a.lesson_id, oraliq o
    where l.sana between o.odan and o.gacha
  ),
  yoz as (
    select e.boshlandi as sana from enrollments e, oraliq o
    where e.boshlandi between o.odan and o.gacha
  ),
  jami as (
    select
      (select coalesce(sum(summa), 0) from tol, oraliq o where sana between o.dan and o.gacha)                as tushum,
      (select count(*) from tol, oraliq o where sana between o.dan and o.gacha)                               as tolov,
      (select count(*) from bel, oraliq o where sana between o.dan and o.gacha)                               as belgi,
      (select count(*) from bel, oraliq o where sana between o.dan and o.gacha and holat = 'keldi') as kelgan,
      (select count(*) from yoz, oraliq o where sana between o.dan and o.gacha)                               as yangi,
      (select coalesce(sum(summa), 0) from tol, oraliq o where sana between o.odan and o.ogacha)              as o_tushum,
      (select count(*) from bel, oraliq o where sana between o.odan and o.ogacha)                             as o_belgi,
      (select count(*) from bel, oraliq o where sana between o.odan and o.ogacha and holat = 'keldi') as o_kelgan,
      (select count(*) from yoz, oraliq o where sana between o.odan and o.ogacha)                             as o_yangi
  )
  select jsonb_build_object(
    'kunlar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sana', k.sana,
        'tushum', coalesce((select sum(summa) from tol where tol.sana = k.sana), 0),
        'belgi', (select count(*) from bel where bel.sana = k.sana),
        'kelgan', (select count(*) from bel where bel.sana = k.sana and holat = 'keldi'),
        'yangi', (select count(*) from yoz where yoz.sana = k.sana)
      ) order by k.sana) from kun k
    ), '[]'::jsonb),
    'joriy', (select jsonb_build_object('tushum', tushum, 'tolov', tolov, 'belgi', belgi, 'kelgan', kelgan, 'yangi', yangi) from jami),
    'oldingi', (select jsonb_build_object('tushum', o_tushum, 'belgi', o_belgi, 'kelgan', o_kelgan, 'yangi', o_yangi) from jami),
    'guruhlar', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.tushum desc)
      from (
        select gr.id, gr.nom, sum(t.summa) as tushum
        from tol t join enrollments e on e.id = t.enrollment_id join groups gr on gr.id = e.group_id, oraliq o
        where t.sana between o.dan and o.gacha
        group by gr.id, gr.nom
        order by sum(t.summa) desc
        limit 8
      ) g
    ), '[]'::jsonb),
    'qarzdorlar', (select count(*) from v_qarzdorlar)
  )
$$;

-- hisobot_royxat
CREATE OR REPLACE FUNCTION "public"."hisobot_royxat"("p_tur" "text", "p_davr" "text" DEFAULT NULL::"text", "p_kim" "text" DEFAULT NULL::"text", "p_dan" "date" DEFAULT NULL::"date", "p_gacha" "date" DEFAULT NULL::"date") RETURNS TABLE("kalit" "text", "student_id" "text", "lead_id" "uuid", "fish" "text", "group_id" "text", "guruh" "text", "sana" "date", "summa" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  with d as (
    select to_date(coalesce(p_davr, to_char(bugun_toshkent(), 'YYYY-MM')) || '-01', 'YYYY-MM-DD') as boshi,
           least((to_date(coalesce(p_davr, to_char(bugun_toshkent(), 'YYYY-MM')) || '-01', 'YYYY-MM-DD')
                  + interval '1 month - 1 day')::date, bugun_toshkent()) as oxiri
  ),
  ye as (  -- yozilish + o'quvchi + guruh
    select e.*, s.fish, s.holat as s_holat, g.nom as g_nom, g.subject_id, g.teacher_id
    from enrollments e
    join students s on s.id = e.student_id
    left join groups g on g.id = e.group_id
  ),
  -- hisobot_davomat: jadval bo'yicha dars kunlari (bugungacha) × o'sha kuni guruhdagi o'quvchi
  kun as (
    select g.id as group_id, g.nom, k.sana::date as sana
    from groups g
    cross join generate_series(p_dan::timestamp, least(p_gacha, bugun_toshkent())::timestamp, interval '1 day') k(sana)
    where left(p_tur, 4) = 'dav_' and g.holat = 'faol' and guruh_dars_kunimi(guruh_kunlari(g.id, k.sana::date), k.sana::date)
      and (p_kim is null or g.id = p_kim)
  ),
  slot as (
    select k.group_id, k.nom, k.sana, e.student_id, s.fish,
           (select a.holat::text from lessons l join attendance a on a.lesson_id = l.id
             where l.group_id = k.group_id and l.sana = k.sana and a.student_id = e.student_id
             limit 1) as holat
    from kun k
    join enrollments e on e.group_id = k.group_id
     and e.boshlandi <= k.sana and (e.tugadi is null or e.tugadi >= k.sana)
    join students s on s.id = e.student_id
  ),
  dars as (
    select s.group_id, s.nom, s.sana,
           (count(s.holat) > 0 or exists (
              select 1 from lessons l where l.group_id = s.group_id and l.sana = s.sana and l.otkazildi
           )) as otildi
    from slot s group by s.group_id, s.nom, s.sana
  ),
  -- hisobot_ustozlar_ichki: ustoz guruhlaridagi belgilar
  ub as (
    select a.student_id, s.fish, a.holat::text as holat, l.id as lesson_id, l.sana, g.id as group_id, g.nom
    from attendance a join lessons l on l.id = a.lesson_id join groups g on g.id = l.group_id
    join students s on s.id = a.student_id
    where p_tur in ('ustoz_dars', 'ustoz_belgi', 'ustoz_kelgan')
      and g.teacher_id = p_kim and l.sana between p_dan and p_gacha
  )
  -- ---------- Hozirgi holat ----------
  select ye.id::text, ye.student_id, null::uuid, ye.fish, ye.group_id, ye.g_nom, ye.boshlandi, null::numeric
    from ye where p_tur = 'faol_fan' and ye.holat = 'faol' and ye.s_holat = 'faol'
  union all
  select distinct on (ye.student_id) ye.student_id, ye.student_id, null, ye.fish, null, null, null::date, null
    from ye where p_tur = 'faol_bola' and ye.holat = 'faol' and ye.s_holat = 'faol'
  union all
  select ye.student_id, ye.student_id, null, min(ye.fish), null, string_agg(ye.g_nom, ' | ' order by ye.g_nom), null::date, null
    from ye
   where p_tur = 'ikki_fanli' and ye.holat = 'faol' and ye.s_holat = 'faol'
   group by ye.student_id having count(*) > 1
  union all
  select ye.id::text, ye.student_id, null, ye.fish, ye.group_id, ye.g_nom, ye.boshlandi, null
    from ye where p_tur = 'vip' and ye.holat = 'faol' and ye.vip
  union all
  select s.id, s.id, null, s.fish, null, null, s.arxiv_sana, null
    from students s where p_tur = 'arxiv' and s.holat = 'ketgan'
  union all
  select ye.id::text, ye.student_id, null, ye.fish, ye.group_id, ye.g_nom, ye.boshlandi, null
    from ye left join subjects sb on sb.id = ye.subject_id
   where p_tur = 'fan' and ye.holat = 'faol' and ye.s_holat = 'faol' and ye.group_id is not null
     and coalesce(sb.nom, 'Boshqa') = p_kim
  -- ---------- Oy bo'yicha (O'quvchilar oqimi) ----------
  union all
  select b.student_id, b.student_id, null, s.fish, null, null, b.boshlandi, null
    from (select student_id, min(boshlandi) as boshlandi from enrollments group by 1) b
    join students s on s.id = b.student_id, d
   where p_tur = 'yangi_bola' and b.boshlandi between d.boshi and d.oxiri
  union all
  select e.id::text, e.student_id, null, e.fish, e.group_id, e.g_nom, e.boshlandi, null
    from ye e, d
   where p_tur = 'yangi_fan' and e.boshlandi between d.boshi and d.oxiri
     and not exists (select 1 from enrollments o join groups go on go.id = o.group_id
                     where o.student_id = e.student_id and o.id <> e.id and go.subject_id = e.subject_id
                       and o.tugadi between e.boshlandi - 1 and e.boshlandi)
  union all
  select s.id, s.id, null, s.fish, null, null, s.arxiv_sana, null
    from students s, d where p_tur = 'ketgan_bola' and s.arxiv_sana between d.boshi and d.oxiri
  union all
  select e.id::text, e.student_id, null, e.fish, e.group_id, e.g_nom, e.tugadi, null
    from ye e, d
   where p_tur = 'tugagan_fan' and e.tugadi between d.boshi and d.oxiri
     and not exists (select 1 from enrollments o join groups go on go.id = o.group_id
                     where o.student_id = e.student_id and o.id <> e.id and go.subject_id = e.subject_id
                       and o.boshlandi between e.tugadi and e.tugadi + 1)
  union all
  select distinct on (e.student_id) e.student_id, e.student_id, null, e.fish, null, null, null::date, null
    from ye e, d
   where p_tur = 'oy_faol_bola' and e.boshlandi <= d.oxiri and (e.tugadi is null or e.tugadi >= d.oxiri)
     and e.holat <> 'tanaffus'
  union all
  select e.id::text, e.student_id, null, e.fish, e.group_id, e.g_nom, e.boshlandi, null
    from ye e, d
   where p_tur = 'oy_faol_fan' and e.boshlandi <= d.oxiri and (e.tugadi is null or e.tugadi >= d.oxiri)
     and e.holat <> 'tanaffus'
  union all
  select l.id::text, l.student_id, l.id, l.ism, l.group_id, g.nom, l.created_at::date, null
    from leads l left join groups g on g.id = l.group_id, d
   where l.holat <> 'xato' and p_tur in ('probniy', 'probniy_yozildi') and l.created_at::date between d.boshi and d.oxiri
     and (p_tur = 'probniy' or l.holat = 'yozildi')
  -- ---------- Davomat (p_dan..p_gacha) ----------
  union all
  select s.group_id || '|' || s.sana || '|' || s.student_id, s.student_id, null, s.fish, s.group_id, s.nom, s.sana, null
    from slot s
   where (p_tur = 'dav_kutilgan')
      or (p_tur = 'dav_keldi' and s.holat = 'keldi')
      or (p_tur = 'dav_kelmadi' and s.holat = 'kelmadi')
      or (p_tur = 'dav_belgisiz' and s.holat is null)
  union all
  select x.group_id || '|' || x.sana, null, null, x.nom, x.group_id, x.nom, x.sana, null
    from dars x
   where p_tur = 'dav_dars'
      or (p_tur = 'dav_dars_otildi' and x.otildi)
      or (p_tur = 'dav_dars_qilinmagan' and not x.otildi)
  -- ---------- Ustoz (p_kim = ustoz) ----------
  union all
  select e.id::text, e.student_id, null, e.fish, e.group_id, e.g_nom, e.boshlandi, null
    from ye e where p_tur = 'ustoz_oquvchi' and e.teacher_id = p_kim and e.holat = 'faol'
  union all
  select q.id::text, q.student_id, null, q.fish, q.group_id, q.g_nom, null::date, q.qarz
    from (
      select e.id, e.student_id, e.fish, e.group_id, e.g_nom,
             (select coalesce(sum(i.summa), 0) from invoices i where i.enrollment_id = e.id and i.holat <> 'bekor')
           - (select coalesce(sum(p.summa), 0) from payments p where p.enrollment_id = e.id and not p.bekor) as qarz
      from ye e where p_tur = 'ustoz_qarz' and e.teacher_id = p_kim
    ) q where q.qarz > 0
  union all
  select distinct on (ub.lesson_id) ub.lesson_id::text, null, null, ub.nom, ub.group_id, ub.nom, ub.sana, null
    from ub where p_tur = 'ustoz_dars'
  union all
  select ub.lesson_id || '|' || ub.student_id, ub.student_id, null, ub.fish, ub.group_id, ub.nom, ub.sana, null
    from ub where p_tur = 'ustoz_belgi' or (p_tur = 'ustoz_kelgan' and ub.holat = 'keldi')
  union all
  select p.id::text, p.student_id, null, s.fish, g.id, g.nom, p.sana, p.summa
    from payments p join enrollments e on e.id = p.enrollment_id join groups g on g.id = e.group_id
    join students s on s.id = p.student_id
   where p_tur = 'ustoz_tushum' and g.teacher_id = p_kim and not p.bekor and p.sana between p_dan and p_gacha
  union all
  select w.id::text, w.student_id, null, s.fish, null, null, (w.created_at at time zone 'Asia/Tashkent')::date, w.ball
    from woblr w left join students s on s.id = w.student_id
   where p_tur = 'ustoz_woblar' and w.teacher_id = p_kim
     and (w.created_at at time zone 'Asia/Tashkent')::date between p_dan and p_gacha
  -- ---------- O'rtacha to'lov (0091): oyda o'qigan yoki to'lagan (bola × fan) ----------
  union all
  select j.student_id || '|' || j.fan, j.student_id, null, s.fish, null, j.guruhlar, null::date, null
    from (
      select x.student_id, x.fan, min(x.subject_id) as subject_id, string_agg(distinct x.g_nom, ' | ') as guruhlar
      from (
        select e.student_id, coalesce(g.subject_id, 'guruh:' || g.id) as fan, g.subject_id, g.nom as g_nom
          from enrollments e join groups g on g.id = e.group_id, d
         where e.boshlandi <= (d.boshi + interval '1 month - 1 day')::date
           and coalesce(e.tugadi, 'infinity'::date) >= d.boshi
        union all
        select e.student_id, coalesce(g.subject_id, 'guruh:' || g.id), g.subject_id, g.nom
          from payments p join enrollments e on e.id = p.enrollment_id join groups g on g.id = e.group_id
         where not p.bekor and p.davr = p_davr
      ) x group by x.student_id, x.fan
    ) j
    join students s on s.id = j.student_id
    left join subjects sb on sb.id = j.subject_id
   where p_tur = 'ortacha_fan' and (p_kim is null or coalesce(sb.nom, 'Fani belgilanmagan') = p_kim)
  union all
  select p.id::text, p.student_id, null, s.fish, g.id, g.nom, p.sana, p.summa
    from payments p
    left join enrollments e on e.id = p.enrollment_id
    left join groups g on g.id = e.group_id
    left join subjects sb on sb.id = g.subject_id
    left join students s on s.id = p.student_id
   where p_tur = 'ortacha_tolov' and not p.bekor and p.davr = p_davr
     and (p_kim is null or (e.id is not null and coalesce(sb.nom, 'Fani belgilanmagan') = p_kim))
  -- ---------- Umumiy hisobot / bosh sahifa (p_dan..p_gacha) ----------
  union all
  select p.id::text, p.student_id, null, coalesce(s.fish, '—'), g.id, g.nom, p.sana, p.summa
    from payments p
    left join enrollments e on e.id = p.enrollment_id
    left join groups g on g.id = e.group_id
    left join students s on s.id = p.student_id
   where p_tur = 'tushum' and not p.bekor and p.sana between p_dan and p_gacha
     and (p_kim is null
          or (p_kim = 'tasdiqlanmagan' and not p.tasdiqlangan)
          or (p_kim = 'tasdiqlangan' and p.tasdiqlangan)
          or coalesce(p.usul::text, 'aniqlanmagan') = p_kim)
  union all
  select a.lesson_id || '|' || a.student_id, a.student_id, null, s.fish, l.group_id, g.nom, l.sana, null
    from attendance a join lessons l on l.id = a.lesson_id
    join students s on s.id = a.student_id
    left join groups g on g.id = l.group_id
   where p_tur in ('belgi', 'belgi_kelgan') and l.sana between p_dan and p_gacha
     and (p_tur = 'belgi' or a.holat = 'keldi')
  union all
  select e.id::text, e.student_id, null, s.fish, e.group_id, g.nom, e.boshlandi, null
    from enrollments e join students s on s.id = e.student_id left join groups g on g.id = e.group_id
   where p_tur = 'yangi_yozilish' and e.boshlandi between p_dan and p_gacha
  union all
  select k.group_id || '|' || k.sana, null, null, k.nom, k.group_id, k.nom, k.sana, null
    from (
      select g.id as group_id, g.nom, k.sana::date as sana
      from groups g
      cross join generate_series(p_dan::timestamp, least(p_gacha, bugun_toshkent())::timestamp, interval '1 day') k(sana)
      where p_tur in ('dars_kutilgan', 'dars_qilinmagan') and g.holat = 'faol'
        and guruh_dars_kunimi(guruh_kunlari(g.id, k.sana::date), k.sana::date)
        and exists (select 1 from enrollments e
                    where e.group_id = g.id and e.boshlandi <= k.sana::date
                      and (e.tugadi is null or e.tugadi >= k.sana::date))
    ) k
   where p_tur = 'dars_kutilgan'
      or not exists (select 1 from lessons l
                     where l.group_id = k.group_id and l.sana = k.sana
                       and (l.otkazildi or exists (select 1 from attendance a where a.lesson_id = l.id)))
  union all
  select l.id::text, l.student_id, l.id, l.ism, l.group_id, g.nom, (l.created_at at time zone 'Asia/Tashkent')::date, null
    from leads l left join groups g on g.id = l.group_id
   where l.holat <> 'xato' and p_tur = 'lid' and (l.created_at at time zone 'Asia/Tashkent')::date between p_dan and p_gacha
     and (p_kim is null
          or (p_kim = 'kutilmoqda' and l.holat::text in ('yangi', 'qongiroq', 'keldi'))
          or l.holat::text = p_kim)
  union all
  select p.id::text, p.student_id, null, coalesce(s.fish, '—'), g.id, g.nom, p.sana, p.summa
    from payments p join enrollments e on e.id = p.enrollment_id join groups g on g.id = e.group_id
    left join students s on s.id = p.student_id
   where p_tur = 'ustoz_oy_tushum' and not p.bekor and p.davr = p_davr and g.teacher_id = p_kim
  union all
  select b.enrollment_id::text, b.student_id, null, s.fish, g.id, g.nom, null::date,
         case when p_tur = 'balans_tolangan' then b.tolangan else b.qarz end
    from v_enrollment_balance b
    join groups g on g.id = b.group_id
    join students s on s.id = b.student_id
   where p_tur in ('balans_tolangan', 'balans_qarz')
     and ((left(p_kim, 2) = 'u:' and g.teacher_id = substr(p_kim, 3)) or (left(p_kim, 2) = 'g:' and g.id = substr(p_kim, 3)))
     and (case when p_tur = 'balans_tolangan' then b.tolangan else b.qarz end) <> 0
  union all
  select l.id::text, null, null, g.nom, g.id, g.nom, l.sana, null
    from lessons l join groups g on g.id = l.group_id
   where p_tur = 'ustoz_otkazilgan' and g.teacher_id = p_kim and g.holat = 'faol' and l.otkazildi
     and l.sana between p_dan and p_gacha
$$;

-- hisobot_ustozlar_ichki
CREATE OR REPLACE FUNCTION "public"."hisobot_ustozlar_ichki"("p_dan" "date", "p_gacha" "date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with u as (
    select t.id, t.ism from teachers t where t.holat = 'faol'
  ),
  qator as (
    select u.id, u.ism,
      (select count(*) from groups g where g.teacher_id = u.id and g.holat = 'faol') as guruh,
      (select count(*) from enrollments e join groups g on g.id = e.group_id
        where g.teacher_id = u.id and e.holat = 'faol') as yozilish,
      (select count(*) from attendance a join lessons l on l.id = a.lesson_id join groups g on g.id = l.group_id
        where g.teacher_id = u.id and l.sana between p_dan and p_gacha) as belgi,
      (select count(*) from attendance a join lessons l on l.id = a.lesson_id join groups g on g.id = l.group_id
        where g.teacher_id = u.id and l.sana between p_dan and p_gacha
          and a.holat = 'keldi') as kelgan,
      (select count(distinct l.id) from lessons l join groups g on g.id = l.group_id
        where g.teacher_id = u.id and l.sana between p_dan and p_gacha
          and exists (select 1 from attendance a where a.lesson_id = l.id)) as dars,
      (select coalesce(sum(p.summa), 0) from payments p join enrollments e on e.id = p.enrollment_id
        join groups g on g.id = e.group_id
        where g.teacher_id = u.id and not p.bekor and p.sana between p_dan and p_gacha) as tushum,
      (select coalesce(sum(greatest(q.qarz, 0)), 0) from (
         select (select coalesce(sum(i.summa), 0) from invoices i where i.enrollment_id = e.id and i.holat <> 'bekor')
              - (select coalesce(sum(p.summa), 0) from payments p where p.enrollment_id = e.id and not p.bekor) as qarz
         from enrollments e join groups g on g.id = e.group_id
         where g.teacher_id = u.id) q) as qarz,
      (select coalesce(sum(w.ball), 0) from woblr w
        where w.teacher_id = u.id and (w.created_at at time zone 'Asia/Tashkent')::date between p_dan and p_gacha) as woblar
    from u
  )
  select coalesce(jsonb_agg(to_jsonb(q) order by q.tushum desc, q.ism), '[]'::jsonb) from qator q
$$;

-- kunlik_qoshimcha
CREATE OR REPLACE FUNCTION "public"."kunlik_qoshimcha"("p_kun" "date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with t as (
    select p.usul::text as usul, p.summa from payments p where not p.bekor and p.sana = p_kun
  ),
  davr as (select to_char(p_kun, 'YYYY-MM') as d),
  inv as (
    select i.enrollment_id, sum(i.summa) as summa
    from invoices i, davr where i.davr = davr.d and i.holat <> 'bekor' group by i.enrollment_id
  ),
  tol as (
    select p.enrollment_id, sum(p.summa) as summa
    from payments p, davr where p.davr = davr.d and not p.bekor and p.enrollment_id is not null group by p.enrollment_id
  ),
  faol as (
    select e.id, e.student_id from enrollments e
    join students st on st.id = e.student_id
    where e.holat <> 'tugagan' and st.holat = 'faol'
      and e.boshlandi <= p_kun and (e.tugadi is null or e.tugadi >= p_kun)
  )
  select jsonb_build_object(
    'naqd',     coalesce((select sum(summa) from t where usul = 'naqd'), 0),
    'terminal', coalesce((select sum(summa) from t where usul = 'terminal'), 0),
    'click',    coalesce((select sum(summa) from t where usul in ('click', 'payme')), 0),
    'soni',     (select count(*) from t),
    'reja',     coalesce((select sum(summa) from inv where summa > 0), 0),
    'reja_soni', (select count(*) from inv where summa > 0),
    'tushdi',   coalesce((select sum(summa) from tol), 0),
    'toliq',    (select count(*) from inv left join tol using (enrollment_id) where inv.summa > 0 and coalesce(tol.summa, 0) >= inv.summa),
    'yozdirilgan', coalesce((
      select jsonb_agg(jsonb_build_object('ism', l.ism, 'tel', l.telefon, 'fan', coalesce(s.nom, '—')) order by l.created_at)
      from leads l left join groups g on g.id = l.group_id left join subjects s on s.id = coalesce(g.subject_id, l.subject_id)
      where (l.created_at at time zone 'Asia/Tashkent')::date = p_kun), '[]'::jsonb),
    'probniy_kirgan', coalesce((
      select jsonb_agg(jsonb_build_object('ism', x.ism, 'tel', x.telefon, 'fan', x.fan) order by x.ism)
      from (
        select distinct l.ism, l.telefon, coalesce(s.nom, '—') as fan
        from probniy_davomat pd join lessons ls on ls.id = pd.lesson_id
        join leads l on l.id = pd.lead_id
        left join groups g on g.id = ls.group_id left join subjects s on s.id = g.subject_id
        where ls.sana = p_kun and pd.holat = 'keldi'
        union
        select l.ism, l.telefon, coalesce(s.nom, '—')
        from leads l join students st on st.id = l.student_id
        left join groups g on g.id = l.group_id left join subjects s on s.id = g.subject_id
        where l.holat = 'yozildi' and (l.updated_at at time zone 'Asia/Tashkent')::date = p_kun
      ) x), '[]'::jsonb),
    'rasmiy',      (select count(*) from faol),
    'rasmiy_bola', (select count(distinct student_id) from faol),
    'qoshilgan', coalesce((
      select jsonb_agg(jsonb_build_object('fish', st.fish, 'fan', coalesce(s.nom, '—')) order by st.fish)
      from enrollments e join students st on st.id = e.student_id
      join groups g on g.id = e.group_id left join subjects s on s.id = g.subject_id
      where e.boshlandi = p_kun and (e.created_at at time zone 'Asia/Tashkent')::date = p_kun), '[]'::jsonb),
    'ketgan', coalesce((
      select jsonb_agg(jsonb_build_object('fish', st.fish, 'sabab', st.ketish_sababi, 'izoh', st.arxiv_sabab,
               'qarz', coalesce(b.qarz, 0),
               'fan', (select string_agg(distinct coalesce(s.nom, '—'), ', ')
                       from enrollments e join groups g on g.id = e.group_id left join subjects s on s.id = g.subject_id
                       where e.student_id = st.id and e.tugadi between p_kun - 1 and p_kun)) order by st.fish)
      from students st left join v_student_balance b on b.student_id = st.id
      where st.holat = 'ketgan' and st.arxiv_sana = p_kun
        and coalesce(st.arxiv_sabab, '') not like 'Birlashtirildi%'), '[]'::jsonb)
  )
$$;

-- maosh_qatorlari
CREATE OR REPLACE FUNCTION "public"."maosh_qatorlari"("p_davr" "text") RETURNS TABLE("teacher_id" "text", "group_id" "text", "guruh" "text", "enrollment_id" "uuid", "student_id" "text", "fish" "text", "stavka" numeric, "n" integer, "darslar" integer, "ayirildi" integer, "hisob_darslar" integer, "summa" numeric, "zamena" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    -- 0097: ko'chirilgan dars asl oyiga (kochirilgan_dan) hisoblanadi
    where l.otkazildi and coalesce(l.kochirilgan_dan, l.sana) between oy.bosh and oy.oxir
  ),
  nn as materialized (
    select g.id as group_id,
           greatest(12,
             (select count(*) from dars d where d.group_id = g.id),
             -- 0097: jadval + ko'chirishlar, asl oy bo'yicha (0079 tuzatishi ham shu yerda)
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
  select s.ustoz, s.group_id, g.nom, s.eid, s.student_id, st.fish,
         gs.stavka, nn.n,
         count(*)::int,
         count(*) filter (where s.ayir)::int,
         count(*) filter (where not s.ayir)::int,
         round(gs.stavka * count(*) filter (where not s.ayir) / nn.n),
         bool_or(s.zamena)
  from seriya s
  join groups g on g.id = s.group_id
  join nn on nn.group_id = s.group_id
  join students st on st.id = s.student_id
  left join teacher_salaries ts on ts.teacher_id = s.guruh_ustozi
  -- 0093: umumiy guruh — ustoz stavkasi; individual/mini/ielts — guruh turi stavkasi
  cross join lateral (
    select case when g.turi = 'umumiy' then ts.qiymati
                else (select (st2.qiymat ->> g.turi)::numeric from settings st2 where st2.kalit = 'maosh.guruh_turi')
           end as stavka
  ) gs
  where s.ustoz is not null
  group by s.ustoz, s.group_id, g.nom, s.eid, s.student_id, st.fish, gs.stavka, nn.n, s.zamena
$$;

-- nazorat_yig
CREATE OR REPLACE FUNCTION "public"."nazorat_yig"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_bugun date := bugun_toshkent();
  v_soat  time := (now() at time zone 'Asia/Tashkent')::time;
  v_davr  text := to_char(bugun_toshkent(), 'YYYY-MM');
  v_oxir  date := (date_trunc('month', bugun_toshkent()) + interval '1 month' - interval '1 day')::date;
  v_soni  int := 0;
  v_n     int;
begin
  if auth.uid() is not null and not app_is_manager() then
    raise exception 'Nazoratni faqat tizim yoki manager yurgizadi.';
  end if;

  -- Ustoz kechikdi (oxirgi 3 kun)
  insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, tafsilot, kalit)
  select 'ustoz_kechikdi', k.sana, k.teacher_id, k.group_id,
         format('%s daqiqa kechikdi%s', k.daqiqa, coalesce(' · ' || k.sabab, '')),
         'kech:' || k.id
  from ustoz_kechikish k
  where k.sana >= v_bugun - 3
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- Kun oxiri (21:00 dan keyin): davomat qilinmadi, woblar berilmadi
  if v_soat >= time '21:00' then
    insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, tafsilot, kalit)
    select 'davomat_qilinmadi', v_bugun, dars_ustozi(g.id, v_bugun), g.id,
           format('%s — bugungi dars davomati qilinmadi', g.nom),
           'dav:' || g.id || ':' || v_bugun
    from groups g
    where g.holat = 'faol' and guruh_dars_kuni(g.id, v_bugun)
      and exists (select 1 from enrollments e where e.group_id = g.id and e.holat = 'faol' and e.boshlandi <= v_bugun)
      and not exists (select 1 from lessons l where l.group_id = g.id and l.sana = v_bugun and l.otkazildi)
      and dars_ustozi(g.id, v_bugun) is not null
    on conflict (kalit) do nothing;
    get diagnostics v_n = row_count; v_soni := v_soni + v_n;

    insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, tafsilot, kalit)
    select 'woblar_berilmadi', v_bugun, coalesce(l.zamena_teacher_id, g.teacher_id), g.id,
           format('%s — dars o''tdi, lekin birorta ham woblar berilmadi', g.nom),
           'wob:' || g.id || ':' || v_bugun
    from lessons l join groups g on g.id = l.group_id
    where l.sana = v_bugun and l.otkazildi
      and not exists (select 1 from woblr w where w.group_id = g.id
                        and (w.created_at at time zone 'Asia/Tashkent')::date = v_bugun)
      and not exists (select 1 from probniy_woblar w where w.group_id = g.id
                        and (w.created_at at time zone 'Asia/Tashkent')::date = v_bugun)
      and coalesce(l.zamena_teacher_id, g.teacher_id) is not null
    on conflict (kalit) do nothing;
    get diagnostics v_n = row_count; v_soni := v_soni + v_n;
  end if;

  -- O'quvchi ketma-ket 3 dars kelmadi (oxirgi 3 belgisi "kelmadi", oxirgisi 3 kun ichida)
  insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, student_id, tafsilot, kalit)
  select 'oquvchi_3_kelmadi', x.oxirgi, g.teacher_id, g.id, x.student_id,
         format('%s — ketma-ket 3 dars kelmadi (%s guruhi). Bog''lanish kerak.', s.fish, g.nom),
         'kel3:' || x.group_id || ':' || x.student_id || ':' || x.oxirgi
  from (
    select l.group_id, a.student_id,
           max(l.sana) as oxirgi,
           bool_and(a.holat = 'kelmadi') as hammasi_yoq,
           count(*) as n
    from (
      select a.*, row_number() over (partition by l.group_id, a.student_id order by l.sana desc) as rn
      from attendance a join lessons l on l.id = a.lesson_id
      where l.sana > v_bugun - 45
    ) a
    join lessons l on l.id = a.lesson_id
    where a.rn <= 3
    group by l.group_id, a.student_id
  ) x
  join groups g on g.id = x.group_id
  join students s on s.id = x.student_id
  join enrollments e on e.group_id = x.group_id and e.student_id = x.student_id and e.holat = 'faol'
  where x.n = 3 and x.hammasi_yoq and x.oxirgi >= v_bugun - 3
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- Lid qo'ng'irog'i va vazifa muddati o'tdi (1 soatdan ortiq)
  insert into nazorat_hodisalar (turi, sana, profile_id, lead_id, vazifa_id, tafsilot, kalit)
  select case when v.lead_id is not null then 'lid_qongiroq' else 'vazifa_muddati' end,
         (v.muddat at time zone 'Asia/Tashkent')::date, v.masul, v.lead_id, v.id,
         format('%s — muddati %s edi', v.nom, to_char(v.muddat at time zone 'Asia/Tashkent', 'DD/MM/YYYY HH24:MI')),
         'vaz:' || v.id
  from crm_vazifalar v
  where v.holat in ('yangi', 'jarayonda') and v.muddat < now() - interval '1 hour'
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- To'lov kech kiritildi (saytda, to'lov sanasidan 1 kundan ko'p keyin)
  insert into nazorat_hodisalar (turi, sana, profile_id, student_id, payment_id, tafsilot, kalit)
  select 'tolov_kech', (p.created_at at time zone 'Asia/Tashkent')::date, p.qabul_qildi, p.student_id, p.id,
         format('%s so''m · to''lov sanasi %s, kiritilgan %s', p.summa, to_char(p.sana, 'DD/MM/YYYY'),
                to_char(p.created_at at time zone 'Asia/Tashkent', 'DD/MM/YYYY HH24:MI')),
         'tolk:' || p.id
  from payments p
  where p.manba = 'crm' and not p.bekor
    and p.created_at > now() - interval '3 days'
    and (p.created_at at time zone 'Asia/Tashkent')::date - p.sana > 1
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- To'lov 2 kundan beri tasdiqlanmagan
  insert into nazorat_hodisalar (turi, sana, profile_id, student_id, payment_id, tafsilot, kalit)
  select 'tolov_tasdiqlanmadi', v_bugun, p.qabul_qildi, p.student_id, p.id,
         format('%s so''m · %s dan beri tasdiqlanmagan', p.summa, to_char(p.created_at at time zone 'Asia/Tashkent', 'DD/MM/YYYY')),
         'tast:' || p.id
  from payments p
  where p.manba = 'crm' and not p.bekor and not p.tasdiqlangan
    and p.created_at < now() - interval '2 days'
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- Oy oxiri (oxirgi kun 20:00 dan keyin): qarzdorga oy ichida eslatma qilinmadi
  if v_bugun = v_oxir and v_soat >= time '20:00' then
    insert into nazorat_hodisalar (turi, sana, student_id, tafsilot, kalit)
    select 'qarzdor_eslatilmadi', v_bugun, b.student_id,
           format('%s — qarz %s so''m, oy davomida "To''lov eslatish" bajarilmadi', b.fish, b.qarz),
           'qarz:' || b.student_id || ':' || v_davr
    from v_student_balance b
    join students s on s.id = b.student_id and s.holat = 'faol'
    where b.qarz > 0
      and not exists (
        select 1 from crm_vazifalar v
        where v.student_id = b.student_id and v.turi = 'tolov_eslatish' and v.holat = 'bajarildi'
          and to_char(v.bajarildi_at at time zone 'Asia/Tashkent', 'YYYY-MM') = v_davr)
    on conflict (kalit) do nothing;
    get diagnostics v_n = row_count; v_soni := v_soni + v_n;
  end if;

  return v_soni;
end;
$$;

-- probniy_belgila
CREATE OR REPLACE FUNCTION "public"."probniy_belgila"("p_group" "text", "p_sana" "date", "p_lead" "uuid", "p_holat" "public"."attendance_status") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_dars   uuid;
  v_kunlar smallint[];
begin
  if auth.uid() is not null and not (app_teaches_group(p_group) or app_is_admin()) then
    raise exception 'Bu guruhga davomat qo''yish huquqingiz yo''q.';
  end if;
  if p_sana > bugun_toshkent() then
    raise exception 'Kelasi kunga davomat qo''yib bo''lmaydi.';
  end if;
  if auth.uid() is not null and not app_is_admin() and p_sana < bugun_toshkent() then
    raise exception 'O''tgan kun davomatini faqat admin tuzatadi.';
  end if;
  if not exists (
    select 1 from leads
    where id = p_lead and group_id = p_group and student_id is null
      and holat in ('yangi', 'qongiroq', 'keldi')
  ) then
    raise exception 'Probniy bu guruhda emas.';
  end if;

  select kunlar into v_kunlar from groups where id = p_group;
  select id into v_dars from lessons where group_id = p_group and sana = p_sana;
  if v_dars is null and not guruh_dars_kunimi(guruh_kunlari(p_group, p_sana), p_sana) then
    raise exception 'Bu kun guruhning dars kuni emas.';
  end if;
  if v_dars is null then
    insert into lessons (group_id, sana, otkazildi) values (p_group, p_sana, true)
    on conflict (group_id, sana) do update set otkazildi = true
    returning id into v_dars;
  end if;

  if p_holat is null then
    delete from probniy_davomat where lesson_id = v_dars and lead_id = p_lead;
  else
    insert into probniy_davomat (lesson_id, lead_id, holat, belgiladi)
    values (v_dars, p_lead, p_holat, auth.uid())
    on conflict (lesson_id, lead_id) do update
      set holat = excluded.holat, belgiladi = excluded.belgiladi, updated_at = now();
    -- Darsga kelgan probniy "keldi" holatiga o'tadi (probniylar ro'yxatida ko'rinadi)
    if p_holat = 'keldi' then
      update leads set holat = 'keldi' where id = p_lead and holat in ('yangi', 'qongiroq');
    end if;
  end if;
end;
$$;

-- tushum_hisobot_ichki
CREATE OR REPLACE FUNCTION "public"."tushum_hisobot_ichki"("p_dan" "date", "p_gacha" "date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with t as (
    select p.sana, p.summa, p.usul, p.student_id, p.tasdiqlangan,
           coalesce(tc.ism, '—') as ustoz,
           coalesce(s.nom, '—')  as yonalish
    from payments p
    left join enrollments e on e.id = p.enrollment_id
    left join groups g      on g.id = e.group_id
    left join teachers tc   on tc.id = g.teacher_id
    left join subjects s    on s.id = g.subject_id
    where not p.bekor and p.sana between p_dan and p_gacha
  ),
  d as (
    select a.holat::text as holat
    from attendance a join lessons l on l.id = a.lesson_id
    where l.sana between p_dan and p_gacha
  ),
  kutilgan as (
    select g.id as group_id, g.nom, coalesce(tc.ism, '—') as ustoz, k.sana::date as sana
    from groups g
    left join teachers tc on tc.id = g.teacher_id
    cross join generate_series(p_dan::timestamp, least(p_gacha, bugun_toshkent())::timestamp, interval '1 day') k(sana)
    where g.holat = 'faol'
      and guruh_dars_kunimi(g.kunlar, k.sana::date)
      and exists (
        select 1 from enrollments e
        where e.group_id = g.id and e.boshlandi <= k.sana::date
          and (e.tugadi is null or e.tugadi >= k.sana::date)
      )
  ),
  qilinmagan as (
    select k.* from kutilgan k
    where not exists (
      select 1 from lessons l
      where l.group_id = k.group_id and l.sana = k.sana
        and (l.otkazildi or exists (select 1 from attendance a where a.lesson_id = l.id))
    )
  ),
  pr as (
    select holat::text as holat
    from leads
    where (created_at at time zone 'Asia/Tashkent')::date between p_dan and p_gacha
  )
  select jsonb_build_object(
    'tushum',          (select coalesce(sum(summa), 0) from t),
    'soni',            (select count(*) from t),
    'odam',            (select count(distinct student_id) from t),
    'tasdiqlanmagan',  (select coalesce(sum(summa), 0) from t where not tasdiqlangan),
    'usul', coalesce((
      select jsonb_agg(x order by x.summa desc)
      from (select coalesce(usul::text, 'aniqlanmagan') as nom, sum(summa) as summa, count(*) as soni
            from t group by 1) x), '[]'::jsonb),
    'ustoz', coalesce((
      select jsonb_agg(x order by x.summa desc)
      from (select ustoz as nom, sum(summa) as summa, count(*) as soni from t group by 1) x), '[]'::jsonb),
    'yonalish', coalesce((
      select jsonb_agg(x order by x.summa desc)
      from (select yonalish as nom, sum(summa) as summa, count(*) as soni from t group by 1) x), '[]'::jsonb),
    'kunlar', coalesce((
      select jsonb_agg(x order by x.sana)
      from (select sana, sum(summa) as summa, count(*) as soni from t group by sana) x), '[]'::jsonb),
    'davomat', jsonb_build_object(
      'belgilar', (select count(*) from d),
      'kelgan',   (select count(*) from d where holat = 'keldi'),
      'kelmadi',  (select count(*) from d where holat = 'kelmadi')
    ),
    'darslar', jsonb_build_object(
      'kutilgan',   (select count(*) from kutilgan),
      'qilinmagan', (select count(*) from qilinmagan)
    ),
    'qilinmagan', coalesce((
      select jsonb_agg(x)
      from (select ustoz, nom, sana from qilinmagan order by ustoz, sana limit 80) x), '[]'::jsonb),
    'probniy', jsonb_build_object(
      'jami',       (select count(*) from pr),
      'kutilmoqda', (select count(*) from pr where holat in ('yangi', 'qongiroq', 'keldi')),
      'yozildi',    (select count(*) from pr where holat = 'yozildi'),
      'kelmadi',    (select count(*) from pr where holat = 'kelmadi'),
      'rad',        (select count(*) from pr where holat = 'rad')
    )
  )
$$;

-- tushum_hisobot_rls
CREATE OR REPLACE FUNCTION "public"."tushum_hisobot_rls"("p_dan" "date", "p_gacha" "date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  with t as (
    select p.sana, p.summa, p.usul, p.student_id, p.tasdiqlangan,
           coalesce(tc.ism, '—') as ustoz,
           coalesce(s.nom, '—')  as yonalish
    from payments p
    left join enrollments e on e.id = p.enrollment_id
    left join groups g      on g.id = e.group_id
    left join teachers tc   on tc.id = g.teacher_id
    left join subjects s    on s.id = g.subject_id
    where not p.bekor and p.sana between p_dan and p_gacha
  ),
  d as (
    select a.holat::text as holat
    from attendance a join lessons l on l.id = a.lesson_id
    where l.sana between p_dan and p_gacha
  ),
  kutilgan as (
    select g.id as group_id, g.nom, coalesce(tc.ism, '—') as ustoz, k.sana::date as sana
    from groups g
    left join teachers tc on tc.id = g.teacher_id
    cross join generate_series(p_dan::timestamp, least(p_gacha, bugun_toshkent())::timestamp, interval '1 day') k(sana)
    where g.holat = 'faol'
      and guruh_dars_kunimi(guruh_kunlari(g.id, k.sana::date), k.sana::date)
      and exists (
        select 1 from enrollments e
        where e.group_id = g.id and e.boshlandi <= k.sana::date
          and (e.tugadi is null or e.tugadi >= k.sana::date)
      )
  ),
  qilinmagan as (
    select k.* from kutilgan k
    where not exists (
      select 1 from lessons l
      where l.group_id = k.group_id and l.sana = k.sana
        and (l.otkazildi or exists (select 1 from attendance a where a.lesson_id = l.id))
    )
  ),
  pr as (
    select holat::text as holat
    from leads
    where holat <> 'xato' and (created_at at time zone 'Asia/Tashkent')::date between p_dan and p_gacha
  )
  select jsonb_build_object(
    'tushum',          (select coalesce(sum(summa), 0) from t),
    'soni',            (select count(*) from t),
    'odam',            (select count(distinct student_id) from t),
    'tasdiqlanmagan',  (select coalesce(sum(summa), 0) from t where not tasdiqlangan),
    'usul', coalesce((
      select jsonb_agg(x order by x.summa desc)
      from (select coalesce(usul::text, 'aniqlanmagan') as nom, sum(summa) as summa, count(*) as soni
            from t group by 1) x), '[]'::jsonb),
    'ustoz', coalesce((
      select jsonb_agg(x order by x.summa desc)
      from (select ustoz as nom, sum(summa) as summa, count(*) as soni from t group by 1) x), '[]'::jsonb),
    'yonalish', coalesce((
      select jsonb_agg(x order by x.summa desc)
      from (select yonalish as nom, sum(summa) as summa, count(*) as soni from t group by 1) x), '[]'::jsonb),
    'kunlar', coalesce((
      select jsonb_agg(x order by x.sana)
      from (select sana, sum(summa) as summa, count(*) as soni from t group by sana) x), '[]'::jsonb),
    'davomat', jsonb_build_object(
      'belgilar', (select count(*) from d),
      'kelgan',   (select count(*) from d where holat = 'keldi'),
      'kelmadi',  (select count(*) from d where holat = 'kelmadi')
    ),
    'darslar', jsonb_build_object(
      'kutilgan',   (select count(*) from kutilgan),
      'qilinmagan', (select count(*) from qilinmagan)
    ),
    'qilinmagan', coalesce((
      select jsonb_agg(x)
      from (select ustoz, nom, sana from qilinmagan order by ustoz, sana limit 80) x), '[]'::jsonb),
    'probniy', jsonb_build_object(
      'jami',       (select count(*) from pr),
      'kutilmoqda', (select count(*) from pr where holat in ('yangi', 'qongiroq', 'keldi')),
      'yozildi',    (select count(*) from pr where holat = 'yozildi'),
      'kelmadi',    (select count(*) from pr where holat = 'kelmadi'),
      'rad',        (select count(*) from pr where holat = 'rad')
    )
  )
$$;

revoke execute on function probniy_belgila(text, date, uuid, attendance_status) from public, anon;
grant  execute on function probniy_belgila(text, date, uuid, attendance_status) to authenticated, service_role;

drop type attendance_status_eski;

-- ------------------------------------------------------------
-- 4. v_attendance_monthly — kelgan = faqat 'keldi'
-- ------------------------------------------------------------
create view v_attendance_monthly with (security_invoker = on) as
select a.student_id,
       to_char(l.sana, 'YYYY-MM') as davr,
       l.group_id,
       count(*) as darslar,
       count(*) filter (where a.holat = 'keldi') as kelgan,
       round(100.0 * count(*) filter (where a.holat = 'keldi') / nullif(count(*), 0))::int as foiz
from attendance a
join lessons l on l.id = a.lesson_id
where l.sana <= bugun_toshkent()
group by a.student_id, to_char(l.sana, 'YYYY-MM'), l.group_id;

grant select on v_attendance_monthly to authenticated, service_role;

-- ------------------------------------------------------------
-- 5. lessons.davomat_vaqti
-- ------------------------------------------------------------
alter table lessons add column if not exists davomat_vaqti timestamptz;

comment on column lessons.davomat_vaqti is
  'Davomat birinchi marta to''liq bo''lgan vaqt (0137). Bir marta yoziladi. NULL — hali to''liq emas.';

create or replace function davomat_vaqti_yoz() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_l record;
  v_h record;
begin
  select l.id, l.group_id, l.sana, l.davomat_vaqti into v_l from lessons l where l.id = new.lesson_id;
  if v_l.id is null or v_l.davomat_vaqti is not null then return null; end if;

  select * into v_h from davomat_holati(v_l.group_id, v_l.sana);
  if v_h.jami > 0 and v_h.belgilangan >= v_h.jami then
    update lessons set davomat_vaqti = now() where id = v_l.id and davomat_vaqti is null;
  end if;
  return null;
end;
$$;

revoke execute on function davomat_vaqti_yoz() from public, anon, authenticated;

drop trigger if exists attendance_davomat_vaqti on attendance;
create trigger attendance_davomat_vaqti
  after insert or update on attendance
  for each row execute function davomat_vaqti_yoz();

-- Eski darslar: hozir to'liq bo'lsa — oxirgi belgi qo'yilgan vaqt
update lessons l
   set davomat_vaqti = x.oxirgi
  from (select a.lesson_id, max(a.created_at) as oxirgi from attendance a group by a.lesson_id) x
 where x.lesson_id = l.id
   and l.davomat_vaqti is null
   and exists (select 1 from davomat_holati(l.group_id, l.sana) h
               where h.jami > 0 and h.belgilangan >= h.jami);

comment on function hisobot_davomat(date, date) is
  'Davomat hisoboti: darslar (reja/o''tildi), kutilgan belgilar (dars kuni × guruhdagi o''quvchi) — keldi/kelmadi/belgilanmagan, guruhlar, haftalar. RLS amal qiladi.';
