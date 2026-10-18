-- ============================================================
--  0081 — Oyda kamida 12 dars: eslatma va nazorat (Jamshid, 18.10)
-- ============================================================
--  Dam kunlari sabab guruh jadvalida oyda 12 tadan kam dars qolsa:
--    1) eslatma — ustozga va managerga darhol (joriy va keyingi oy):
--       "N ta dars yetmaydi, boshqa kunga ko'chiring". Har yangi holat
--       (soni o'zgarsa) — yangi eslatma. Pulga ta'sir qilmaydi.
--    2) oy oxirida (oxirgi kun 20:00 dan keyin) hali ham 12 dan kam
--       bo'lsa — nazorat hodisasi 'darslar_kam' (ogohlantirish/jarima).
--  Maosh qoidasi o'zgarmaydi: N kamida 12 (0075) — o'tilmagan dars
--  ustoz maoshidan kamayadi.
--  Oy o'rtasida ochilgan guruh tekshirilmaydi (u oy to'liq emas).
--  Dam olish guruhlari (shanba–yakshanba, oyda 8–9 dars) hozircha
--  tekshirilmaydi — Jamshid qoidasini keyin aytadi (18.10).
-- ============================================================

alter table nazorat_hodisalar drop constraint if exists nazorat_hodisalar_turi_check;
alter table nazorat_hodisalar add constraint nazorat_hodisalar_turi_check check (turi in (
  'ustoz_kechikdi', 'davomat_qilinmadi', 'oquvchi_3_kelmadi', 'woblar_berilmadi',
  'lid_qongiroq', 'vazifa_muddati', 'qarzdor_eslatilmadi', 'tolov_kech', 'tolov_tasdiqlanmadi',
  'darslar_kam'));

/* Guruhning oydagi darslari: jadval + ko'chirib kelingan − ko'chirilgan − dam kunlari */
create or replace function guruh_oy_darslari(p_group text, p_davr text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from generate_series(to_date(p_davr || '-01', 'YYYY-MM-DD'),
                       (to_date(p_davr || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day'),
                       interval '1 day') k
  where guruh_dars_kuni(p_group, k::date)
$$;
revoke execute on function guruh_oy_darslari(text, text) from public, anon;
grant execute on function guruh_oy_darslari(text, text) to authenticated, service_role;

create table if not exists dars_kam_eslatma (
  group_id   text not null references groups (id) on delete cascade,
  davr       text not null check (davr ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  soni       int  not null,                 -- shu paytdagi darslar soni
  teacher_id text references teachers (id) on delete set null,
  yuborildi  boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (group_id, davr, soni)
);
comment on table dars_kam_eslatma is 'Oyda 12 tadan kam dars — ustoz va managerga eslatma (0081). Soni o''zgarsa — yangi qator.';

alter table dars_kam_eslatma enable row level security;
drop policy if exists dars_kam_read on dars_kam_eslatma;
create policy dars_kam_read on dars_kam_eslatma for select to authenticated
  using (app_is_manager() or teacher_id = app_teacher_id());
grant select on dars_kam_eslatma to authenticated;
grant all on dars_kam_eslatma to service_role;

/* Cron chaqiradi (nazorat_yig bilan birga). Qaytaradi — yangi eslatma + hodisa soni. */
create or replace function dars_kam_tekshir() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_bugun date := bugun_toshkent();
  v_soat  time := (now() at time zone 'Asia/Tashkent')::time;
  v_oxir  date := (date_trunc('month', bugun_toshkent()) + interval '1 month' - interval '1 day')::date;
  v_davr  text;
  v_soni  int := 0;
  v_n     int;
begin
  if auth.uid() is not null and not app_is_manager() then
    raise exception 'Faqat tizim yoki manager.';
  end if;

  foreach v_davr in array array[to_char(v_bugun, 'YYYY-MM'), to_char(v_bugun + interval '1 month', 'YYYY-MM')] loop
    insert into dars_kam_eslatma (group_id, davr, soni, teacher_id)
    select g.id, v_davr, x.n, g.teacher_id
    from groups g
    cross join lateral (select guruh_oy_darslari(g.id, v_davr) as n) x
    where g.holat = 'faol' and g.kun_turi <> 'dam_olish'
      and (g.created_at at time zone 'Asia/Tashkent')::date <= to_date(v_davr || '-01', 'YYYY-MM-DD')
      and exists (select 1 from enrollments e where e.group_id = g.id and e.holat = 'faol')
      and x.n < 12
    on conflict do nothing;
    get diagnostics v_n = row_count; v_soni := v_soni + v_n;
  end loop;

  -- Oy oxiri: hali ham 12 dan kam — nazorat hodisasi
  if v_bugun = v_oxir and v_soat >= time '20:00' then
    v_davr := to_char(v_bugun, 'YYYY-MM');
    insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, tafsilot, kalit)
    select 'darslar_kam', v_bugun, g.teacher_id, g.id,
           format('%s — %s oyida %s ta dars (12 dan %s ta kam), boshqa kunga ko''chirilmadi', g.nom, v_davr, x.n, 12 - x.n),
           'kam:' || g.id || ':' || v_davr
    from groups g
    cross join lateral (select guruh_oy_darslari(g.id, v_davr) as n) x
    where g.holat = 'faol' and g.teacher_id is not null and g.kun_turi <> 'dam_olish'
      and (g.created_at at time zone 'Asia/Tashkent')::date <= to_date(v_davr || '-01', 'YYYY-MM-DD')
      and exists (select 1 from enrollments e where e.group_id = g.id and e.holat = 'faol')
      and x.n < 12
    on conflict (kalit) do nothing;
    get diagnostics v_n = row_count; v_soni := v_soni + v_n;
  end if;

  return v_soni;
end;
$$;
revoke execute on function dars_kam_tekshir() from public, anon;
grant execute on function dars_kam_tekshir() to authenticated, service_role;


/*
 * Ko'chirish takliflari: shu oyda dam kuniga tushgan (hali ko'chirilmagan)
 * darslar va eng yaqin bo'sh kun — guruhning darsi yo'q, dam emas, yakshanba
 * emas. Masalan toq guruhning dushanba darsi → seshanba (juft kun).
 */
create or replace function kochirish_takliflari(p_group text, p_davr text)
returns table (eski date, taklif date, sabab text)
language sql stable security definer set search_path = public as $$
  select k::date, (
           select min(t::date) from generate_series(k + interval '1 day', k + interval '10 days', interval '1 day') t
           where extract(isodow from t) <> 7
             and not guruh_dars_kuni(p_group, t::date)
             and not exists (select 1 from dam_kunlar d where d.sana = t::date)
             and not exists (select 1 from lessons l where l.group_id = p_group and l.sana = t::date)
         ), dk.sabab
  from groups g
  cross join generate_series(to_date(p_davr || '-01', 'YYYY-MM-DD'),
                             (to_date(p_davr || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day'),
                             interval '1 day') k
  join dam_kunlar dk on dk.sana = k::date
  where g.id = p_group
    and extract(isodow from k)::smallint = any (g.kunlar)
    and not exists (select 1 from lessons l where l.group_id = p_group and l.sana = k::date and l.kochirildi_ga is not null)
  order by 1
$$;
revoke execute on function kochirish_takliflari(text, text) from public, anon;
grant execute on function kochirish_takliflari(text, text) to authenticated, service_role;
