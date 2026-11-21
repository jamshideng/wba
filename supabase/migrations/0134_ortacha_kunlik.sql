-- ============================================================
--  0134 — Hisobotlar › Moliya: O'RTACHA TO'LOV yangi formula (Jamshid, 21.11)
-- ============================================================
--  Oy uchun:
--    x = yakshanbadan tashqari har kuni kun oxiridagi RASMIY fanlar (enrollment) soni yig'indisi
--    y = oydagi yakshanbasiz kunlar soni (joriy oyda — bugungacha, Toshkent vaqti)
--    a = x / y            (oydagi o'rtacha fanlar soni)
--    z = oy uchun tushum
--    o'rtacha to'lov = z / a
--  Rasmiy (kun D da) = boshlandi <= D va (tugadi bo'sh yoki tugadi > D).
--  Eski 'fan' (oyda kamida bir kun o'qigan) saqlandi — ro'yxat havolalari uchun;
--  yangi kalitlar: orta_fan, orta_vip, kunlar, fanlar[].orta.
-- ============================================================

create or replace function hisobot_ortacha_tolov_ichki(p_oylar int default 6)
returns jsonb
language sql stable security definer set search_path = public as $$
  with chegara as (
    select d as davr,
           to_date(d || '-01', 'YYYY-MM-DD') as bosh,
           (to_date(d || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date as oxir
    from hisobot_davrlar(p_oylar) d
  ),
  faol as (
    select c.davr, e.student_id, coalesce(g.subject_id, 'guruh:' || g.id) as fan, g.subject_id, e.vip
    from chegara c
    join enrollments e on e.boshlandi <= c.oxir and coalesce(e.tugadi, 'infinity'::date) >= c.bosh
    join groups g on g.id = e.group_id
  ),
  tolov as (
    select p.davr, p.summa, e.student_id,
           case when e.id is null then null else coalesce(g.subject_id, 'guruh:' || g.id) end as fan,
           g.subject_id
    from payments p
    left join enrollments e on e.id = p.enrollment_id
    left join groups g on g.id = e.group_id
    where not p.bekor and p.davr in (select davr from chegara)
  ),
  juft as (
    select davr, student_id, fan, subject_id, bool_or(vip) as vip
    from (
      select davr, student_id, fan, subject_id, vip from faol
      union all
      select davr, student_id, fan, subject_id, false from tolov where fan is not null
    ) x
    group by davr, student_id, fan, subject_id
  ),
  -- yakshanbasiz kunlar (joriy oyda bugungacha)
  kun as (
    select c.davr, gs::date as kun
    from chegara c,
         generate_series(c.bosh, least(c.oxir, (now() at time zone 'Asia/Tashkent')::date), interval '1 day') gs
    where extract(dow from gs) <> 0
  ),
  oy_kun as (select davr, count(*) as y from kun group by davr),
  -- har kun oxiridagi rasmiy fanlar
  rasmiy as (
    select k.davr, k.kun, e.id as enr, coalesce(g.subject_id, 'guruh:' || g.id) as fan, e.vip
    from kun k
    join enrollments e on e.boshlandi <= k.kun and coalesce(e.tugadi, 'infinity'::date) > k.kun
    join groups g on g.id = e.group_id
  ),
  fan_oy as (
    select j.davr, j.fan, coalesce(s.nom, 'Fani belgilanmagan') as nom,
           count(*) as soni,
           coalesce((select sum(t.summa) from tolov t where t.davr = j.davr and t.fan = j.fan), 0) as tushum,
           round((select count(*) from rasmiy r where r.davr = j.davr and r.fan = j.fan)::numeric
                 / nullif((select y from oy_kun o where o.davr = j.davr), 0), 2) as orta
    from juft j left join subjects s on s.id = j.subject_id
    group by j.davr, j.fan, s.nom
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'davr',    c.davr,
    'tushum',  coalesce((select sum(summa) from tolov t where t.davr = c.davr), 0),
    'fan',     (select count(*) from juft j where j.davr = c.davr),
    'vip_fan', (select count(*) from juft j where j.davr = c.davr and j.vip),
    'bola',    (select count(distinct student_id) from juft j where j.davr = c.davr),
    'kunlar',  coalesce((select y from oy_kun o where o.davr = c.davr), 0),
    'orta_fan', coalesce(round((select count(*) from rasmiy r where r.davr = c.davr)::numeric
                 / nullif((select y from oy_kun o where o.davr = c.davr), 0), 2), 0),
    'orta_vip', coalesce(round((select count(*) from rasmiy r where r.davr = c.davr and r.vip)::numeric
                 / nullif((select y from oy_kun o where o.davr = c.davr), 0), 2), 0),
    'fanlar',  coalesce((
      select jsonb_agg(jsonb_build_object('nom', f.nom, 'soni', f.soni, 'tushum', f.tushum, 'orta', coalesce(f.orta, 0)) order by f.tushum desc)
      from fan_oy f where f.davr = c.davr), '[]'::jsonb)
  ) order by c.davr), '[]'::jsonb)
  from chegara c
$$;
revoke execute on function hisobot_ortacha_tolov_ichki(int) from public, anon, authenticated;
