-- ============================================================
-- 0111 — haftada 2 kun va kam o'qiydigan guruhlar maoshi (Jamshid, 01.11)
--
-- Formula o'sha: stavka ÷ N × hisobga olinadigan darslar. Bu guruhlarda
-- N = oydagi jadval darslari, "kamida 12" amal qilmaydi. O'tgan oy uchun ham
-- jadval olinadi: o'tilmagan dars maoshni kamaytiradi. "12 dan kam dars"
-- eslatmasi ham ularga chiqmaydi. Haftada 3 va ko'p kunlik guruhlar o'zgarmaydi.
-- ============================================================

do $$
declare
  v_def text := pg_get_functiondef('maosh_qatorlari(text)'::regprocedure);
  v_joy text := 'greatest(12,';
begin
  if position(v_joy in v_def) = 0 then
    raise exception '0111: maosh_qatorlari kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_joy,
    'greatest(case when cardinality(guruh_kunlari(g.id, oy.oxir)) <= 2 then guruh_oy_darslari(g.id, p_davr) else 12 end,');

  v_def := pg_get_functiondef('dars_kam_tekshir()'::regprocedure);
  v_joy := 'g.kun_turi <> ''dam_olish''';
  if position(v_joy in v_def) = 0 then
    raise exception '0111: dars_kam_tekshir kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_joy, 'cardinality(g.kunlar) > 2');
end $$;
