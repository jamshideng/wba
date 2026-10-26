-- ============================================================
-- 0103 — Manba havolalari (26.10, Jamshid): hisobotdagi har bir
-- moliya raqami bosilganda o'sha raqamni tashkil qilgan qatorlar.
--
-- hisobot_moliya (0044) oylar jadvali bilan BIR XIL qoida:
--   hisoblangan = Σ invoices.summa (bekor emas)
--   chegirma    = Σ invoices.chegirma, VIP oy emas
--   vip         = Σ invoices.chegirma, VIP oy
--   tuzatish    = Σ invoices.tuzatish
-- Shuning uchun ro'yxat yig'indisi hisobotdagi raqamga teng.
-- security invoker — RLS o'z kuchida.
-- ============================================================

create or replace function hisob_tafsilot(p_davr text)
returns table (
  enrollment_id uuid,
  student_id    text,
  fish          text,
  group_id      text,
  guruh         text,
  hisoblangan   numeric,
  chegirma      numeric,
  vip           numeric,
  tuzatish      numeric,
  tolangan      numeric
)
language sql stable security invoker set search_path = public as $$
  select i.enrollment_id, e.student_id, s.fish, e.group_id, g.nom,
         i.summa,
         case when vip_oymi(i.enrollment_id, i.davr) then 0 else i.chegirma end,
         case when vip_oymi(i.enrollment_id, i.davr) then i.chegirma else 0 end,
         i.tuzatish,
         coalesce((select sum(p.summa) from payments p
                   where not p.bekor and p.enrollment_id = i.enrollment_id and p.davr = i.davr), 0)
  from invoices i
  join enrollments e on e.id = i.enrollment_id
  join students s on s.id = e.student_id
  left join groups g on g.id = e.group_id
  where i.holat <> 'bekor' and i.davr = p_davr
  order by s.fish
$$;

/* Keyingi oy kutilayotgan summa (hisobot_moliya.keyingi_kutilgan bilan bir xil) */
create or replace function keyingi_oy_tafsilot()
returns table (
  enrollment_id uuid,
  student_id    text,
  fish          text,
  group_id      text,
  guruh         text,
  summa         numeric
)
language sql stable security invoker set search_path = public as $$
  select e.id, e.student_id, s.fish, e.group_id, g.nom, keyingi_oy_summasi(e.id)
  from enrollments e
  join students s on s.id = e.student_id
  left join groups g on g.id = e.group_id
  where e.holat = 'faol' and s.holat = 'faol'
  order by s.fish
$$;

revoke execute on function hisob_tafsilot(text) from public, anon;
revoke execute on function keyingi_oy_tafsilot() from public, anon;
grant execute on function hisob_tafsilot(text) to authenticated;
grant execute on function keyingi_oy_tafsilot() to authenticated;



-- ------------------------------------------------------------
-- Hisobot raqamlari ortidagi ro'yxat (Hisobotlar › O'quvchilar,
-- Davomat, Ustozlar). Har tur — o'sha hisobot funksiyasidagi BIR XIL
-- shart, shuning uchun qatorlar soni (yoki summa yig'indisi) raqamga teng:
--   hisobot_oquvchilar_ichki (0044 + 0096), hisobot_davomat,
--   hisobot_ustozlar_ichki (0044).
--
-- p_tur:
--   faol_bola, faol_fan, ikki_fanli, vip, arxiv          — hozirgi holat
--   fan                       p_kim = fan nomi ('Boshqa')
--   yangi_bola, yangi_fan, ketgan_bola, tugagan_fan,
--   oy_faol_bola, oy_faol_fan, probniy, probniy_yozildi  — p_davr oyi
--   dav_kutilgan, dav_keldi, dav_kechikdi, dav_kelmadi,
--   dav_sababli, dav_belgisiz                             — p_dan..p_gacha, p_kim = guruh (ixtiyoriy)
--   dav_dars, dav_dars_otildi, dav_dars_qilinmagan        — xuddi shunday
--   ustoz_oquvchi, ustoz_qarz                             — p_kim = ustoz, hozirgi
--   ustoz_dars, ustoz_belgi, ustoz_kelgan, ustoz_tushum,
--   ustoz_woblar                                          — p_kim = ustoz, p_dan..p_gacha
--   ortacha_fan, ortacha_tolov                            — p_davr, p_kim = fan nomi (ixtiyoriy);
--                                                           hisobot_ortacha_tolov_ichki (0091)
--   tushum            p_dan..p_gacha, p_kim = 'tasdiqlanmagan' yoki usul (ixtiyoriy)  — tushum_hisobot
--   belgi, belgi_kelgan                     p_dan..p_gacha                              — hisobot_grafik
--   yangi_yozilish                          p_dan..p_gacha                              — hisobot_grafik
--   dars_kutilgan, dars_qilinmagan          p_dan..p_gacha                              — tushum_hisobot
--   lid                                     p_dan..p_gacha, p_kim = holat guruhi (ixtiyoriy)
--   ustoz_oy_tushum                         p_davr, p_kim = ustoz                       — v_teacher_monthly_income
--   balans_tolangan, balans_qarz            p_kim = 'u:<ustoz>' yoki 'g:<guruh>'        — v_group_stats / v_teacher_stats
--   ustoz_otkazilgan                        p_kim = ustoz, p_dan..p_gacha (faol guruhlar, otkazildi)
-- ------------------------------------------------------------
drop function if exists hisobot_royxat(text, text, text);
create or replace function hisobot_royxat(
  p_tur text, p_davr text default null, p_kim text default null,
  p_dan date default null, p_gacha date default null
)
returns table (
  kalit      text,
  student_id text,
  lead_id    uuid,
  fish       text,
  group_id   text,
  guruh      text,
  sana       date,
  summa      numeric
)
language sql stable security invoker set search_path = public as $$
  with d as (
    select to_date(coalesce(p_davr, to_char(bugun_toshkent(), 'YYYY-MM')) || '-01', 'YYYY-MM-DD') as boshi,
           least((to_date(coalesce(p_davr, to_char(bugun_toshkent(), 'YYYY-MM')) || '-01', 'YYYY-MM-DD')
                  + interval '1 month - 1 day')::date, bugun_toshkent()) as oxiri
  ),
  ye as (  -- yozilish + o'quvchi + guruh
    select e.*, s.fish, s.holat as s_holat, g.nom as g_nom, g.subject_id, g.teacher_id
    from enrollments e
    join students s on s.id = e.student_id
    left join groups g on g.id = e.group_id
  ),
  -- hisobot_davomat: jadval bo'yicha dars kunlari (bugungacha) × o'sha kuni guruhdagi o'quvchi
  kun as (
    select g.id as group_id, g.nom, k.sana::date as sana
    from groups g
    cross join generate_series(p_dan::timestamp, least(p_gacha, bugun_toshkent())::timestamp, interval '1 day') k(sana)
    where left(p_tur, 4) = 'dav_' and g.holat = 'faol' and guruh_dars_kunimi(g.kunlar, k.sana::date)
      and (p_kim is null or g.id = p_kim)
  ),
  slot as (
    select k.group_id, k.nom, k.sana, e.student_id, s.fish,
           (select a.holat::text from lessons l join attendance a on a.lesson_id = l.id
             where l.group_id = k.group_id and l.sana = k.sana and a.student_id = e.student_id
             limit 1) as holat
    from kun k
    join enrollments e on e.group_id = k.group_id
     and e.boshlandi <= k.sana and (e.tugadi is null or e.tugadi >= k.sana)
    join students s on s.id = e.student_id
  ),
  dars as (
    select s.group_id, s.nom, s.sana,
           (count(s.holat) > 0 or exists (
              select 1 from lessons l where l.group_id = s.group_id and l.sana = s.sana and l.otkazildi
           )) as otildi
    from slot s group by s.group_id, s.nom, s.sana
  ),
  -- hisobot_ustozlar_ichki: ustoz guruhlaridagi belgilar
  ub as (
    select a.student_id, s.fish, a.holat::text as holat, l.id as lesson_id, l.sana, g.id as group_id, g.nom
    from attendance a join lessons l on l.id = a.lesson_id join groups g on g.id = l.group_id
    join students s on s.id = a.student_id
    where p_tur in ('ustoz_dars', 'ustoz_belgi', 'ustoz_kelgan')
      and g.teacher_id = p_kim and l.sana between p_dan and p_gacha
  )
  -- ---------- Hozirgi holat ----------
  select ye.id::text, ye.student_id, null::uuid, ye.fish, ye.group_id, ye.g_nom, ye.boshlandi, null::numeric
    from ye where p_tur = 'faol_fan' and ye.holat = 'faol' and ye.s_holat = 'faol'
  union all
  select distinct on (ye.student_id) ye.student_id, ye.student_id, null, ye.fish, null, null, null::date, null
    from ye where p_tur = 'faol_bola' and ye.holat = 'faol' and ye.s_holat = 'faol'
  union all
  select ye.student_id, ye.student_id, null, min(ye.fish), null, string_agg(ye.g_nom, ' | ' order by ye.g_nom), null::date, null
    from ye
   where p_tur = 'ikki_fanli' and ye.holat = 'faol' and ye.s_holat = 'faol'
   group by ye.student_id having count(*) > 1
  union all
  select ye.id::text, ye.student_id, null, ye.fish, ye.group_id, ye.g_nom, ye.boshlandi, null
    from ye where p_tur = 'vip' and ye.holat = 'faol' and ye.vip
  union all
  select s.id, s.id, null, s.fish, null, null, s.arxiv_sana, null
    from students s where p_tur = 'arxiv' and s.holat = 'ketgan'
  union all
  select ye.id::text, ye.student_id, null, ye.fish, ye.group_id, ye.g_nom, ye.boshlandi, null
    from ye left join subjects sb on sb.id = ye.subject_id
   where p_tur = 'fan' and ye.holat = 'faol' and ye.s_holat = 'faol' and ye.group_id is not null
     and coalesce(sb.nom, 'Boshqa') = p_kim
  -- ---------- Oy bo'yicha (O'quvchilar oqimi) ----------
  union all
  select b.student_id, b.student_id, null, s.fish, null, null, b.boshlandi, null
    from (select student_id, min(boshlandi) as boshlandi from enrollments group by 1) b
    join students s on s.id = b.student_id, d
   where p_tur = 'yangi_bola' and b.boshlandi between d.boshi and d.oxiri
  union all
  select e.id::text, e.student_id, null, e.fish, e.group_id, e.g_nom, e.boshlandi, null
    from ye e, d
   where p_tur = 'yangi_fan' and e.boshlandi between d.boshi and d.oxiri
     and not exists (select 1 from enrollments o join groups go on go.id = o.group_id
                     where o.student_id = e.student_id and o.id <> e.id and go.subject_id = e.subject_id
                       and o.tugadi between e.boshlandi - 1 and e.boshlandi)
  union all
  select s.id, s.id, null, s.fish, null, null, s.arxiv_sana, null
    from students s, d where p_tur = 'ketgan_bola' and s.arxiv_sana between d.boshi and d.oxiri
  union all
  select e.id::text, e.student_id, null, e.fish, e.group_id, e.g_nom, e.tugadi, null
    from ye e, d
   where p_tur = 'tugagan_fan' and e.tugadi between d.boshi and d.oxiri
     and not exists (select 1 from enrollments o join groups go on go.id = o.group_id
                     where o.student_id = e.student_id and o.id <> e.id and go.subject_id = e.subject_id
                       and o.boshlandi between e.tugadi and e.tugadi + 1)
  union all
  select distinct on (e.student_id) e.student_id, e.student_id, null, e.fish, null, null, null::date, null
    from ye e, d
   where p_tur = 'oy_faol_bola' and e.boshlandi <= d.oxiri and (e.tugadi is null or e.tugadi >= d.oxiri)
     and e.holat <> 'tanaffus'
  union all
  select e.id::text, e.student_id, null, e.fish, e.group_id, e.g_nom, e.boshlandi, null
    from ye e, d
   where p_tur = 'oy_faol_fan' and e.boshlandi <= d.oxiri and (e.tugadi is null or e.tugadi >= d.oxiri)
     and e.holat <> 'tanaffus'
  union all
  select l.id::text, l.student_id, l.id, l.ism, l.group_id, g.nom, l.created_at::date, null
    from leads l left join groups g on g.id = l.group_id, d
   where p_tur in ('probniy', 'probniy_yozildi') and l.created_at::date between d.boshi and d.oxiri
     and (p_tur = 'probniy' or l.holat = 'yozildi')
  -- ---------- Davomat (p_dan..p_gacha) ----------
  union all
  select s.group_id || '|' || s.sana || '|' || s.student_id, s.student_id, null, s.fish, s.group_id, s.nom, s.sana, null
    from slot s
   where (p_tur = 'dav_kutilgan')
      or (p_tur = 'dav_keldi' and s.holat in ('keldi', 'kechikdi'))
      or (p_tur = 'dav_kechikdi' and s.holat = 'kechikdi')
      or (p_tur = 'dav_kelmadi' and s.holat = 'kelmadi')
      or (p_tur = 'dav_sababli' and s.holat = 'sababli')
      or (p_tur = 'dav_belgisiz' and s.holat is null)
  union all
  select x.group_id || '|' || x.sana, null, null, x.nom, x.group_id, x.nom, x.sana, null
    from dars x
   where p_tur = 'dav_dars'
      or (p_tur = 'dav_dars_otildi' and x.otildi)
      or (p_tur = 'dav_dars_qilinmagan' and not x.otildi)
  -- ---------- Ustoz (p_kim = ustoz) ----------
  union all
  select e.id::text, e.student_id, null, e.fish, e.group_id, e.g_nom, e.boshlandi, null
    from ye e where p_tur = 'ustoz_oquvchi' and e.teacher_id = p_kim and e.holat = 'faol'
  union all
  select q.id::text, q.student_id, null, q.fish, q.group_id, q.g_nom, null::date, q.qarz
    from (
      select e.id, e.student_id, e.fish, e.group_id, e.g_nom,
             (select coalesce(sum(i.summa), 0) from invoices i where i.enrollment_id = e.id and i.holat <> 'bekor')
           - (select coalesce(sum(p.summa), 0) from payments p where p.enrollment_id = e.id and not p.bekor) as qarz
      from ye e where p_tur = 'ustoz_qarz' and e.teacher_id = p_kim
    ) q where q.qarz > 0
  union all
  select distinct on (ub.lesson_id) ub.lesson_id::text, null, null, ub.nom, ub.group_id, ub.nom, ub.sana, null
    from ub where p_tur = 'ustoz_dars'
  union all
  select ub.lesson_id || '|' || ub.student_id, ub.student_id, null, ub.fish, ub.group_id, ub.nom, ub.sana, null
    from ub where p_tur = 'ustoz_belgi' or (p_tur = 'ustoz_kelgan' and ub.holat in ('keldi', 'kechikdi'))
  union all
  select p.id::text, p.student_id, null, s.fish, g.id, g.nom, p.sana, p.summa
    from payments p join enrollments e on e.id = p.enrollment_id join groups g on g.id = e.group_id
    join students s on s.id = p.student_id
   where p_tur = 'ustoz_tushum' and g.teacher_id = p_kim and not p.bekor and p.sana between p_dan and p_gacha
  union all
  select w.id::text, w.student_id, null, s.fish, null, null, (w.created_at at time zone 'Asia/Tashkent')::date, w.ball
    from woblr w left join students s on s.id = w.student_id
   where p_tur = 'ustoz_woblar' and w.teacher_id = p_kim
     and (w.created_at at time zone 'Asia/Tashkent')::date between p_dan and p_gacha
  -- ---------- O'rtacha to'lov (0091): oyda o'qigan yoki to'lagan (bola × fan) ----------
  union all
  select j.student_id || '|' || j.fan, j.student_id, null, s.fish, null, j.guruhlar, null::date, null
    from (
      select x.student_id, x.fan, min(x.subject_id) as subject_id, string_agg(distinct x.g_nom, ' | ') as guruhlar
      from (
        select e.student_id, coalesce(g.subject_id, 'guruh:' || g.id) as fan, g.subject_id, g.nom as g_nom
          from enrollments e join groups g on g.id = e.group_id, d
         where e.boshlandi <= (d.boshi + interval '1 month - 1 day')::date
           and coalesce(e.tugadi, 'infinity'::date) >= d.boshi
        union all
        select e.student_id, coalesce(g.subject_id, 'guruh:' || g.id), g.subject_id, g.nom
          from payments p join enrollments e on e.id = p.enrollment_id join groups g on g.id = e.group_id
         where not p.bekor and p.davr = p_davr
      ) x group by x.student_id, x.fan
    ) j
    join students s on s.id = j.student_id
    left join subjects sb on sb.id = j.subject_id
   where p_tur = 'ortacha_fan' and (p_kim is null or coalesce(sb.nom, 'Fani belgilanmagan') = p_kim)
  union all
  select p.id::text, p.student_id, null, s.fish, g.id, g.nom, p.sana, p.summa
    from payments p
    left join enrollments e on e.id = p.enrollment_id
    left join groups g on g.id = e.group_id
    left join subjects sb on sb.id = g.subject_id
    left join students s on s.id = p.student_id
   where p_tur = 'ortacha_tolov' and not p.bekor and p.davr = p_davr
     and (p_kim is null or (e.id is not null and coalesce(sb.nom, 'Fani belgilanmagan') = p_kim))
  -- ---------- Umumiy hisobot / bosh sahifa (p_dan..p_gacha) ----------
  union all
  select p.id::text, p.student_id, null, coalesce(s.fish, '—'), g.id, g.nom, p.sana, p.summa
    from payments p
    left join enrollments e on e.id = p.enrollment_id
    left join groups g on g.id = e.group_id
    left join students s on s.id = p.student_id
   where p_tur = 'tushum' and not p.bekor and p.sana between p_dan and p_gacha
     and (p_kim is null
          or (p_kim = 'tasdiqlanmagan' and not p.tasdiqlangan)
          or (p_kim = 'tasdiqlangan' and p.tasdiqlangan)
          or coalesce(p.usul::text, 'aniqlanmagan') = p_kim)
  union all
  select a.lesson_id || '|' || a.student_id, a.student_id, null, s.fish, l.group_id, g.nom, l.sana, null
    from attendance a join lessons l on l.id = a.lesson_id
    join students s on s.id = a.student_id
    left join groups g on g.id = l.group_id
   where p_tur in ('belgi', 'belgi_kelgan') and l.sana between p_dan and p_gacha
     and (p_tur = 'belgi' or a.holat in ('keldi', 'kechikdi'))
  union all
  select e.id::text, e.student_id, null, s.fish, e.group_id, g.nom, e.boshlandi, null
    from enrollments e join students s on s.id = e.student_id left join groups g on g.id = e.group_id
   where p_tur = 'yangi_yozilish' and e.boshlandi between p_dan and p_gacha
  union all
  select k.group_id || '|' || k.sana, null, null, k.nom, k.group_id, k.nom, k.sana, null
    from (
      select g.id as group_id, g.nom, k.sana::date as sana
      from groups g
      cross join generate_series(p_dan::timestamp, least(p_gacha, bugun_toshkent())::timestamp, interval '1 day') k(sana)
      where p_tur in ('dars_kutilgan', 'dars_qilinmagan') and g.holat = 'faol'
        and guruh_dars_kunimi(g.kunlar, k.sana::date)
        and exists (select 1 from enrollments e
                    where e.group_id = g.id and e.boshlandi <= k.sana::date
                      and (e.tugadi is null or e.tugadi >= k.sana::date))
    ) k
   where p_tur = 'dars_kutilgan'
      or not exists (select 1 from lessons l
                     where l.group_id = k.group_id and l.sana = k.sana
                       and (l.otkazildi or exists (select 1 from attendance a where a.lesson_id = l.id)))
  union all
  select l.id::text, l.student_id, l.id, l.ism, l.group_id, g.nom, (l.created_at at time zone 'Asia/Tashkent')::date, null
    from leads l left join groups g on g.id = l.group_id
   where p_tur = 'lid' and (l.created_at at time zone 'Asia/Tashkent')::date between p_dan and p_gacha
     and (p_kim is null
          or (p_kim = 'kutilmoqda' and l.holat::text in ('yangi', 'qongiroq', 'keldi'))
          or l.holat::text = p_kim)
  union all
  select p.id::text, p.student_id, null, coalesce(s.fish, '—'), g.id, g.nom, p.sana, p.summa
    from payments p join enrollments e on e.id = p.enrollment_id join groups g on g.id = e.group_id
    left join students s on s.id = p.student_id
   where p_tur = 'ustoz_oy_tushum' and not p.bekor and p.davr = p_davr and g.teacher_id = p_kim
  union all
  select b.enrollment_id::text, b.student_id, null, s.fish, g.id, g.nom, null::date,
         case when p_tur = 'balans_tolangan' then b.tolangan else b.qarz end
    from v_enrollment_balance b
    join groups g on g.id = b.group_id
    join students s on s.id = b.student_id
   where p_tur in ('balans_tolangan', 'balans_qarz')
     and ((left(p_kim, 2) = 'u:' and g.teacher_id = substr(p_kim, 3)) or (left(p_kim, 2) = 'g:' and g.id = substr(p_kim, 3)))
     and (case when p_tur = 'balans_tolangan' then b.tolangan else b.qarz end) <> 0
  union all
  select l.id::text, null, null, g.nom, g.id, g.nom, l.sana, null
    from lessons l join groups g on g.id = l.group_id
   where p_tur = 'ustoz_otkazilgan' and g.teacher_id = p_kim and g.holat = 'faol' and l.otkazildi
     and l.sana between p_dan and p_gacha
$$;
revoke execute on function hisobot_royxat(text, text, text, date, date) from public, anon;
grant execute on function hisobot_royxat(text, text, text, date, date) to authenticated;
