-- ============================================================
-- 0145 — maosh: 12+ dars = to'liq oy (Jamshid, 25.11)
--
-- O'quvchining oydagi hisobga kirgan darslari (hamma ustozlarda jami)
-- kamida 12 bo'lsa — to'liq oy: o'quvchi uchun jami to'liq stavka beriladi.
--   bo'luvchi = shu jami (oydagi darslar soni N emas);
--   har ustoz = stavka × o'z darslari ÷ jami (zamena bo'lsa ulush bo'linadi,
--   jami stavkadan oshmaydi).
-- 12 dan kam bo'lsa — avvalgidek: stavka ÷ N × hisobga kirgan darslar.
-- Misol: oktabr, guruhda 14 dars, o'quvchi 13 tasida (kech kelgan) →
--   204 286 emas, 220 000.
-- ============================================================

do $$
declare
  v_def text := pg_get_functiondef('maosh_qatorlari(text)'::regprocedure);
  v_joy text := 'round(gs.stavka * count(*) filter (where not s.ayir) / nn.n)';
  v_jami text := 'sum(count(*) filter (where not s.ayir)) over (partition by s.eid)';
begin
  if v_def like '%0145: 12+ dars%' then
    return;
  end if;
  if position(v_joy in v_def) = 0 then
    raise exception '0145: maosh_qatorlari kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_joy,
    '/* 0145: 12+ dars — to''liq oy */ round(gs.stavka * count(*) filter (where not s.ayir) / '
    || 'case when ' || v_jami || ' >= 12 then ' || v_jami || ' else nn.n end)');
end $$;
