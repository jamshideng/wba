-- ============================================================
--  0062 — Hisobotlar › Davomat: nechta belgi bo'lishi kerak edi
-- ============================================================
--  Jamshid (10.10): guruhda 5 o'quvchi bo'lsa — o'sha dars kuni 5 ta belgi
--  bo'lishi kerak. Shundan nechtasi keldi, kelmadi va nechtasi belgilanmagan;
--  alohida — oraliqda nechta dars bo'lishi kerak edi va nechtasi o'tildi.
--
--  Qoida jurnal bilan bir xil:
--    dars kuni   — guruh_dars_kunimi(kunlar, sana) (dam_kunlar ham hisobga olinadi),
--                  bugungacha; o'sha kuni kamida bitta o'quvchi yozilgan bo'lsa;
--    o'quvchi    — enrollments: boshlandi <= sana <= tugadi (tugadi bo'sh — davom etyapti);
--    o'tilgan    — darsda kamida bitta belgi bor yoki otkazildi = true.
--  "kelgan" = keldi + kechikdi (avvalgidek). Jadvaldan tashqari qo'yilgan
--  belgilar jami_belgi'da qoladi, lekin "kutilgan" hisobiga kirmaydi.
-- ============================================================

create or replace function hisobot_davomat(p_dan date, p_gacha date)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with b as (
    select a.student_id, a.holat::text as holat, l.sana, l.group_id
    from attendance a join lessons l on l.id = a.lesson_id
    where l.sana between p_dan and p_gacha
  ),
  -- Jadval bo'yicha dars kunlari (bugungacha)
  kun as (
    select g.id as group_id, k.sana::date as sana
    from groups g
    cross join generate_series(p_dan::timestamp, least(p_gacha, bugun_toshkent())::timestamp, interval '1 day') k(sana)
    where g.holat = 'faol' and guruh_dars_kunimi(g.kunlar, k.sana::date)
  ),
  -- Har dars kuni × o'sha kuni guruhda bo'lgan o'quvchi = bitta kutilgan belgi
  slot as (
    select k.group_id, k.sana, e.student_id,
           (select a.holat::text from lessons l join attendance a on a.lesson_id = l.id
             where l.group_id = k.group_id and l.sana = k.sana and a.student_id = e.student_id
             limit 1) as holat
    from kun k
    join enrollments e on e.group_id = k.group_id
     and e.boshlandi <= k.sana and (e.tugadi is null or e.tugadi >= k.sana)
  ),
  dars as (
    select s.group_id, s.sana,
           (count(s.holat) > 0 or exists (
              select 1 from lessons l where l.group_id = s.group_id and l.sana = s.sana and l.otkazildi
           )) as otildi
    from slot s group by s.group_id, s.sana
  ),
  hafta as (
    select date_trunc('week', sana)::date as hafta,
           count(*) as belgi,
           count(*) filter (where holat in ('keldi', 'kechikdi')) as kelgan
    from b group by 1
  ),
  guruh as (
    select g.id, g.nom, coalesce(t.ism, '—') as ustoz,
      (select count(*) from enrollments e where e.group_id = g.id and e.holat = 'faol') as oquvchi,
      (select count(*) from b where b.group_id = g.id) as belgi,
      (select count(*) from b where b.group_id = g.id and b.holat in ('keldi', 'kechikdi')) as kelgan,
      (select count(*) from dars d where d.group_id = g.id) as dars_reja,
      (select count(*) from dars d where d.group_id = g.id and d.otildi) as dars_otildi,
      (select count(*) from slot s where s.group_id = g.id) as kutilgan,
      (select count(*) from slot s where s.group_id = g.id and s.holat in ('keldi', 'kechikdi')) as s_keldi,
      (select count(*) from slot s where s.group_id = g.id and s.holat = 'kelmadi') as s_kelmadi,
      (select count(*) from slot s where s.group_id = g.id and s.holat = 'sababli') as s_sababli,
      (select count(*) from slot s where s.group_id = g.id and s.holat is null) as s_belgilanmagan
    from groups g left join teachers t on t.id = g.teacher_id
    where g.holat = 'faol'
  ),
  qoldiruvchi as (
    select b.student_id, s.fish,
           string_agg(distinct gr.nom, ', ') as guruh,
           count(*) as belgi,
           count(*) filter (where b.holat = 'kelmadi') as kelmadi
    from b join students s on s.id = b.student_id
    join groups gr on gr.id = b.group_id
    where s.holat = 'faol'
    group by b.student_id, s.fish
    having count(*) filter (where b.holat = 'kelmadi') >= 2
  )
  select jsonb_build_object(
    'jami_belgi', (select count(*) from b),
    'jami_kelgan', (select count(*) from b where holat in ('keldi', 'kechikdi')),
    'darslar', jsonb_build_object(
      'reja',          (select count(*) from dars),
      'otildi',        (select count(*) from dars where otildi),
      'belgilanmagan', (select count(*) from dars where not otildi)
    ),
    'belgilar', jsonb_build_object(
      'kutilgan',      (select count(*) from slot),
      'keldi',         (select count(*) from slot where holat = 'keldi'),
      'kechikdi',      (select count(*) from slot where holat = 'kechikdi'),
      'sababli',       (select count(*) from slot where holat = 'sababli'),
      'kelmadi',       (select count(*) from slot where holat = 'kelmadi'),
      'belgilanmagan', (select count(*) from slot where holat is null)
    ),
    'haftalar', coalesce((select jsonb_agg(to_jsonb(h) order by h.hafta) from hafta h), '[]'::jsonb),
    'guruhlar', coalesce((select jsonb_agg(to_jsonb(g) order by g.oquvchi desc, g.nom) from guruh g), '[]'::jsonb),
    'qoldiruvchilar', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.kelmadi desc, q.fish)
      from (select * from qoldiruvchi order by kelmadi desc, fish limit 20) q
    ), '[]'::jsonb)
  )
$$;

comment on function hisobot_davomat(date, date) is
  'Davomat hisoboti: darslar (reja/o''tildi), kutilgan belgilar (dars kuni × guruhdagi o''quvchi) — keldi/kelmadi/sababli/belgilanmagan, guruhlar, haftalar. RLS amal qiladi.';
