-- ============================================================
-- 0148 — "Tuzatish" → "Qayta hisob": foydalanuvchiga ko'rinadigan matnlar
--        (bildirishnoma, ustoz panelidagi izoh, xato xabarlari). Jamshid, 28.11.
--
-- Faqat matn. Jadval, ustun, funksiya nomlari va mantiq O'ZGARMAYDI.
-- Har funksiyaning hozirgi matnidan aniq qator topilib almashtiriladi;
-- kutilgan qator topilmasa — migratsiya to'xtaydi (jim o'tib ketmaydi).
-- Qayta yurgizilsa — allaqachon almashtirilgan qator o'tkazib yuboriladi.
-- Mavjud yozuvlar (sabab, izoh, bekor_sabab) qayta yozilmaydi.
-- ============================================================

do $$
declare
  r      record;
  v_def  text;
begin
  for r in
    select * from (values
      -- tuzatish_darslar_qosh
      ('tuzatish_darslar_qosh(uuid, text, uuid[], text, text, boolean)',
       $s$'Tuzatishni faqat admin, direktor yoki menejer kiritadi.'$s$,
       $s$'Qayta hisobni faqat admin, direktor yoki menejer kiritadi.'$s$),
      ('tuzatish_darslar_qosh(uuid, text, uuid[], text, text, boolean)',
       $s$'Bu oyda qo''lda tuzatish bor — "Tekshirdim, ikki marta emas" belgisini qo''ying.'$s$,
       $s$'Bu oyda qo''lda qayta hisob bor — "Tekshirdim, ikki marta emas" belgisini qo''ying.'$s$),
      ('tuzatish_darslar_qosh(uuid, text, uuid[], text, text, boolean)',
       $s$'Naqd qaytarildi — tuzatish #'$s$,
       $s$'Naqd qaytarildi — qayta hisob #'$s$),
      ('tuzatish_darslar_qosh(uuid, text, uuid[], text, text, boolean)',
       $s$' oyligi qulflangan, lekin o''quvchiga tuzatish berildi'$s$,
       $s$' oyligi qulflangan, lekin o''quvchining hisobi qayta hisoblandi'$s$),
      -- tuzatish_oyna
      ('tuzatish_oyna(uuid, text)',
       $s$'Tuzatish oynasi faqat rahbariyat uchun.'$s$,
       $s$'Qayta hisoblash oynasi faqat rahbariyat uchun.'$s$),
      -- tuzatish_bekor
      ('tuzatish_bekor(bigint, text)',
       $s$'Tuzatishni faqat admin, direktor yoki menejer bekor qiladi.'$s$,
       $s$'Qayta hisobni faqat admin, direktor yoki menejer bekor qiladi.'$s$),
      ('tuzatish_bekor(bigint, text)',
       $s$'Tuzatish topilmadi yoki allaqachon bekor qilingan.'$s$,
       $s$'Qayta hisob topilmadi yoki allaqachon bekor qilingan.'$s$),
      -- ikki joyda (maosh_harakatlar va payments bekor_sabab) — ikkalasi ham
      ('tuzatish_bekor(bigint, text)',
       $s$'Tuzatish #'$s$,
       $s$'Qayta hisob #'$s$),
      -- tuzatish_maosh_qaror
      ('tuzatish_maosh_qaror(bigint, text)',
       $s$'Bu tuzatish bo''yicha qaror kutilmayapti.'$s$,
       $s$'Bu qayta hisob bo''yicha qaror kutilmayapti.'$s$),
      ('tuzatish_maosh_qaror(bigint, text)',
       $s$v_oy || ' tuzatishi: '$s$,
       $s$v_oy || ' qayta hisobi: '$s$),
      -- tuzatish_qosh / tuzatish_tahrir (qo'lda — "Boshqa qayta hisob")
      ('tuzatish_qosh(uuid, text, numeric, text)',
       $s$'Tuzatishni faqat admin yoki direktor kiritadi.'$s$,
       $s$'Qayta hisobni faqat admin, direktor yoki menejer kiritadi.'$s$),
      ('tuzatish_tahrir(bigint, numeric, text)',
       $s$'Tuzatishni faqat admin yoki direktor tahrirlaydi.'$s$,
       $s$'Qayta hisobni faqat admin, direktor yoki menejer tahrirlaydi.'$s$),
      ('tuzatish_tahrir(bigint, numeric, text)',
       $s$'Tuzatish topilmadi yoki bekor qilingan.'$s$,
       $s$'Qayta hisob topilmadi yoki bekor qilingan.'$s$),
      ('tuzatish_tahrir(bigint, numeric, text)',
       $s$'Dars bo''yicha tuzatish tahrirlanmaydi — bekor qilib, qayta kiriting.'$s$,
       $s$'Kelmagan darslar bo''yicha qayta hisob tahrirlanmaydi — bekor qilib, qayta kiriting.'$s$),
      -- o'chirishga urinish
      ('tuzatish_ochirilmaydi()',
       $s$'Tuzatish o''chirilmaydi — bekor qiling.'$s$,
       $s$'Qayta hisob o''chirilmaydi — bekor qiling.'$s$)
    ) t(fn, eski, yangi)
  loop
    v_def := pg_get_functiondef(r.fn::regprocedure);
    if position(r.yangi in v_def) > 0 then
      continue;                       -- allaqachon almashtirilgan
    end if;
    if position(r.eski in v_def) = 0 then
      raise exception '0148: % ichida kutilgan matn topilmadi: %', r.fn, r.eski;
    end if;
    execute replace(v_def, r.eski, r.yangi);
  end loop;
end $$;
