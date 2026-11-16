-- ============================================================
-- 0129 — Tug'ilgan kun eslatmasi (Jamshid, 16.11.2026)
--   Ustoz va o'quvchilarning tug'ilgan kuni 3 kun oldindan HAR KUNI
--   (3 kun qoldi → 2 → ertaga → bugun) "WBA Hisobot" guruhiga, alohida-alohida xabar.
--   Har kuni 09:00 (Toshkent) pg_cron → POST /api/cron/tugilgan (Vault cron_sir).
--   Ustoz sanasi — teacher_shaxsiy.tugilgan_sana, o'quvchi — students.tugilgan_sana.
--   29-fevral kabisa bo'lmagan yilda 28-fevralda nishonlanadi.
-- ============================================================

-- Kuniga bir marta: yuborishdan OLDIN atomik band qilinadi (kunlik_band kabi)
create table if not exists tugilgan_eslatma_kun (
  kun        date primary key,
  yuborildi  timestamptz not null default now()
);
alter table tugilgan_eslatma_kun enable row level security;
alter table tugilgan_eslatma_kun force row level security;
grant all on tugilgan_eslatma_kun to service_role;

create or replace function tugilgan_band(p_kun date) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into tugilgan_eslatma_kun (kun) values (p_kun) on conflict do nothing;
  return found;
end;
$$;
revoke execute on function tugilgan_band(date) from public, anon, authenticated;
grant execute on function tugilgan_band(date) to service_role;

/* Shu yilgi (yoki kelasi yilgi) tug'ilgan kun sanasi, p_kun dan boshlab */
create or replace function tugilgan_keyingi(p_ts date, p_kun date) returns date
language sql immutable set search_path = public as $$
  with y as (select extract(year from p_kun)::int as yil),
  sana as (
    select yil, make_date(yil, extract(month from p_ts)::int,
             least(extract(day from p_ts)::int,
                   extract(day from (make_date(yil, extract(month from p_ts)::int, 1) + interval '1 month - 1 day'))::int)) as s
    from y
  )
  select case when s >= p_kun then s
              else make_date(yil + 1, extract(month from p_ts)::int,
                     least(extract(day from p_ts)::int,
                           extract(day from (make_date(yil + 1, extract(month from p_ts)::int, 1) + interval '1 month - 1 day'))::int))
         end
  from sana
$$;

/* p_kun dan 0..p_oldin kun ichidagi tug'ilgan kunlar: {ustozlar:[...], oquvchilar:[...]} */
create or replace function tugilgan_kunlar(p_kun date, p_oldin int default 3) returns jsonb
language sql stable security definer set search_path = public as $$
  with u as (
    select t.id, t.ism, s.tugilgan_sana as ts, tugilgan_keyingi(s.tugilgan_sana, p_kun) as kun
    from teachers t
    join teacher_shaxsiy s on s.teacher_id = t.id
    where t.holat = 'faol' and s.tugilgan_sana is not null
  ),
  o as (
    select st.id, st.fish as ism, st.tugilgan_sana as ts, tugilgan_keyingi(st.tugilgan_sana, p_kun) as kun,
           (select array_agg(g.nom order by g.nom)
              from enrollments e join groups g on g.id = e.group_id
             where e.student_id = st.id and e.holat = 'faol') as guruhlar
    from students st
    where st.holat = 'faol' and st.tugilgan_sana is not null
  )
  select jsonb_build_object(
    'ustozlar', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'ism', ism, 'sana', kun, 'qoldi', kun - p_kun,
                                          'yosh', extract(year from kun)::int - extract(year from ts)::int)
                       order by kun, ism)
      from u where kun - p_kun between 0 and p_oldin), '[]'::jsonb),
    'oquvchilar', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'ism', ism, 'sana', kun, 'qoldi', kun - p_kun,
                                          'yosh', extract(year from kun)::int - extract(year from ts)::int,
                                          'guruhlar', coalesce(to_jsonb(guruhlar), '[]'::jsonb))
                       order by kun, ism)
      from o where kun - p_kun between 0 and p_oldin), '[]'::jsonb)
  )
$$;
revoke execute on function tugilgan_kunlar(date, int) from public, anon, authenticated;
grant execute on function tugilgan_kunlar(date, int) to service_role;

-- Jadval: har kuni 04:00 UTC = 09:00 Toshkent
do $$
begin
  if to_regnamespace('cron') is null or to_regnamespace('net') is null then
    raise notice 'pg_cron/pg_net yo''q — jadval o''tkazib yuborildi (lokal).';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'tugilgan-kun';
  perform cron.schedule('tugilgan-kun', '0 4 * * *', $c$
    select net.http_post(
      url := 'https://wbalc.uz/api/cron/tugilgan',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_sir'), '')),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000)
  $c$);
end $$;
