-- ============================================================
--  0044 — Hisobotlar: Moliya, O'quvchilar, Ustozlar, Davomat
--
--  Hisob bazada (loyiha qoidasi). Hammasi `security invoker` — RLS
--  ishlaydi: xodim hammasini, boshqalar o'zinikidan boshqasini ko'rmaydi.
--  Har biri bitta jsonb qaytaradi — sahifa bitta so'rov bilan chiziladi.
-- ============================================================


-- ------------------------------------------------------------
-- Yordamchi: "2026-10" dan n oy oldingi davrlar ro'yxati (eskisidan yangisiga)
-- ------------------------------------------------------------
create or replace function hisobot_davrlar(p_oylar int) returns setof text
language sql stable security invoker set search_path = public as $$
  select to_char(date_trunc('month', bugun_toshkent()) - make_interval(months => n), 'YYYY-MM')
  from generate_series(greatest(least(p_oylar, 24), 1) - 1, 0, -1) n
$$;


-- ------------------------------------------------------------
-- 1. MOLIYA
--   oylar: hisoblangan (to'lashi kerak), chegirma, VIP, tuzatish,
--          yig'ilgan (shu oy UCHUN to'langan), yig'ilish %
--   qarz_oylar: qarz qaysi oylardan qolgan — to'lov eng eski oyni
--          birinchi yopadi (FIFO), yozilish bo'yicha
--   jami: qarz, oldindan to'langan, keyingi oy kutilgan tushum
-- ------------------------------------------------------------
create or replace function hisobot_moliya(p_oylar int default 6)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with davrlar as (select hisobot_davrlar(p_oylar) as davr),
  inv as (
    select i.enrollment_id, i.davr, i.summa, i.chegirma, i.tuzatish,
           vip_oymi(i.enrollment_id, i.davr) as vip
    from invoices i
    where i.holat <> 'bekor'
  ),
  tol as (
    select p.enrollment_id, p.davr, p.summa
    from payments p where not p.bekor
  ),
  oylar as (
    select d.davr,
      coalesce((select sum(summa) from inv where inv.davr = d.davr), 0)                       as hisoblangan,
      coalesce((select sum(chegirma) from inv where inv.davr = d.davr and not vip), 0)        as chegirma,
      coalesce((select sum(chegirma) from inv where inv.davr = d.davr and vip), 0)            as vip,
      coalesce((select sum(tuzatish) from inv where inv.davr = d.davr), 0)                    as tuzatish,
      coalesce((select sum(summa) from tol where tol.davr = d.davr), 0)                       as yigilgan,
      coalesce((select count(distinct enrollment_id) from inv where inv.davr = d.davr), 0)    as yozilish
    from davrlar d
  ),
  -- FIFO: yozilishning jami to'lovi eng eski hisob-fakturalarni birinchi yopadi
  yoz_tolov as (
    select enrollment_id, sum(summa) as tolangan from tol where enrollment_id is not null group by 1
  ),
  inv_tartib as (
    select inv.enrollment_id, inv.davr, inv.summa,
           sum(inv.summa) over (partition by inv.enrollment_id order by inv.davr) as yigma
    from inv
  ),
  qolgan as (
    select it.davr,
           greatest(0, least(it.summa, it.yigma - coalesce(yt.tolangan, 0))) as qarz
    from inv_tartib it left join yoz_tolov yt on yt.enrollment_id = it.enrollment_id
  ),
  yoz_qarz as (
    select e.id,
           coalesce((select sum(summa) from inv where inv.enrollment_id = e.id), 0)
         - coalesce((select tolangan from yoz_tolov where enrollment_id = e.id), 0) as qarz
    from enrollments e
  )
  select jsonb_build_object(
    'oylar', coalesce((select jsonb_agg(to_jsonb(o) order by o.davr) from oylar o), '[]'::jsonb),
    'qarz_oylar', coalesce((
      select jsonb_agg(jsonb_build_object('davr', davr, 'qarz', qarz) order by davr)
      from (select davr, sum(qarz) as qarz from qolgan group by davr having sum(qarz) > 0) q
    ), '[]'::jsonb),
    'qarz', coalesce((select sum(qarz) from yoz_qarz where qarz > 0), 0),
    'qarzdor_yozilish', (select count(*) from yoz_qarz where qarz > 0),
    'oldindan', coalesce((select -sum(qarz) from yoz_qarz where qarz < 0), 0),
    'keyingi_davr', to_char((date_trunc('month', bugun_toshkent()) + interval '1 month')::date, 'YYYY-MM'),
    'keyingi_kutilgan', coalesce((
      select sum(keyingi_oy_summasi(e.id))
      from enrollments e join students s on s.id = e.student_id
      where e.holat = 'faol' and s.holat = 'faol'
    ), 0),
    'boglanmagan_tolov', coalesce((select sum(summa) from tol where enrollment_id is null), 0)
  )
$$;


-- ------------------------------------------------------------
-- 2. O'QUVCHILAR OQIMI
--   oylar: yangi bola / yangi yozilish, ketgan bola / tugagan yozilish,
--          oy oxirida faol (bola va fan bo'yicha), probniy → doimiy
--   fanlar: hozirgi faol yozilishlar fan bo'yicha
-- ------------------------------------------------------------
create or replace function hisobot_oquvchilar(p_oylar int default 6)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with davrlar as (
    select davr,
           to_date(davr || '-01', 'YYYY-MM-DD') as boshi,
           least((to_date(davr || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date, bugun_toshkent()) as oxiri
    from hisobot_davrlar(p_oylar) davr
  ),
  birinchi as (
    select student_id, min(boshlandi) as boshlandi from enrollments group by 1
  ),
  oylar as (
    select d.davr,
      (select count(*) from birinchi b where b.boshlandi between d.boshi and d.oxiri)              as yangi_bola,
      (select count(*) from enrollments e where e.boshlandi between d.boshi and d.oxiri)          as yangi_fan,
      (select count(*) from students s where s.arxiv_sana between d.boshi and d.oxiri)           as ketgan_bola,
      (select count(*) from enrollments e where e.tugadi between d.boshi and d.oxiri)            as tugagan_fan,
      (select count(distinct e.student_id) from enrollments e
        where e.boshlandi <= d.oxiri and (e.tugadi is null or e.tugadi >= d.oxiri)
          and e.holat <> 'tanaffus')                                                             as faol_bola,
      (select count(*) from enrollments e
        where e.boshlandi <= d.oxiri and (e.tugadi is null or e.tugadi >= d.oxiri)
          and e.holat <> 'tanaffus')                                                             as faol_fan,
      (select count(*) from leads l where l.created_at::date between d.boshi and d.oxiri)        as probniy,
      (select count(*) from leads l where l.created_at::date between d.boshi and d.oxiri
                                       and l.holat = 'yozildi')                                  as probniy_yozildi
    from davrlar d
  ),
  fanlar as (
    select coalesce(sb.nom, 'Boshqa') as fan,
           count(*) as yozilish,
           count(distinct e.student_id) as bola,
           count(distinct g.id) as guruh
    from enrollments e
    join students s on s.id = e.student_id and s.holat = 'faol'
    join groups g on g.id = e.group_id
    left join subjects sb on sb.id = g.subject_id
    where e.holat = 'faol'
    group by 1
  )
  select jsonb_build_object(
    'oylar', coalesce((select jsonb_agg(to_jsonb(o) order by o.davr) from oylar o), '[]'::jsonb),
    'fanlar', coalesce((select jsonb_agg(to_jsonb(f) order by f.yozilish desc) from fanlar f), '[]'::jsonb),
    'faol_bola', (select count(distinct e.student_id) from enrollments e join students s on s.id = e.student_id
                  where e.holat = 'faol' and s.holat = 'faol'),
    'faol_fan', (select count(*) from enrollments e join students s on s.id = e.student_id
                 where e.holat = 'faol' and s.holat = 'faol'),
    'ikki_fanli', (select count(*) from (
                    select e.student_id from enrollments e join students s on s.id = e.student_id
                    where e.holat = 'faol' and s.holat = 'faol' group by 1 having count(*) > 1) x),
    'vip', (select count(*) from enrollments e where e.holat = 'faol' and e.vip),
    'arxiv', (select count(*) from students where holat = 'ketgan')
  )
$$;


-- ------------------------------------------------------------
-- 3. USTOZLAR — solishtirma jadval (oraliq bo'yicha)
-- ------------------------------------------------------------
create or replace function hisobot_ustozlar(p_dan date, p_gacha date)
returns jsonb
language sql stable security invoker set search_path = public as $$
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
          and a.holat in ('keldi', 'kechikdi')) as kelgan,
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


-- ------------------------------------------------------------
-- 4. DAVOMAT — haftalik trend, guruhlar (to'lishi, %), ko'p qoldiruvchilar
-- ------------------------------------------------------------
create or replace function hisobot_davomat(p_dan date, p_gacha date)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with b as (
    select a.student_id, a.holat::text as holat, l.sana, l.group_id
    from attendance a join lessons l on l.id = a.lesson_id
    where l.sana between p_dan and p_gacha
  ),
  hafta as (
    select date_trunc('week', sana)::date as hafta,
           count(*) as belgi,
           count(*) filter (where holat in ('keldi', 'kechikdi')) as kelgan
    from b group by 1
  ),
  guruh as (
    select g.id, g.nom, coalesce(t.ism, '—') as ustoz,
      (select count(*) from enrollments e where e.group_id = g.id and e.holat = 'faol') as oquvchi,
      (select count(*) from b where b.group_id = g.id) as belgi,
      (select count(*) from b where b.group_id = g.id and b.holat in ('keldi', 'kechikdi')) as kelgan
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
    'jami_kelgan', (select count(*) from b where holat in ('keldi', 'kechikdi')),
    'haftalar', coalesce((select jsonb_agg(to_jsonb(h) order by h.hafta) from hafta h), '[]'::jsonb),
    'guruhlar', coalesce((select jsonb_agg(to_jsonb(g) order by g.oquvchi desc, g.nom) from guruh g), '[]'::jsonb),
    'qoldiruvchilar', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.kelmadi desc, q.fish)
      from (select * from qoldiruvchi order by kelmadi desc, fish limit 20) q
    ), '[]'::jsonb)
  )
$$;


-- Faqat kirgan foydalanuvchiga (RLS baribir ishlaydi)
revoke execute on function hisobot_davrlar(int) from public, anon;
revoke execute on function hisobot_moliya(int) from public, anon;
revoke execute on function hisobot_oquvchilar(int) from public, anon;
revoke execute on function hisobot_ustozlar(date, date) from public, anon;
revoke execute on function hisobot_davomat(date, date) from public, anon;
grant execute on function hisobot_davrlar(int) to authenticated;
grant execute on function hisobot_moliya(int) to authenticated;
grant execute on function hisobot_oquvchilar(int) to authenticated;
grant execute on function hisobot_ustozlar(date, date) to authenticated;
grant execute on function hisobot_davomat(date, date) to authenticated;
