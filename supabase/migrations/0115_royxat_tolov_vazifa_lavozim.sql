-- ============================================================
-- 0115 — Ro'yxatlarga to'lov usuli, vazifa turi, lavozim (Jamshid, 01.11)
--
-- Enum o'rniga 0108 dagi yo'l: yozuv kalitni saqlaydi, nom ro'yxatdan keladi,
-- yangi qiymat faol variant bo'lishi kerak. Eski yozuvlar o'zgarmaydi.
-- Tizim varianti (naqd, avto-vazifa turlari) yashirilmaydi, nomi o'zgaradi.
-- Eski enum turlari tegilmaydi: funksiyalardagi ::vazifa_turi kabi yozuvlar ishlayveradi.
-- ============================================================

alter table royxatlar drop constraint if exists royxatlar_tur_check;
alter table royxatlar add constraint royxatlar_tur_check check (tur in (
  'lid_manba', 'xarajat_toifa', 'ketish_sabab', 'woblar_sabab', 'tolov_usul', 'vazifa_turi', 'lavozim'
));

insert into royxatlar (tur, kalit, nom, tartib, tizim, faol) values
  ('tolov_usul', 'naqd', 'Naqd', 10, true, true),
  ('tolov_usul', 'click', 'Click', 20, false, true),
  ('tolov_usul', 'terminal', 'Terminal', 30, false, true),
  ('tolov_usul', 'payme', 'Payme', 40, false, false),
  ('vazifa_turi', 'qongiroq', 'Qo‘ng‘iroq', 10, true, true),
  ('vazifa_turi', 'tolov_eslatish', 'To‘lov eslatish', 20, true, true),
  ('vazifa_turi', 'sinov_chaqirish', 'Sinov darsiga chaqirish', 30, true, true),
  ('vazifa_turi', 'boshqa', 'Boshqa', 1000, true, true),
  ('lavozim', 'farrosh', 'Farrosh', 10, false, true),
  ('lavozim', 'buxgalteriya', 'Buxgalteriya', 20, false, true),
  ('lavozim', 'qorovul', 'Qorovul', 30, false, true),
  ('lavozim', 'oshpaz', 'Oshpaz', 40, false, true),
  ('lavozim', 'haydovchi', 'Haydovchi', 50, false, true),
  ('lavozim', 'texnik', 'Texnik xodim', 60, false, true),
  ('lavozim', 'bogbon', 'Bog‘bon', 70, false, true)
on conflict (tur, kalit) do nothing;

alter table payments alter column usul type text using usul::text;

alter table crm_vazifalar alter column turi drop default;
alter table crm_vazifalar alter column turi type text using turi::text;
alter table crm_vazifalar alter column turi set default 'qongiroq';

drop trigger if exists royxat_tolov_usul on payments;
create trigger royxat_tolov_usul before insert or update on payments
  for each row execute function royxat_qiymati_tekshir('tolov_usul', 'usul');

drop trigger if exists royxat_vazifa_turi on crm_vazifalar;
create trigger royxat_vazifa_turi before insert or update on crm_vazifalar
  for each row execute function royxat_qiymati_tekshir('vazifa_turi', 'turi');
