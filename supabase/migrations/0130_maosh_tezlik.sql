-- ============================================================
-- 0130 — maosh: joriy oy hisobi statement timeout'ga tushardi (17.11)
--
-- maosh_qatorlari dagi `nn` CTE bir marta ishlatiladi, shuning uchun
-- Postgres uni so'rovga singdiradi va nested loop ichida HAR qator uchun
-- qayta hisoblaydi (noyabr: 39 guruh o'rniga 629 marta). Joriy oyda u
-- guruh_oy_darslari ni (30 kun × guruh_dars_kuni) chaqiradi — 8 s dan
-- oshib, sahifada "Maoshni o'qib bo'lmadi" chiqardi.
-- `materialized` — nn bir marta, har guruhga bir qator hisoblanadi.
-- Hisob qoidasi o'zgarmaydi.
-- ============================================================

do $$
declare
  v_def text := pg_get_functiondef('maosh_qatorlari(text)'::regprocedure);
  v_joy text := 'nn as (';
begin
  if position(v_joy in v_def) = 0 then
    raise exception '0130: maosh_qatorlari kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_joy, 'nn as materialized (');
end $$;
