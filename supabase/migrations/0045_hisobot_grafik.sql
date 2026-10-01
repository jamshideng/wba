-- ============================================================
--  0045 — Hisobotlar: grafiklar uchun kunlik qatorlar va trend
--
--  LevelUp "Отчёты" sahifasi uslubida: har ko'rsatkich kartasida kichik
--  grafik (sparkline) va o'tgan xuddi shunday davrga nisbatan o'zgarish %.
--
--  hisobot_grafik(dan, gacha):
--    kunlar[]   — har kun: tushum, davomat belgisi/kelgan, yangi yozilish
--    joriy{}    — oraliq jami
--    oldingi{}  — undan oldingi XUDDI SHUNCHA kunlik oraliq jami (trend uchun)
--    guruhlar[] — tushum bo'yicha eng yaxshi 8 guruh
--    qarzdorlar — hozir qarzi bor o'quvchilar soni
--  security invoker — RLS ishlaydi.
-- ============================================================

create or replace function hisobot_grafik(p_dan date, p_gacha date)
returns jsonb
language sql stable security invoker set search_path = public as $$
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
      (select count(*) from bel, oraliq o where sana between o.dan and o.gacha and holat in ('keldi','kechikdi')) as kelgan,
      (select count(*) from yoz, oraliq o where sana between o.dan and o.gacha)                               as yangi,
      (select coalesce(sum(summa), 0) from tol, oraliq o where sana between o.odan and o.ogacha)              as o_tushum,
      (select count(*) from bel, oraliq o where sana between o.odan and o.ogacha)                             as o_belgi,
      (select count(*) from bel, oraliq o where sana between o.odan and o.ogacha and holat in ('keldi','kechikdi')) as o_kelgan,
      (select count(*) from yoz, oraliq o where sana between o.odan and o.ogacha)                             as o_yangi
  )
  select jsonb_build_object(
    'kunlar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sana', k.sana,
        'tushum', coalesce((select sum(summa) from tol where tol.sana = k.sana), 0),
        'belgi', (select count(*) from bel where bel.sana = k.sana),
        'kelgan', (select count(*) from bel where bel.sana = k.sana and holat in ('keldi','kechikdi')),
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

revoke execute on function hisobot_grafik(date, date) from public, anon;
grant execute on function hisobot_grafik(date, date) to authenticated;
