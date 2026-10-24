-- ============================================================
--  0091 — Hisobotlar › Moliya: fan bo'yicha O'RTACHA TO'LOV (Jamshid, 24.10)
-- ============================================================
--  O'rtacha = oy UCHUN tushgan to'lovlar ÷ shu oyda o'qigan FANLAR soni.
--    · fan = (o'quvchi, fan) jufti: 2 fanda o'qigan bola — 2 fan;
--      oy ichida guruh almashtirgani — baribir 1 fan;
--    · oyning kamida bir kunida o'qigan har kim sanaladi (5 yoki 20 kun
--      o'qib ketgan ham) — uning to'lagani tushumga, o'zi fanlar soniga;
--    · shu oy uchun to'lagan, lekin yozilishi o'sha oyda ko'rinmayotgan
--      juft ham fanlar soniga qo'shiladi (sana xato kiritilgan bo'lsa ham
--      pul "egasiz" qolmasin);
--    · fani yo'q guruh — guruhning o'zi alohida "fan" sanaladi.
--  Har so'rovda bazadan hisoblanadi — to'lov, yangi o'quvchi, ketish darhol aks etadi.
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
  fan_oy as (
    select j.davr, j.fan, coalesce(s.nom, 'Fani belgilanmagan') as nom,
           count(*) as soni,
           coalesce((select sum(t.summa) from tolov t where t.davr = j.davr and t.fan = j.fan), 0) as tushum
    from juft j left join subjects s on s.id = j.subject_id
    group by j.davr, j.fan, s.nom
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'davr',    c.davr,
    'tushum',  coalesce((select sum(summa) from tolov t where t.davr = c.davr), 0),
    'fan',     (select count(*) from juft j where j.davr = c.davr),
    'vip_fan', (select count(*) from juft j where j.davr = c.davr and j.vip),
    'bola',    (select count(distinct student_id) from juft j where j.davr = c.davr),
    'fanlar',  coalesce((
      select jsonb_agg(jsonb_build_object('nom', f.nom, 'soni', f.soni, 'tushum', f.tushum) order by f.tushum desc)
      from fan_oy f where f.davr = c.davr), '[]'::jsonb)
  ) order by c.davr), '[]'::jsonb)
  from chegara c
$$;
revoke execute on function hisobot_ortacha_tolov_ichki(int) from public, anon, authenticated;

create or replace function hisobot_ortacha_tolov(p_oylar int default 6) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_staff() then
    raise exception 'Hisobot faqat xodimlar uchun.';
  end if;
  return hisobot_ortacha_tolov_ichki(p_oylar);
end;
$$;
revoke execute on function hisobot_ortacha_tolov(int) from public, anon;
grant execute on function hisobot_ortacha_tolov(int) to authenticated;
