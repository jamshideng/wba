-- ============================================================
--  0139 — O'quvchi reytingi (Jamshid, 22.11)
-- ============================================================
--  Reyting JONLI EMAS: davr uchun hisoblanadi va snapshot bo'lib saqlanadi.
--  Davrlar: haftalik (dushanba–yakshanba) va oylik. Hamma o'tgan davrlar
--  saqlanadi — o'quvchi tarixni ko'radi ("oktabrda 5-o'rin").
--
--  Har (o'quvchi, guruh) uchun, faqat o'quvchi guruhda bo'lgan kunlar ichida:
--    · darslar  — o'tilgan (otkazildi) va o'quvchiga belgi qo'yilgan darslar;
--    · davomat  = kelgan / darslar × 100;
--    · woblar   — faqat DARSDA berilgan (lesson_id shu guruh darsi);
--                 o'rtacha = jami / bo'luvchi, ball = min(100, o'rtacha / N × 100).
--                 Bo'luvchi: haftalikda kelgan darslar; oylikda kelgan − 1,
--                 agar o'quvchi guruhning shu oydagi OXIRGI darsiga (test darsi)
--                 kelgan bo'lsa. 0 dan kichik bo'lmaydi. Market sarfi kirmaydi.
--    · test     — faqat oylik: oylik_testlar.davr = shu oy; kelmagan / natijasi
--                 yo'q = 0, qayta topshirgan bo'lsa yangi natija. Guruhda test
--                 bo'lmasa — test vazni qolgan omillarga taqsimlanadi.
--    · umumiy   = vaznlangan o'rtacha (0–100), vaznlar settings['reyting'].
--    · yangi    — darslar minimal chegaradan kam: o'rin berilmaydi.
--  O'rin: umumiy ↓, teng bo'lsa ko'proq kelgan yuqorida; teng — bir xil o'rin.
--  Guruh bo'yicha va fan bo'yicha (bir fanda ikki guruh bo'lsa — darsi ko'pi).
--
--  Kim ko'radi (RPC'larda tekshiriladi, jadval faqat xodimga ochiq):
--    · rahbariyat / xodim — hammasi;
--    · ustoz — o'z guruhi to'liq, fan bo'yicha top 10;
--    · o'quvchi / ota-ona — o'z guruhi to'liq + o'z o'rni, fan top 10 + o'z o'rni.
--  Butun markaz bo'yicha o'quvchiga ko'rsatilmaydi.
-- ============================================================

create table if not exists reyting_davrlar (
  id          bigint generated always as identity primary key,
  tur         text not null check (tur in ('haftalik', 'oylik')),
  dan         date not null,
  gacha       date not null,
  sozlama     jsonb not null,
  hisoblangan timestamptz not null default now(),
  hisobladi   uuid references profiles (id) on delete set null,
  unique (tur, dan),
  check (gacha >= dan)
);

comment on table reyting_davrlar is
  'Reyting davrlari (0139): har haftalik/oylik hisob — bitta qator, o''sha paytdagi sozlama bilan.';

create table if not exists oquvchi_reyting (
  davr_id           bigint not null references reyting_davrlar (id) on delete cascade,
  student_id        text not null references students (id) on delete cascade,
  group_id          text not null references groups (id) on delete cascade,
  subject_id        text references subjects (id) on delete set null,
  darslar           int not null,
  kelgan            int not null,
  davomat           numeric(5, 1) not null,
  woblar_jami       int not null,
  woblar_bolinuvchi int not null,
  woblar            numeric(5, 1) not null,
  test              numeric(5, 1),
  umumiy            numeric(5, 1) not null,
  yangi             boolean not null,
  orin_guruh        int,
  orin_fan          int,
  primary key (davr_id, group_id, student_id)
);

create index if not exists oquvchi_reyting_student_idx on oquvchi_reyting (student_id, davr_id);
create index if not exists oquvchi_reyting_fan_idx on oquvchi_reyting (davr_id, subject_id);

comment on table oquvchi_reyting is 'O''quvchi reytingi snapshot (0139). Faqat reyting_hisobla yozadi.';

alter table reyting_davrlar enable row level security;
alter table reyting_davrlar force row level security;
alter table oquvchi_reyting enable row level security;
alter table oquvchi_reyting force row level security;

drop policy if exists reyting_davrlar_oqish on reyting_davrlar;
create policy reyting_davrlar_oqish on reyting_davrlar for select to authenticated using (true);

drop policy if exists oquvchi_reyting_staff on oquvchi_reyting;
create policy oquvchi_reyting_staff on oquvchi_reyting for select to authenticated
  using (coalesce(app_rol() in ('admin', 'direktor', 'manager'), false));

-- ------------------------------------------------------------
-- Hisoblash
-- ------------------------------------------------------------
create or replace function oquvchi_reyting_hisobla(p_davr bigint) returns int
language plpgsql security definer set search_path = public as $$
declare
  d      reyting_davrlar%rowtype;
  s      jsonb;
  oylik  boolean;
  w_t    numeric;
  w_d    numeric;
  w_w    numeric;
  n100   numeric;
  v_min  int;
  v_soni int;
begin
  select * into d from reyting_davrlar where id = p_davr;
  if not found then raise exception 'Reyting davri topilmadi.'; end if;
  s := d.sozlama;
  oylik := d.tur = 'oylik';
  if oylik then
    w_t := (s -> 'oquvchi_oylik' ->> 'test')::numeric;
    w_d := (s -> 'oquvchi_oylik' ->> 'davomat')::numeric;
    w_w := (s -> 'oquvchi_oylik' ->> 'woblar')::numeric;
    v_min := (s ->> 'min_dars_oylik')::int;
  else
    w_t := 0;
    w_d := (s -> 'oquvchi_haftalik' ->> 'davomat')::numeric;
    w_w := (s -> 'oquvchi_haftalik' ->> 'woblar')::numeric;
    v_min := (s ->> 'min_dars_haftalik')::int;
  end if;
  n100 := greatest((s ->> 'woblar_100')::numeric, 0.0001);

  delete from oquvchi_reyting where davr_id = p_davr;

  insert into oquvchi_reyting (davr_id, student_id, group_id, subject_id, darslar, kelgan, davomat,
                               woblar_jami, woblar_bolinuvchi, woblar, test, umumiy, yangi)
  with yoz as (
    -- davr oxirida guruhda bo'lgan o'quvchilar; guruhda bo'lgan kunlari
    select distinct on (e.student_id, e.group_id)
           e.student_id, e.group_id, g.subject_id,
           greatest(e.boshlandi, d.dan) as bosh,
           d.gacha as oxir
    from enrollments e
    join groups g on g.id = e.group_id
    where e.boshlandi <= d.gacha
      and (e.tugadi is null or e.tugadi >= d.gacha)
    order by e.student_id, e.group_id, e.boshlandi
  ),
  dars as (
    select l.id, l.group_id, l.sana
    from lessons l
    where l.sana between d.dan and d.gacha and l.otkazildi
  ),
  oxirgi as (
    select group_id, max(sana) as sana from dars group by group_id
  ),
  jam as (
    select y.student_id, y.group_id, y.subject_id,
           count(a.id)::int                                              as darslar,
           (count(a.id) filter (where a.holat = 'keldi'))::int           as kelgan,
           coalesce(bool_or(a.holat = 'keldi' and l.sana = o.sana), false) as oxirgiga_keldi,
           coalesce((select sum(w.ball)
                       from woblr w
                       join dars l2 on l2.id = w.lesson_id
                      where w.student_id = y.student_id
                        and l2.group_id = y.group_id
                        and l2.sana between y.bosh and y.oxir), 0)::int  as woblar_jami
    from yoz y
    left join dars l on l.group_id = y.group_id and l.sana between y.bosh and y.oxir
    left join attendance a on a.lesson_id = l.id and a.student_id = y.student_id
    left join oxirgi o on o.group_id = y.group_id
    group by y.student_id, y.group_id, y.subject_id, y.bosh, y.oxir
  ),
  tst as (
    select t.group_id, t.id
    from oylik_testlar t
    where oylik and t.davr = to_char(d.dan, 'YYYY-MM')
  ),
  hisob as (
    select j.*,
           case when j.darslar > 0 then round(100.0 * j.kelgan / j.darslar, 1) else 0 end as davomat,
           case when oylik then greatest(0, j.kelgan - case when j.oxirgiga_keldi then 1 else 0 end)
                else j.kelgan end as bol,
           case when t.id is null then null
                else coalesce((select case when n.keldi then coalesce(n.foiz, 0) else 0 end
                                 from oylik_test_natijalar n
                                where n.test_id = t.id and n.student_id = j.student_id), 0)
           end as test
    from jam j
    left join tst t on t.group_id = j.group_id
  ),
  ball as (
    select h.*,
           case when h.bol > 0 then round(least(100, greatest(0, h.woblar_jami::numeric / h.bol / n100 * 100)), 1)
                else 0 end as woblar
    from hisob h
  )
  select p_davr, b.student_id, b.group_id, b.subject_id, b.darslar, b.kelgan, b.davomat,
         b.woblar_jami, b.bol, b.woblar, b.test,
         round(case
           when b.test is null then
             case when w_d + w_w > 0 then (b.davomat * w_d + b.woblar * w_w) / (w_d + w_w) else 0 end
           else
             case when w_t + w_d + w_w > 0 then (b.test * w_t + b.davomat * w_d + b.woblar * w_w) / (w_t + w_d + w_w) else 0 end
         end, 1),
         b.darslar < v_min
  from ball b;
  get diagnostics v_soni = row_count;

  -- Guruh ichidagi o'rin
  update oquvchi_reyting r set orin_guruh = x.orin
  from (select student_id, group_id,
               rank() over (partition by group_id order by umumiy desc, kelgan desc) as orin
          from oquvchi_reyting where davr_id = p_davr and not yangi) x
  where r.davr_id = p_davr and r.student_id = x.student_id and r.group_id = x.group_id;

  -- Fan bo'yicha o'rin: bir fanda bir nechta guruh bo'lsa — darsi ko'p qatori
  update oquvchi_reyting r set orin_fan = x.orin
  from (select student_id, group_id,
               rank() over (partition by subject_id order by umumiy desc, kelgan desc) as orin
          from (select distinct on (subject_id, student_id) *
                  from oquvchi_reyting
                 where davr_id = p_davr and not yangi and subject_id is not null
                 order by subject_id, student_id, darslar desc, umumiy desc) f) x
  where r.davr_id = p_davr and r.student_id = x.student_id and r.group_id = x.group_id;

  return v_soni;
end;
$$;

revoke execute on function oquvchi_reyting_hisobla(bigint) from public, anon, authenticated;
grant  execute on function oquvchi_reyting_hisobla(bigint) to service_role;

/* Davr chegaralari: haftalik — dushanba–yakshanba, oylik — 1-kundan oxirigacha */
create or replace function reyting_davr_chegarasi(p_tur text, p_sana date, out dan date, out gacha date)
language plpgsql immutable as $$
begin
  if p_tur = 'haftalik' then
    dan := date_trunc('week', p_sana)::date;
    gacha := dan + 6;
  elsif p_tur = 'oylik' then
    dan := date_trunc('month', p_sana)::date;
    gacha := (date_trunc('month', p_sana) + interval '1 month - 1 day')::date;
  else
    raise exception 'Reyting turi: haftalik yoki oylik.';
  end if;
end;
$$;

/*
 * Reytingni hisoblash (snapshot). p_sana — davr ichidagi istalgan kun;
 * null bo'lsa: haftalik — joriy hafta (yakshanba kechasi cron), oylik — o'tgan oy.
 * Shu davr avval hisoblangan bo'lsa — joriy sozlama bilan qayta hisoblanadi.
 * Tugamagan davr hisoblanmaydi. Cron (service_role) va rahbariyat chaqiradi.
 */
create or replace function reyting_hisobla(p_tur text, p_sana date default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_bugun date := bugun_toshkent();
  v_sana  date;
  ch      record;
  v_id    bigint;
begin
  if auth.uid() is not null and coalesce(app_rol() not in ('admin', 'direktor', 'manager'), true) then
    raise exception 'Reytingni faqat rahbariyat hisoblaydi.';
  end if;
  v_sana := coalesce(p_sana, case when p_tur = 'oylik' then (v_bugun - interval '1 month')::date else v_bugun end);
  select * into ch from reyting_davr_chegarasi(p_tur, v_sana);
  if ch.gacha > v_bugun then
    raise exception 'Davr hali tugamagan (% gacha).', to_char(ch.gacha, 'DD/MM/YYYY');
  end if;

  insert into reyting_davrlar (tur, dan, gacha, sozlama, hisobladi)
  values (p_tur, ch.dan, ch.gacha, reyting_sozlama(), auth.uid())
  on conflict (tur, dan) do update
    set sozlama = excluded.sozlama, hisoblangan = now(), hisobladi = excluded.hisobladi
  returning id into v_id;

  perform oquvchi_reyting_hisobla(v_id);
  return v_id;
end;
$$;

revoke execute on function reyting_hisobla(text, date) from public, anon;
grant  execute on function reyting_hisobla(text, date) to authenticated, service_role;

-- ------------------------------------------------------------
-- Ko'rish (huquq shu yerda)
-- ------------------------------------------------------------

/* Sinov davri (Jamshid, 23.11): o'quvchi reytingi hozircha faqat rahbariyatga.
   Sozlamalar → Reyting → "O'quvchilarga ochiq" yoqilsa — o'quvchi, ota-ona, ustoz ham. */
create or replace function reyting_ochiqmi() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null
      or coalesce(app_rol() in ('admin', 'direktor', 'manager'), false)
      or coalesce((reyting_sozlama() ->> 'oquvchiga_ochiq')::boolean, false)
$$;

revoke execute on function reyting_ochiqmi() from public, anon;
grant  execute on function reyting_ochiqmi() to authenticated, service_role;

/* Kimning nomidan: o'quvchining o'zi yoki ota-onaning farzandi */
create or replace function reyting_kim(p_student text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v text := app_student_id();
begin
  if not reyting_ochiqmi() then
    raise exception 'Reyting sinov bosqichida — hozircha faqat rahbariyat ko''radi.';
  end if;
  if p_student is null or p_student = v then return v; end if;
  if app_farzandmi(p_student) or app_is_staff() or app_teaches_student(p_student) then return p_student; end if;
  raise exception 'Bu o''quvchi reytingini ko''rish huquqingiz yo''q.';
end;
$$;

create or replace function reyting_davrlari(p_tur text default null)
returns table (id bigint, tur text, dan date, gacha date, hisoblangan timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, d.tur, d.dan, d.gacha, d.hisoblangan
  from reyting_davrlar d
  where p_tur is null or d.tur = p_tur
  order by d.dan desc, d.tur
$$;

revoke execute on function reyting_davrlari(text) from public, anon;
grant  execute on function reyting_davrlari(text) to authenticated, service_role;

create or replace function reyting_guruh(p_davr bigint, p_group text, p_student text default null)
returns table (orin int, student_id text, fish text, umumiy numeric, davomat numeric, woblar numeric,
               test numeric, darslar int, kelgan int, yangi boolean, menmi boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_men   text := reyting_kim(p_student);
  -- Omillar (davomat, woblar, test) — xodim va guruh ustoziga; o'quvchiga faqat o'ziniki
  v_toliq boolean := app_is_staff() or app_teaches_group(p_group);
begin
  if not (v_toliq
          or exists (select 1 from oquvchi_reyting r
                     where r.davr_id = p_davr and r.group_id = p_group and r.student_id = v_men)) then
    raise exception 'Bu guruh reytingini ko''rish huquqingiz yo''q.';
  end if;

  return query
  select r.orin_guruh, r.student_id, s.fish, r.umumiy,
         case when v_toliq or r.student_id = v_men then r.davomat end,
         case when v_toliq or r.student_id = v_men then r.woblar end,
         case when v_toliq or r.student_id = v_men then r.test end,
         case when v_toliq or r.student_id = v_men then r.darslar end,
         case when v_toliq or r.student_id = v_men then r.kelgan end,
         r.yangi, r.student_id = v_men
  from oquvchi_reyting r
  join students s on s.id = r.student_id
  where r.davr_id = p_davr and r.group_id = p_group
  order by r.yangi, r.orin_guruh nulls last, r.kelgan desc, s.fish;
end;
$$;

revoke execute on function reyting_guruh(bigint, text, text) from public, anon;
grant  execute on function reyting_guruh(bigint, text, text) to authenticated, service_role;

/* Fan bo'yicha: xodimga hammasi, boshqalarga top 10 + o'z qatori */
create or replace function reyting_fan(p_davr bigint, p_fan text, p_student text default null)
returns table (orin int, student_id text, fish text, guruh text, umumiy numeric, davomat numeric,
               woblar numeric, test numeric, darslar int, kelgan int, menmi boolean, jami int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_men   text := reyting_kim(p_student);
  v_xodim boolean := app_is_staff();
  v_jami  int;
begin
  if not (v_xodim
          or exists (select 1 from groups g where g.subject_id = p_fan and g.teacher_id = app_teacher_id())
          or exists (select 1 from oquvchi_reyting r
                     where r.davr_id = p_davr and r.subject_id = p_fan and r.student_id = v_men)) then
    raise exception 'Bu fan reytingini ko''rish huquqingiz yo''q.';
  end if;

  select count(*) into v_jami from oquvchi_reyting r
   where r.davr_id = p_davr and r.subject_id = p_fan and r.orin_fan is not null;

  return query
  select r.orin_fan, r.student_id, s.fish,
         case when v_xodim or r.student_id = v_men then g.nom end,
         r.umumiy,
         case when v_xodim or r.student_id = v_men then r.davomat end,
         case when v_xodim or r.student_id = v_men then r.woblar end,
         case when v_xodim or r.student_id = v_men then r.test end,
         case when v_xodim or r.student_id = v_men then r.darslar end,
         case when v_xodim or r.student_id = v_men then r.kelgan end,
         r.student_id = v_men,
         case when v_xodim then v_jami else null end
  from oquvchi_reyting r
  join students s on s.id = r.student_id
  join groups g on g.id = r.group_id
  where r.davr_id = p_davr and r.subject_id = p_fan
    -- o'zi "yangi" bo'lsa ham ko'rsin (o'rinsiz), lekin bir fanda ikki qator chiqmasin
    and (r.orin_fan is not null
         or (r.student_id = v_men
             and not exists (select 1 from oquvchi_reyting x
                              where x.davr_id = p_davr and x.subject_id = p_fan
                                and x.student_id = v_men and x.orin_fan is not null)))
    and (v_xodim or r.orin_fan <= 10 or r.student_id = v_men)
  order by r.orin_fan nulls last, r.kelgan desc, s.fish;
end;
$$;

revoke execute on function reyting_fan(bigint, text, text) from public, anon;
grant  execute on function reyting_fan(bigint, text, text) to authenticated, service_role;

/* O'quvchining tarixi: har davr, har guruh — o'rinlar */
create or replace function reyting_tarixim(p_student text default null)
returns table (davr_id bigint, tur text, dan date, gacha date, group_id text, guruh text,
               subject_id text, fan text, orin_guruh int, guruh_soni int, orin_fan int,
               umumiy numeric, davomat numeric, woblar numeric, test numeric, yangi boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_men text := reyting_kim(p_student);
begin
  if v_men is null then return; end if;
  return query
  select d.id, d.tur, d.dan, d.gacha, r.group_id, g.nom, r.subject_id, sb.nom,
         r.orin_guruh,
         (select count(*)::int from oquvchi_reyting x
           where x.davr_id = r.davr_id and x.group_id = r.group_id and not x.yangi),
         r.orin_fan, r.umumiy, r.davomat, r.woblar, r.test, r.yangi
  from oquvchi_reyting r
  join reyting_davrlar d on d.id = r.davr_id
  join groups g on g.id = r.group_id
  left join subjects sb on sb.id = r.subject_id
  where r.student_id = v_men
  order by d.dan desc, d.tur, g.nom;
end;
$$;

revoke execute on function reyting_tarixim(text) from public, anon;
grant  execute on function reyting_tarixim(text) to authenticated, service_role;
