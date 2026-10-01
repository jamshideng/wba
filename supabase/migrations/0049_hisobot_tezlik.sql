-- ============================================================
--  0049 — Hisobotlar tezligi (diagnostika, 02.10)
--
--  Hisobot funksiyalari (0044, 0045) security invoker edi: har davomat /
--  to'lov qatorida RLS siyosatlari (app_is_staff(), app_teaches_group…)
--  qayta-qayta hisoblanardi. Lokalda "Ustozlar" bo'limi 28 ms o'rniga
--  ~1 s, ma'lumot o'sgan sari yanada sekinlashardi.
--
--  Endi: ichki funksiya egasi huquqi bilan (RLS'siz) hisoblaydi va
--  hech kimga ochiq emas; tashqi funksiya avval "xodimmi?" deb tekshiradi.
--  Hisobotlar sahifasi baribir faqat xodimga ochiq (talabRol) — natija
--  o'zgarmaydi, faqat tezlashadi. Ustoz / o'quvchi chaqira olmaydi.
-- ============================================================

do $$
declare
  f record;
begin
  for f in
    select * from (values
      ('hisobot_ustozlar',   'p_dan date, p_gacha date', 'p_dan, p_gacha', 'date, date'),
      ('hisobot_davomat',    'p_dan date, p_gacha date', 'p_dan, p_gacha', 'date, date'),
      ('hisobot_grafik',     'p_dan date, p_gacha date', 'p_dan, p_gacha', 'date, date'),
      ('hisobot_moliya',     'p_oylar int default 6',    'p_oylar',        'int'),
      ('hisobot_oquvchilar', 'p_oylar int default 6',    'p_oylar',        'int')
    ) as t(nom, imzo, chaqiruv, turlar)
  loop
    -- Qayta yurgizilsa ham buzilmasin: ichkisi bo'lmasa — hozirgisini ichkiga aylantiramiz
    if to_regprocedure(format('%s_ichki(%s)', f.nom, f.turlar)) is null then
      execute format('alter function %I(%s) rename to %I', f.nom, f.turlar, f.nom || '_ichki');
    end if;
    execute format('alter function %I(%s) security definer', f.nom || '_ichki', f.turlar);
    execute format('revoke execute on function %I(%s) from public, anon, authenticated', f.nom || '_ichki', f.turlar);

    execute format($f$
      create or replace function %I(%s) returns jsonb
      language plpgsql stable security definer set search_path = public as $b$
      begin
        if not app_is_staff() then
          raise exception 'Hisobot faqat xodimlar uchun.';
        end if;
        return %I(%s);
      end;
      $b$
    $f$, f.nom, f.imzo, f.nom || '_ichki', f.chaqiruv);

    execute format('revoke execute on function %I(%s) from public, anon', f.nom, f.turlar);
    execute format('grant execute on function %I(%s) to authenticated', f.nom, f.turlar);
  end loop;
end $$;
