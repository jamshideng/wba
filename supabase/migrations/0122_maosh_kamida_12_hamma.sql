-- ============================================================
-- 0122 — maosh: N kamida 12 hamma guruhga (Jamshid, 08.11)
--
-- 0111 da haftada 2 kunlik guruhlarga N = oydagi jadval darslari (8–9)
-- qilingan edi — noto'g'ri. Qoida hamma guruhga bitta:
--   o'quvchi uchun = stavka ÷ N × hisobga olinadigan darslar,
--   N = oydagi darslar, KAMIDA 12 (0075).
-- "12 dan kam dars" eslatmasi 2 kunlik guruhlarga avvalgidek chiqmaydi.
-- ============================================================

do $$
declare
  v_def text := pg_get_functiondef('maosh_qatorlari(text)'::regprocedure);
  v_joy text := 'greatest(case when cardinality(guruh_kunlari(g.id, oy.oxir)) <= 2 then guruh_oy_darslari(g.id, p_davr) else 12 end,';
begin
  if position(v_joy in v_def) = 0 then
    raise exception '0122: maosh_qatorlari kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_joy, 'greatest(12,');
end $$;
