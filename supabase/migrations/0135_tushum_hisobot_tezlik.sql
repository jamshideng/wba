-- ============================================================
--  0135 — tushum_hisobot tezligi (21.11)
--
--  tushum_hisobot() security invoker edi: payments, attendance, lessons,
--  leads qatorlarining HAR BIRIDA RLS siyosatlari qayta hisoblanardi
--  (0049 da hisobot_* uchun topilgan xuddi shu sabab; bu funksiya o'sha
--  yerda qolib ketgan edi). Dashboard va "Hisobotlar" sahifalari uni
--  chaqiradi — eng sekin sahifalar.
--
--  Endi (0049 bilan bir xil naqsh), natija O'ZGARMAYDI:
--    · xodim (admin/qabulxona) yoki service_role  → tezkor ichki funksiya
--      (egasi huquqi bilan, RLS'siz; hech kimga to'g'ridan-to'g'ri ochiq emas)
--    · boshqa rollar → avvalgidek RLS bilan (tushum_hisobot_rls)
--  Hisobot mazmuni va imzosi bir xil: chaqiruvchi kod o'zgarmaydi.
-- ============================================================

-- 1) Eski (invoker) funksiya — boshqa rollar uchun o'zgarmay qoladi
alter function tushum_hisobot(date, date) rename to tushum_hisobot_rls;
revoke execute on function tushum_hisobot_rls(date, date) from public, anon, authenticated;

-- 2) Tezkor ichki nusxa: matni bir xil, faqat security definer
create or replace function tushum_hisobot_ichki(p_dan date, p_gacha date)
returns jsonb
language sql stable security definer set search_path = public as $$
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
      'kelgan',   (select count(*) from d where holat in ('keldi', 'kechikdi')),
      'kelmadi',  (select count(*) from d where holat = 'kelmadi'),
      'sababli',  (select count(*) from d where holat = 'sababli')
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

revoke execute on function tushum_hisobot_ichki(date, date) from public, anon, authenticated;

-- 3) Tashqi funksiya: kim chaqirayotganiga qarab yo'l tanlaydi
create or replace function tushum_hisobot(p_dan date, p_gacha date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if app_is_staff() or coalesce(auth.role(), '') = 'service_role' then
    return tushum_hisobot_ichki(p_dan, p_gacha);
  end if;
  return tushum_hisobot_rls(p_dan, p_gacha);
end;
$$;

revoke execute on function tushum_hisobot(date, date) from public, anon;
grant  execute on function tushum_hisobot(date, date) to authenticated, service_role;
