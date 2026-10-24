-- ============================================================
--  0093 — GURUH TURI va unga qarab ustoz maoshi (Jamshid, 24.10)
-- ============================================================
--  groups.turi: umumiy | individual | mini | ielts (guruh ochishda tanlanadi).
--  Maosh formulasi o'zgarmaydi (0075): o'quvchi uchun = stavka ÷ N × darslar,
--  ketma-ket 3+ "kelmadi" ayiriladi. Faqat STAVKA turga qarab olinadi:
--    umumiy     — avvalgidek ustozning o'z stavkasi (teacher_salaries);
--    individual — 1 000 000, mini — 500 000 (2 kishi), ielts — 400 000
--                 (bitta o'quvchi uchun; settings 'maosh.guruh_turi' da,
--                 keyin o'zgartirsa bo'ladi).
--  Turli guruhda ustoz stavkasi shart emas — ustoz biriktirilishi bilan
--  maosh hisoblana boshlaydi. Tasdiqlangan oylar nusxadan o'qiladi — o'zgarmaydi.
--  Sig'im formadan olindi (Jamshid), ustun bazada qoladi.
-- ============================================================

alter table groups add column if not exists turi text not null default 'umumiy';
alter table groups drop constraint if exists groups_turi_check;
alter table groups add constraint groups_turi_check check (turi in ('umumiy', 'individual', 'mini', 'ielts'));

comment on column groups.turi is 'Guruh turi (0093): umumiy — ustoz stavkasi; individual/mini/ielts — settings maosh.guruh_turi stavkasi.';

insert into settings (kalit, qiymat, tavsif)
values ('maosh.guruh_turi', '{"individual": 1000000, "mini": 500000, "ielts": 400000}'::jsonb,
        'Guruh turi bo''yicha ustoz stavkasi — bitta o''quvchi uchun oyiga (so''m). Umumiy guruh — ustozning o''z stavkasi.')
on conflict (kalit) do nothing;

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
    where l.otkazildi and l.sana between oy.bosh and oy.oxir
  ),
  nn as (
    select g.id as group_id,
           greatest(12,
             (select count(*) from dars d where d.group_id = g.id),
             case when oy.oxir < bugun_toshkent() then 0 else (
               select count(*) from generate_series(oy.bosh, oy.oxir, interval '1 day') k
               where guruh_dars_kunimi(g.kunlar, k::date)
             ) end
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
