-- ============================================================
--  0141 — Reytingni avtomatik hisoblash (pg_cron) (Jamshid, 22.11)
-- ============================================================
--  · Haftalik: har yakshanba 23:30 Toshkent (18:30 UTC) — joriy hafta
--    (dushanba–yakshanba).
--  · Oylik: har kecha 23:45 Toshkent tekshiradi; bugun settings['reyting'].oylik_sana
--    (standart 6) bo'lsa — o'tgan oy. Sana Sozlamalarda o'zgarsa, kod
--    o'zgarmaydi.
--  Hisob bazaning o'zida (reyting_hisobla), HTTP chaqiruv kerak emas.
--  Shu davr qayta hisoblansa — eski snapshot almashtiriladi.
-- ============================================================

create or replace function reyting_oylik_cron() returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if extract(day from bugun_toshkent())::int <> (reyting_sozlama() ->> 'oylik_sana')::int then
    return null;
  end if;
  return reyting_hisobla('oylik');
end;
$$;

revoke execute on function reyting_oylik_cron() from public, anon, authenticated;
grant  execute on function reyting_oylik_cron() to service_role;

do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron yo''q — reyting jadvali o''tkazib yuborildi (lokal).';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname in ('reyting-haftalik', 'reyting-oylik');
  perform cron.schedule('reyting-haftalik', '30 18 * * 0', $c$select reyting_hisobla('haftalik')$c$);
  perform cron.schedule('reyting-oylik', '45 18 * * *', $c$select reyting_oylik_cron()$c$);
end $$;
