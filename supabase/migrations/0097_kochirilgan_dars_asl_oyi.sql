-- ============================================================
--  0097 — Ko'chirilgan dars ASL OYIGA hisoblanadi (Jamshid, 25.10)
-- ============================================================
--  Misol: Komila 21.10 darsini 01.11 ga ko'chirdi. Bu oktabr darsi —
--  o'quvchi uni oktabr to'lovi evaziga oladi, "oyda 12 dars" ham oktabrniki.
--    1) guruh_oy_darslari(guruh, oy) — darslar asl oyi bo'yicha:
--       oyga ko'chib kelgan boshqa oy darsi sanalmaydi, boshqa oyga
--       ko'chib ketgan shu oy darsi sanaladi. Nazorat (0081) ham shunga o'tadi.
--    2) maosh_qatorlari — dars oyi = coalesce(kochirilgan_dan, sana); N shu
--       funksiyadan. TUZATISH: 0093 maosh_qatorlari ni 0075 nusxasidan qayta
--       yozib, 0079 dagi guruh_dars_kuni yamog'ini tushirib qoldirgan edi —
--       shu yerda qaytarildi (guruh_oy_darslari ichida guruh_dars_kuni).
--    3) maosh_tasdiqla — oyning boshqa oyga ko'chgan darsi hali o'tilmagan
--       bo'lsa, tasdiq to'xtaydi (aks holda u maoshga kirmay qoladi).
-- ============================================================

create or replace function guruh_oy_darslari(p_group text, p_davr text) returns int
language sql stable security definer set search_path = public as $$
  select (
    select count(*)::int
    from generate_series(to_date(p_davr || '-01', 'YYYY-MM-DD'),
                         (to_date(p_davr || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day'),
                         interval '1 day') k
    where guruh_dars_kuni(p_group, k::date)
      and not exists (select 1 from lessons l
                      where l.group_id = p_group and l.sana = k::date and l.kochirilgan_dan is not null
                        and to_char(l.kochirilgan_dan, 'YYYY-MM') <> p_davr)
  ) + (
    select count(*)::int from lessons l
    where l.group_id = p_group and l.kochirilgan_dan is not null
      and to_char(l.kochirilgan_dan, 'YYYY-MM') = p_davr and to_char(l.sana, 'YYYY-MM') <> p_davr
  )
$$;
revoke execute on function guruh_oy_darslari(text, text) from public, anon;
grant execute on function guruh_oy_darslari(text, text) to authenticated, service_role;

create or replace function maosh_qatorlari(p_davr text)
returns table (
  teacher_id    text,     -- pulni oladigan (darsni o'tgan) ustoz
  group_id      text,
  guruh         text,
  enrollment_id uuid,
  student_id    text,
  fish          text,
  stavka        numeric,  -- umumiy: guruh ustozining stavkasi; boshqa tur: tur stavkasi (0093)
  n             int,      -- oydagi darslar (kamida 12)
  darslar       int,      -- shu ustoz o'tgan, o'quvchiga tegishli darslar
  ayirildi      int,      -- ketma-ket 3+ qoldirilgani uchun
  hisob_darslar int,
  summa         numeric,  -- null — stavka belgilanmagan
  zamena        boolean   -- o'rinbosar sifatida
)
language sql stable security definer set search_path = public as $$
  with oy as (
    select to_date(p_davr || '-01', 'YYYY-MM-DD') as bosh,
           (to_date(p_davr || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date as oxir
  ),
  dars as (
    select l.id, l.group_id, l.sana, coalesce(l.zamena_teacher_id, g.teacher_id) as ustoz,
           g.teacher_id as guruh_ustozi, l.zamena_teacher_id is not null as zamena
    from lessons l
    join groups g on g.id = l.group_id
    cross join oy
    -- 0097: ko'chirilgan dars asl oyiga (kochirilgan_dan) hisoblanadi
    where l.otkazildi and coalesce(l.kochirilgan_dan, l.sana) between oy.bosh and oy.oxir
  ),
  nn as (
    select g.id as group_id,
           greatest(12,
             (select count(*) from dars d where d.group_id = g.id),
             -- 0097: jadval + ko'chirishlar, asl oy bo'yicha (0079 tuzatishi ham shu yerda)
             case when oy.oxir < bugun_toshkent() then 0 else guruh_oy_darslari(g.id, p_davr) end
           )::int as n
    from groups g cross join oy
    where exists (select 1 from dars d where d.group_id = g.id)
  ),
  qator as (
    select d.*, e.id as eid, e.student_id,
           coalesce(a.holat in ('kelmadi', 'sababli'), false) as yoq
    from dars d
    join enrollments e on e.group_id = d.group_id
     and d.sana >= e.boshlandi and (e.tugadi is null or d.sana <= e.tugadi)
    left join attendance a on a.lesson_id = d.id and a.student_id = e.student_id
  ),
  orol as (
    select q.*,
           row_number() over (partition by q.eid order by q.sana)
         - row_number() over (partition by q.eid, q.yoq order by q.sana) as orol
    from qator q
  ),
  seriya as (
    select o.*, o.yoq and count(*) over (partition by o.eid, o.yoq, o.orol) >= 3 as ayir
    from orol o
  )
  select s.ustoz, s.group_id, g.nom, s.eid, s.student_id, st.fish,
         gs.stavka, nn.n,
         count(*)::int,
         count(*) filter (where s.ayir)::int,
         count(*) filter (where not s.ayir)::int,
         round(gs.stavka * count(*) filter (where not s.ayir) / nn.n),
         bool_or(s.zamena)
  from seriya s
  join groups g on g.id = s.group_id
  join nn on nn.group_id = s.group_id
  join students st on st.id = s.student_id
  left join teacher_salaries ts on ts.teacher_id = s.guruh_ustozi
  -- 0093: umumiy guruh — ustoz stavkasi; individual/mini/ielts — guruh turi stavkasi
  cross join lateral (
    select case when g.turi = 'umumiy' then ts.qiymati
                else (select (st2.qiymat ->> g.turi)::numeric from settings st2 where st2.kalit = 'maosh.guruh_turi')
           end as stavka
  ) gs
  where s.ustoz is not null
  group by s.ustoz, s.group_id, g.nom, s.eid, s.student_id, st.fish, gs.stavka, nn.n, s.zamena
$$;

revoke execute on function maosh_qatorlari(text) from public, anon, authenticated;
grant execute on function maosh_qatorlari(text) to service_role;

/* Tasdiq: oyning boshqa oyga ko'chgan darsi hali o'tilmagan bo'lsa — to'xtatamiz (joyida yamash, 0077 nusxasi saqlanadi) */
do $$
declare
  v_def text := pg_get_functiondef('maosh_tasdiqla(text)'::regprocedure);
  v_joy text := 'if exists (select 1 from maosh_jonli(p_davr) u where u.aniqmas) then';
begin
  if v_def like '%ko''chirilgan darsi hali o''tilmagan%' then
    return;
  end if;
  if position(v_joy in v_def) = 0 then
    raise exception 'maosh_tasdiqla kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_joy, $q$if exists (
    select 1 from lessons l
    where to_char(l.kochirilgan_dan, 'YYYY-MM') = p_davr and l.sana > v_oxir and not l.otkazildi
  ) then
    raise exception 'Bu oyning ko''chirilgan darsi hali o''tilmagan: % — o''tilgach tasdiqlang.', (
      select string_agg(g.nom || ' — ' || to_char(l.sana, 'DD.MM'), '; ' order by l.sana)
      from lessons l join groups g on g.id = l.group_id
      where to_char(l.kochirilgan_dan, 'YYYY-MM') = p_davr and l.sana > v_oxir and not l.otkazildi);
  end if;
  $q$ || v_joy);
end $$;
