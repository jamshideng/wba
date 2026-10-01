-- ============================================================
--  World Bridge Academy
--  0038_cron_wbalc.sql · rejali vazifalar asosiy domenga, kunlik hisobot bir marta
--
--  1. pg_cron vazifalari (0022 kunlik hisobot, 0024 Sheets ko'zgusi) eski
--     wba-phi.vercel.app manzilini chaqirardi. Jamshid (01.10): wba-phi
--     olib tashlanadi — vazifalar endi https://wbalc.uz ga murojaat qiladi.
--     Jadval va tana o'zgarmaydi, faqat manzil.
--  2. kunlik_band(kun) — "bugun yuborildi" belgisini YUBORISHDAN OLDIN
--     atomik band qiladi. Avval belgi yuborilgandan keyin yozilardi:
--     ikki chaqiruv bir vaqtda kelsa hisobot ikki marta ketardi (29.09).
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
    select jobid, jobname, schedule, command from cron.job
    where command like '%wba-phi.vercel.app%'
  loop
    perform cron.alter_job(
      v_job.jobid,
      command := replace(v_job.command, 'https://wba-phi.vercel.app', 'https://wbalc.uz')
    );
    raise notice 'cron % → wbalc.uz', v_job.jobname;
  end loop;
end $$;


create or replace function kunlik_band(p_kun text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_soni int;
begin
  insert into settings (kalit, qiymat, tavsif)
  values ('kunlik_hisobot.oxirgi', 'null'::jsonb, 'Kunlik hisobot guruhga oxirgi yuborilgan kun (/api/cron/kunlik)')
  on conflict (kalit) do nothing;

  update settings
     set qiymat = to_jsonb(p_kun)
   where kalit = 'kunlik_hisobot.oxirgi'
     and qiymat is distinct from to_jsonb(p_kun);
  get diagnostics v_soni = row_count;
  return v_soni = 1;   -- true — shu chaqiruv band qildi, yuborsin
end;
$$;

revoke execute on function kunlik_band(text) from public, anon, authenticated;
grant  execute on function kunlik_band(text) to service_role;
