-- ============================================================
--  0050 — Cron so'rovlarida kutish vaqti 60 s (diagnostika, 02.10)
--
--  pg_net standart 5 s kutadi. Sheets ko'zgusi ~8 s ishlaydi: ish oxirigacha
--  bajariladi (kozgu.oxirgi yangilanadi), lekin net._http_response'da
--  "timed_out" bo'lib yoziladi — haqiqiy xatoni ko'rib bo'lmaydi.
--  Endi pg_net javobni 60 s kutadi (route.ts maxDuration = 60 bilan bir xil).
-- ============================================================

do $$
declare
  v_job record;
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron yo''q — o''tkazib yuborildi (lokal).';
    return;
  end if;
  for v_job in
    select jobid, jobname, command from cron.job
    where command like '%net.http_post(%' and command not like '%timeout_milliseconds%'
  loop
    perform cron.alter_job(
      v_job.jobid,
      command := replace(v_job.command, 'net.http_post(', 'net.http_post(timeout_milliseconds := 60000, ')
    );
    raise notice 'cron % — kutish 60 s', v_job.jobname;
  end loop;
end $$;
