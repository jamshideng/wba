-- ============================================================
--  0075 — USTOZ MAOSHI v2: dars ulushi, zamena, direktor tasdig'i
-- ============================================================
--  Jamshid (17.10) — 0066 dagi "o'quvchi soni × stavka" o'rniga:
--
--    o'quvchi uchun = stavka ÷ N × hisobga olinadigan darslar
--      stavka — guruh ustozining bitta o'quvchi uchun summasi (teacher_salaries)
--      N      — guruhning oydagi darslari, KAMIDA 12:
--               oy ichida — jadval bo'yicha (dam kunlari chiqarib) yoki o'tilgani,
--               qaysi ko'p bo'lsa; oy tugagach — o'tilgan darslar.
--      darslar — o'quvchi qo'shilgan kundan (ketgan kunigacha) o'tilgan darslar,
--               KETMA-KET 3 va undan ko'p "kelmadi" ayiriladi (1–2 tasi to'lanadi).
--               Seriya faqat shu oy ichida sanaladi. Belgisi yo'q — kelgan hisob.
--    Qarzdor/VIP ham sanaladi — to'lovga qaralmaydi. Ikki fan — ikki qator.
--    Har davomatdan keyin avtomatik yangilanadi (jonli hisob).
--
--  Zamena: lessons.zamena_teacher_id. Shu darsning ulushi (A ustoz stavkasi
--  bilan), davomat, woblar va woblar limiti o'rinbosarga (B) o'tadi.
--  B guruhni faqat o'sha kuni ko'radi. Belgilaydi: guruh ustozi (bugun va
--  keyingi darslar) yoki admin/direktor (istalgan kun).
--
--  Tasdiq: hisoblangan → (tuzatish, sabab bilan) → DIREKTOR tasdiqlaydi →
--  har ustoz maoshi xarajatlar('maosh') ga tushadi, oy qulflanadi.
--  Qayta ochish — faqat direktor, xarajatlar sababi bilan bekor bo'ladi.
--
--  Ko'rish (13.10 qarori bekor): ustoz O'Z maoshini to'liq ko'radi.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Zamena ustuni
-- ------------------------------------------------------------
alter table lessons add column if not exists zamena_teacher_id text references teachers (id) on delete set null;
alter table lessons add column if not exists zamena_sabab text check (zamena_sabab is null or length(zamena_sabab) <= 300);
alter table lessons add column if not exists zamena_kiritdi uuid references profiles (id) on delete set null;

create index if not exists lessons_zamena_idx on lessons (zamena_teacher_id, sana) where zamena_teacher_id is not null;

comment on column lessons.zamena_teacher_id is
  'Zamena: shu darsni guruh ustozi o''rniga o''tgan ustoz. Dars ulushi, davomat, woblar va limit unga (0075).';

/* Darsni kim o'tadi: zamena bo'lsa o'rinbosar, aks holda guruh ustozi */
create or replace function dars_ustozi(p_group text, p_sana date) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select l.zamena_teacher_id from lessons l where l.group_id = p_group and l.sana = p_sana),
    (select g.teacher_id from groups g where g.id = p_group)
  )
$$;

/* Joriy ustoz bugun shu guruhda zamenami */
create or replace function app_zamena_bugun(p_group text) returns boolean
language sql stable security definer set search_path = public as $$
  select app_teacher_id() is not null and exists (
    select 1 from lessons l
    where l.group_id = p_group and l.sana = bugun_toshkent()
      and l.zamena_teacher_id = app_teacher_id()
  )
$$;

revoke execute on function dars_ustozi(text, date) from public, anon;
revoke execute on function app_zamena_bugun(text) from public, anon;
grant execute on function dars_ustozi(text, date) to authenticated, service_role;
grant execute on function app_zamena_bugun(text) to authenticated, service_role;

/* Ustoz huquqi: o'z guruhi YOKI bugungi zamena guruhi. Davomat, woblar,
   o'quvchilar ro'yxati — hammasi shu ikki funksiya orqali ochiladi. */
create or replace function app_teaches_group(p_group text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from groups g
    where g.id = p_group and g.teacher_id = app_teacher_id()
  ) or app_zamena_bugun(p_group)
$$;

create or replace function app_teaches_student(p_student text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from enrollments e
    join groups g on g.id = e.group_id
    where e.student_id = p_student
      and e.holat <> 'tugagan'
      and (g.teacher_id = app_teacher_id() or app_zamena_bugun(g.id))
  )
$$;

drop policy if exists groups_zamena_read on groups;
create policy groups_zamena_read on groups for select to authenticated
  using (app_zamena_bugun(id));

/* Bugungi darslar: zamena guruhi o'rinbosarga ham chiqadi */
create or replace view v_bugungi_darslar as
select
  g.id                                as group_id,
  g.nom,
  g.teacher_id,
  g.boshlanish,
  g.tugash,
  g.kun_turi,
  bugun_toshkent()                    as sana,
  l.id                                as lesson_id,
  coalesce(l.otkazildi, false)        as belgilangan,
  (select count(*) from enrollments e
     where e.group_id = g.id and e.holat <> 'tugagan') as oquvchilar,
  g.kunlar,
  l.zamena_teacher_id,
  (select t.ism from teachers t where t.id = l.zamena_teacher_id) as zamena_ism
from groups g
left join lessons l on l.group_id = g.id and l.sana = bugun_toshkent()
where g.holat = 'faol'
  and guruh_dars_kunimi(g.kunlar, bugun_toshkent());

alter view v_bugungi_darslar set (security_invoker = on);


-- ------------------------------------------------------------
-- 2. Maosh oyi holati (qulf) — zamena va harakatlar shunga qaraydi
-- ------------------------------------------------------------
create table if not exists maosh_oylar (
  davr            text primary key check (davr ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  holat           text not null default 'tasdiqlangan' check (holat in ('tasdiqlangan')),
  tasdiqladi      uuid references profiles (id) on delete set null default auth.uid(),
  tasdiqlangan_at timestamptz not null default now()
);

comment on table maosh_oylar is
  'Direktor tasdiqlagan maosh oylari. Qator bor — oy qulflangan (zamena, avans/bonus/jarima/tuzatish o''zgarmaydi).';

/* Tasdiq paytidagi nusxa: keyin davomat o'zgarsa ham tasdiqlangan summa o'zgarmaydi */
create table if not exists maosh_tasdiq (
  davr        text not null references maosh_oylar (davr) on delete cascade,
  teacher_id  text not null references teachers (id) on delete restrict,
  ism         text not null,
  stavka      numeric(14, 0),
  oquvchilar  int not null,
  hisob       numeric(14, 0) not null,
  avans       numeric(14, 0) not null,
  bonus       numeric(14, 0) not null,
  jarima      numeric(14, 0) not null,
  tuzatish    numeric(14, 0) not null,
  yakuniy     numeric(14, 0) not null,
  tafsilot    jsonb not null default '[]'::jsonb,
  xarajat_id  bigint references xarajatlar (id) on delete set null,
  primary key (davr, teacher_id)
);

alter table maosh_oylar enable row level security;
alter table maosh_tasdiq enable row level security;

drop policy if exists maosh_oylar_read on maosh_oylar;
create policy maosh_oylar_read on maosh_oylar for select to authenticated
  using (app_is_admin() or app_teacher_id() is not null);

drop policy if exists maosh_tasdiq_read on maosh_tasdiq;
create policy maosh_tasdiq_read on maosh_tasdiq for select to authenticated
  using (app_is_admin() or teacher_id = app_teacher_id());

-- Yozish faqat maosh_tasdiqla / maosh_qayta_och orqali
grant select on maosh_oylar, maosh_tasdiq to authenticated;
grant all on maosh_oylar, maosh_tasdiq to service_role;

drop trigger if exists maosh_oylar_audit on maosh_oylar;
create trigger maosh_oylar_audit after insert or update or delete on maosh_oylar
  for each row execute function audit_trigger();

create or replace function maosh_oy_qulfmi(p_davr text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from maosh_oylar where davr = p_davr)
$$;
revoke execute on function maosh_oy_qulfmi(text) from public, anon;
grant execute on function maosh_oy_qulfmi(text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 3. Zamenani o'zgartirish huquqi (to'g'ridan UPDATE ham shu triggerdan o'tadi)
-- ------------------------------------------------------------
create or replace function lessons_zamena_qulf() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ustoz text;
begin
  if tg_op = 'UPDATE'
     and new.zamena_teacher_id is not distinct from old.zamena_teacher_id
     and new.zamena_sabab is not distinct from old.zamena_sabab then
    return new;
  end if;
  if tg_op = 'INSERT' and new.zamena_teacher_id is null then
    return new;
  end if;

  select teacher_id into v_ustoz from groups where id = new.group_id;

  if new.zamena_teacher_id is not null and new.zamena_teacher_id = v_ustoz then
    raise exception 'O''rinbosar guruhning o''z ustozi bo''lmasin.';
  end if;
  if maosh_oy_qulfmi(to_char(new.sana, 'YYYY-MM')) then
    raise exception 'Bu oy maoshi tasdiqlangan — zamenani o''zgartirib bo''lmaydi.';
  end if;
  if auth.uid() is not null and not app_is_admin() then
    if v_ustoz is distinct from app_teacher_id() then
      raise exception 'Zamenani faqat guruh ustozi yoki admin belgilaydi.';
    end if;
    if new.sana < bugun_toshkent() then
      raise exception 'O''tgan dars zamenasini faqat admin tuzatadi.';
    end if;
  end if;

  if new.zamena_teacher_id is null then
    new.zamena_sabab := null;
  end if;
  new.zamena_kiritdi := auth.uid();
  return new;
end;
$$;
revoke execute on function lessons_zamena_qulf() from public, anon, authenticated;

drop trigger if exists lessons_zamena_qulf on lessons;
create trigger lessons_zamena_qulf before insert or update of zamena_teacher_id, zamena_sabab on lessons
  for each row execute function lessons_zamena_qulf();

drop trigger if exists lessons_audit on lessons;
create trigger lessons_audit after update of zamena_teacher_id on lessons
  for each row execute function audit_trigger();

/* Zamena qo'yish / olib tashlash (p_ustoz bo'sh — olib tashlash) */
create or replace function zamena_belgila(p_group text, p_sana date, p_ustoz text, p_sabab text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_g    groups%rowtype;
  v_dars uuid;
begin
  select * into v_g from groups where id = p_group;
  if not found then
    raise exception 'Guruh topilmadi.';
  end if;
  if auth.uid() is not null and not app_is_admin() and v_g.teacher_id is distinct from app_teacher_id() then
    raise exception 'Zamenani faqat guruh ustozi yoki admin belgilaydi.';
  end if;
  if p_ustoz is not null and not exists (select 1 from teachers where id = p_ustoz and holat = 'faol') then
    raise exception 'O''rinbosar ustoz topilmadi yoki faol emas.';
  end if;

  select id into v_dars from lessons where group_id = p_group and sana = p_sana;
  if v_dars is null then
    if p_ustoz is null then
      return null;
    end if;
    if not guruh_dars_kunimi(v_g.kunlar, p_sana) then
      raise exception 'Bu kun guruhning dars kuni emas.';
    end if;
    insert into lessons (group_id, sana, zamena_teacher_id, zamena_sabab)
    values (p_group, p_sana, p_ustoz, nullif(trim(p_sabab), ''))
    returning id into v_dars;
  else
    update lessons
       set zamena_teacher_id = p_ustoz, zamena_sabab = nullif(trim(p_sabab), '')
     where id = v_dars;
  end if;
  return v_dars;
end;
$$;

revoke execute on function zamena_belgila(text, date, text, text) from public, anon;
grant execute on function zamena_belgila(text, date, text, text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 4. Woblar: zamena kuni o'rinbosar beradi, limit ham unga
-- ------------------------------------------------------------

/* Ustozning shu guruhdagi oylik limiti: o'zi o'tadigan kunlar × o'quvchilar × stavka */
create or replace function ustoz_guruh_woblar_limiti(p_group text, p_davr text, p_ustoz text)
returns int
language sql stable security definer set search_path = public as $$
  with oy as (
    select to_date(p_davr || '-01', 'YYYY-MM-DD') as bosh
  ),
  kun as (
    select k::date as sana
    from oy, groups g,
         generate_series(oy.bosh, (oy.bosh + interval '1 month' - interval '1 day'), interval '1 day') k
    where g.id = p_group
      and (guruh_dars_kunimi(g.kunlar, k::date)
           or exists (select 1 from lessons l where l.group_id = g.id and l.sana = k::date and l.zamena_teacher_id is not null))
      and dars_ustozi(p_group, k::date) is not distinct from p_ustoz
  )
  select (coalesce((
    select count(*) from kun
    join enrollments e on e.group_id = p_group
     and e.boshlandi <= kun.sana and (e.tugadi is null or e.tugadi >= kun.sana)
  ), 0) * coalesce((
    select (qiymat #>> '{}')::numeric from settings
    where kalit = 'woblr.oylik_stavka' and jsonb_typeof(qiymat) = 'number'
  ), 3))::int
$$;

/* Shu ustozning shu guruhda bergan woblari (o'quvchi + probniy, sof) */
create or replace function ustoz_guruh_woblar_sarfi(p_group text, p_davr text, p_ustoz text)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(x.ball), 0)::int
  from (
    select w.ball, w.group_id, w.bergan_profile, w.created_at from woblr w
    union all
    select p.ball, p.group_id, p.bergan_profile, p.created_at from probniy_woblar p
  ) x
  join teachers t on t.id = p_ustoz
  where x.group_id = p_group
    and x.bergan_profile = t.profile_id
    and to_char(x.created_at at time zone 'Asia/Tashkent', 'YYYY-MM') = p_davr
$$;

/* Eski ikki argumentli — guruh ustozining ulushi (zamena kunlari chiqib) */
create or replace function guruh_woblar_limiti(p_group text, p_davr text)
returns int
language sql stable security definer set search_path = public as $$
  select ustoz_guruh_woblar_limiti(p_group, p_davr, (select teacher_id from groups where id = p_group))
$$;

create or replace function guruh_woblar_sarfi(p_group text, p_davr text)
returns int
language sql stable security definer set search_path = public as $$
  select ustoz_guruh_woblar_sarfi(p_group, p_davr, (select teacher_id from groups where id = p_group))
$$;

revoke execute on function ustoz_guruh_woblar_limiti(text, text, text) from public, anon;
revoke execute on function ustoz_guruh_woblar_sarfi(text, text, text) from public, anon;
grant execute on function ustoz_guruh_woblar_limiti(text, text, text) to authenticated, service_role;
grant execute on function ustoz_guruh_woblar_sarfi(text, text, text) to authenticated, service_role;

/* Ustoz limiti: o'z guruhlari + shu oy zamena qilgan guruhlari */
create or replace function ustoz_woblar_limiti(p_ustoz text default null, p_davr text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_ustoz text := coalesce(p_ustoz, app_teacher_id());
  v_davr  text := coalesce(p_davr, to_char(bugun_toshkent(), 'YYYY-MM'));
  v_r     jsonb;
begin
  if v_ustoz is null then return null; end if;
  if auth.uid() is not null and v_ustoz is distinct from app_teacher_id() and not app_is_staff() then
    raise exception 'Bu ustozning limitini ko''ra olmaysiz.';
  end if;

  with g as (
    select g.id, g.nom, g.teacher_id <> v_ustoz as zamena,
           ustoz_guruh_woblar_limiti(g.id, v_davr, v_ustoz) as limit_,
           ustoz_guruh_woblar_sarfi(g.id, v_davr, v_ustoz) as berilgan
    from groups g
    where g.holat = 'faol'
      and (g.teacher_id = v_ustoz or exists (
        select 1 from lessons l
        where l.group_id = g.id and l.zamena_teacher_id = v_ustoz
          and to_char(l.sana, 'YYYY-MM') = v_davr
      ))
  )
  select jsonb_build_object(
    'davr', v_davr,
    'stavka', coalesce((select (qiymat #>> '{}')::numeric from settings
                        where kalit = 'woblr.oylik_stavka' and jsonb_typeof(qiymat) = 'number'), 3),
    'jami', jsonb_build_object(
      'limit',    coalesce(sum(limit_), 0),
      'berilgan', coalesce(sum(berilgan), 0),
      'qoldi',    coalesce(sum(limit_ - berilgan), 0)
    ),
    'guruhlar', coalesce(jsonb_agg(jsonb_build_object(
      'group_id', id, 'nom', nom, 'limit', limit_, 'berilgan', berilgan, 'qoldi', limit_ - berilgan,
      'zamena', zamena
    ) order by nom), '[]'::jsonb)
  ) into v_r
  from g;
  return v_r;
end;
$$;

/* Limit triggeri: guruh ustozi yoki bugungi o'rinbosar; limit — beruvchining o'z ulushi */
create or replace function woblr_guruh_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_davr  text;
  v_limit int;
  v_sarf  int;
begin
  if new.group_id is null and new.lesson_id is not null then
    select group_id into new.group_id from lessons where id = new.lesson_id;
  end if;
  if new.group_id is null and new.teacher_id is not null then
    select e.group_id into new.group_id
    from enrollments e join groups g on g.id = e.group_id
    where e.student_id = new.student_id and g.teacher_id = new.teacher_id and e.holat <> 'tugagan'
    order by g.nom limit 1;
  end if;

  if coalesce(current_setting('wba.woblr_kochir', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' and auth.uid() is not null and not app_is_admin() then
    if new.group_id is null or not app_teaches_group(new.group_id) or not exists (
      select 1 from enrollments e
      where e.group_id = new.group_id and e.student_id = new.student_id and e.holat <> 'tugagan'
    ) then
      raise exception 'O''quvchi sizning guruhingizda topilmadi.';
    end if;
    if new.ball > 0 then
      v_davr := to_char(bugun_toshkent(), 'YYYY-MM');
      perform pg_advisory_xact_lock(hashtext('woblr-limit:' || new.group_id || ':' || v_davr));
      v_limit := ustoz_guruh_woblar_limiti(new.group_id, v_davr, app_teacher_id());
      v_sarf  := ustoz_guruh_woblar_sarfi(new.group_id, v_davr, app_teacher_id());
      if v_sarf + new.ball > v_limit then
        raise exception 'Oylik limit: bu guruh uchun % woblar qoldi (limit %, berilgan %).',
          greatest(v_limit - v_sarf, 0), v_limit, v_sarf;
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function woblr_guruh_limit() from public, anon, authenticated;

/* Jurnaldan woblar — woblr.teacher_id = darsni o'tgan ustoz (zamena bo'lsa o'rinbosar) */
create or replace function woblar_ber(
  p_group   text,
  p_student text,
  p_ball    int
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_dars   uuid;
  v_ustoz  text;
  v_bugun  date := bugun_toshkent();
  v_jami   int;
  v_admin  boolean := app_is_admin();
begin
  if auth.uid() is not null and not (app_teaches_group(p_group) or v_admin) then
    raise exception 'Bu guruhda woblar berish huquqingiz yo''q.';
  end if;

  if p_ball is null or p_ball = 0 then
    raise exception 'Woblar 0 bo''lmasin.';
  end if;

  if not exists (
    select 1 from enrollments e
    where e.student_id = p_student and e.group_id = p_group and e.holat <> 'tugagan'
  ) then
    raise exception 'O''quvchi bu guruhda emas.';
  end if;

  select id into v_dars from lessons where group_id = p_group and sana = v_bugun;

  if v_dars is null then
    if not exists (select 1 from groups where id = p_group and guruh_dars_kunimi(kunlar, v_bugun)) then
      raise exception 'Bugun bu guruhning dars kuni emas — woblarni "Woblar" bo''limidan bering.';
    end if;
    insert into lessons (group_id, sana)
    values (p_group, v_bugun)
    on conflict (group_id, sana) do nothing;
    select id into v_dars from lessons where group_id = p_group and sana = v_bugun;
  end if;

  v_ustoz := case when app_teacher_id() is not null and app_teaches_group(p_group)
                  then app_teacher_id() else dars_ustozi(p_group, v_bugun) end;

  insert into woblr (student_id, lesson_id, teacher_id, bergan_profile, ball, sabab, group_id)
  values (p_student, v_dars, v_ustoz, auth.uid(), p_ball, 'faollik', p_group);

  select coalesce(sum(ball), 0)::int into v_jami
  from woblr where lesson_id = v_dars and student_id = p_student;

  return v_jami;
end;
$$;

create or replace function probniy_woblar_ber(p_group text, p_lead uuid, p_ball int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_dars  uuid;
  v_ustoz text;
  v_bugun date := bugun_toshkent();
  v_davr  text := to_char(bugun_toshkent(), 'YYYY-MM');
  v_limit int;
  v_sarf  int;
  v_jami  int;
begin
  if auth.uid() is not null and not (app_teaches_group(p_group) or app_is_admin()) then
    raise exception 'Bu guruhda woblar berish huquqingiz yo''q.';
  end if;
  if p_ball is null or p_ball = 0 then
    raise exception 'Woblar 0 bo''lmasin.';
  end if;
  if not exists (
    select 1 from leads
    where id = p_lead and group_id = p_group and student_id is null
      and holat in ('yangi', 'qongiroq', 'keldi')
  ) then
    raise exception 'Probniy bu guruhda emas.';
  end if;

  select id into v_dars from lessons where group_id = p_group and sana = v_bugun;
  if v_dars is null then
    if not exists (select 1 from groups where id = p_group and guruh_dars_kunimi(kunlar, v_bugun)) then
      raise exception 'Bugun bu guruhning dars kuni emas.';
    end if;
    insert into lessons (group_id, sana) values (p_group, v_bugun)
    on conflict (group_id, sana) do nothing;
    select id into v_dars from lessons where group_id = p_group and sana = v_bugun;
  end if;

  v_ustoz := case when app_teacher_id() is not null and app_teaches_group(p_group)
                  then app_teacher_id() else dars_ustozi(p_group, v_bugun) end;

  if auth.uid() is not null and not app_is_admin() and p_ball > 0 then
    perform pg_advisory_xact_lock(hashtext('woblr-limit:' || p_group || ':' || v_davr));
    v_limit := ustoz_guruh_woblar_limiti(p_group, v_davr, v_ustoz);
    v_sarf  := ustoz_guruh_woblar_sarfi(p_group, v_davr, v_ustoz);
    if v_sarf + p_ball > v_limit then
      raise exception 'Oylik limit: bu guruh uchun % woblar qoldi (limit %, berilgan %).',
        greatest(v_limit - v_sarf, 0), v_limit, v_sarf;
    end if;
  end if;

  insert into probniy_woblar (lead_id, lesson_id, group_id, teacher_id, bergan_profile, ball)
  values (p_lead, v_dars, p_group, v_ustoz, auth.uid(), p_ball);

  select coalesce(sum(ball), 0)::int into v_jami
  from probniy_woblar where lesson_id = v_dars and lead_id = p_lead;
  return v_jami;
end;
$$;


-- ------------------------------------------------------------
-- 5. Tuzatish (+/−) — avans/bonus/jarima qatorida; oy qulfi
-- ------------------------------------------------------------
alter table maosh_harakatlar drop constraint if exists maosh_harakatlar_turi_check;
alter table maosh_harakatlar drop constraint if exists maosh_harakatlar_summa_check;
alter table maosh_harakatlar add constraint maosh_harakatlar_turi_check
  check (turi in ('avans', 'bonus', 'jarima', 'tuzatish'));
alter table maosh_harakatlar add constraint maosh_harakatlar_summa_check
  check ((turi = 'tuzatish' and summa <> 0) or summa > 0);
alter table maosh_harakatlar drop constraint if exists maosh_harakatlar_tuzatish_izoh;
alter table maosh_harakatlar add constraint maosh_harakatlar_tuzatish_izoh
  check (turi <> 'tuzatish' or length(trim(coalesce(izoh, ''))) > 0) not valid;

comment on table maosh_harakatlar is
  'Ustoz maoshiga qo''l bilan: avans (−), bonus (+), jarima (−), tuzatish (± sabab bilan). O''chirilmaydi — bekor qilinadi.';

-- Ustoz o'z yozuvlarini ko'radi
drop policy if exists maosh_harakatlar_read on maosh_harakatlar;
create policy maosh_harakatlar_read on maosh_harakatlar for select to authenticated
  using (app_is_admin() or teacher_id = app_teacher_id());

drop policy if exists teacher_salaries_read on teacher_salaries;
create policy teacher_salaries_read on teacher_salaries for select to authenticated
  using (app_is_admin() or teacher_id = app_teacher_id());

create or replace function maosh_harakat_qulf() returns trigger
language plpgsql set search_path = public as $$
begin
  if maosh_oy_qulfmi(coalesce(new.davr, old.davr)) then
    raise exception 'Bu oy maoshi tasdiqlangan — o''zgartirish uchun direktor oyni qayta ochadi.';
  end if;
  if tg_op = 'INSERT' then
    return new;
  end if;
  if old.bekor then
    raise exception 'Bekor qilingan yozuv o''zgarmaydi.';
  end if;
  if new.teacher_id is distinct from old.teacher_id or new.davr is distinct from old.davr
     or new.turi is distinct from old.turi or new.summa is distinct from old.summa
     or new.kiritgan is distinct from old.kiritgan then
    raise exception 'Yozuv o''zgarmaydi — bekor qilib, to''g''risini qayta kiriting.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists maosh_harakatlar_qulf on maosh_harakatlar;
create trigger maosh_harakatlar_qulf before insert or update on maosh_harakatlar
  for each row execute function maosh_harakat_qulf();


-- ------------------------------------------------------------
-- 6. Hisob — har o'quvchi (qatnashuv) × darsni o'tgan ustoz bo'yicha
--    Ichki: huquq tekshirmaydi, faqat quyidagi funksiyalar chaqiradi.
-- ------------------------------------------------------------
create or replace function maosh_qatorlari(p_davr text)
returns table (
  teacher_id    text,     -- pulni oladigan (darsni o'tgan) ustoz
  group_id      text,
  guruh         text,
  enrollment_id uuid,
  student_id    text,
  fish          text,
  stavka        numeric,  -- guruh ustozining stavkasi
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
         ts.qiymati, nn.n,
         count(*)::int,
         count(*) filter (where s.ayir)::int,
         count(*) filter (where not s.ayir)::int,
         round(ts.qiymati * count(*) filter (where not s.ayir) / nn.n),
         bool_or(s.zamena)
  from seriya s
  join groups g on g.id = s.group_id
  join nn on nn.group_id = s.group_id
  join students st on st.id = s.student_id
  left join teacher_salaries ts on ts.teacher_id = s.guruh_ustozi
  where s.ustoz is not null
  group by s.ustoz, s.group_id, g.nom, s.eid, s.student_id, st.fish, ts.qiymati, nn.n, s.zamena
$$;

revoke execute on function maosh_qatorlari(text) from public, anon, authenticated;
grant execute on function maosh_qatorlari(text) to service_role;


/* Jonli hisob (qulfga qaramaydi). Ichki — ustoz_maosh va maosh_tasdiqla chaqiradi. */
create or replace function maosh_jonli(p_davr text)
returns table (
  teacher_id  text, ism text, stavka numeric, oquvchilar int, hisob numeric,
  avans numeric, bonus numeric, jarima numeric, tuzatish numeric, yakuniy numeric,
  aniqmas boolean, tasdiqlangan boolean
)
language sql stable security definer set search_path = public as $$
  with q as (
    select x.teacher_id as tid, count(distinct x.enrollment_id) filter (where x.hisob_darslar > 0) as n,
           sum(x.summa) as s, bool_or(x.summa is null) as aniqmas
    from maosh_qatorlari(p_davr) x
    group by x.teacher_id
  ),
  h as (
    select m.teacher_id as tid,
      coalesce(sum(m.summa) filter (where m.turi = 'avans'), 0)    as av,
      coalesce(sum(m.summa) filter (where m.turi = 'bonus'), 0)    as bo,
      coalesce(sum(m.summa) filter (where m.turi = 'jarima'), 0)   as ja,
      coalesce(sum(m.summa) filter (where m.turi = 'tuzatish'), 0) as tu
    from maosh_harakatlar m
    where m.davr = p_davr and not m.bekor
    group by m.teacher_id
  )
  select
    t.id, t.ism, s.qiymati,
    coalesce(q.n, 0)::int,
    coalesce(q.s, 0),
    coalesce(h.av, 0), coalesce(h.bo, 0), coalesce(h.ja, 0), coalesce(h.tu, 0),
    coalesce(q.s, 0) - coalesce(h.av, 0) + coalesce(h.bo, 0) - coalesce(h.ja, 0) + coalesce(h.tu, 0),
    coalesce(q.aniqmas, false),
    false
  from teachers t
  left join teacher_salaries s on s.teacher_id = t.id
  left join q on q.tid = t.id
  left join h on h.tid = t.id
  where (t.holat = 'faol' or q.tid is not null or h.tid is not null)
$$;

revoke execute on function maosh_jonli(text) from public, anon, authenticated;
grant execute on function maosh_jonli(text) to service_role;


/* Oylik jamlanma. Admin — hamma ustoz; ustoz — faqat o'zi. Tasdiqlangan oy — nusxadan. */
drop function if exists ustoz_maosh(text);
create or replace function ustoz_maosh(p_davr text)
returns table (
  teacher_id  text,
  ism         text,
  stavka      numeric,
  oquvchilar  int,
  hisob       numeric,
  avans       numeric,
  bonus       numeric,
  jarima      numeric,
  tuzatish    numeric,
  yakuniy     numeric,
  aniqmas     boolean,
  tasdiqlangan boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_admin boolean := app_is_admin() or auth.uid() is null;
  v_men   text := app_teacher_id();
begin
  if not v_admin and v_men is null then
    raise exception 'Maosh faqat admin, direktor va ustozning o''ziga ochiq.';
  end if;
  if p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy YYYY-MM ko''rinishida bo''lsin.';
  end if;

  if maosh_oy_qulfmi(p_davr) then
    return query
    select m.teacher_id, m.ism, m.stavka, m.oquvchilar, m.hisob, m.avans, m.bonus, m.jarima,
           m.tuzatish, m.yakuniy, false, true
    from maosh_tasdiq m
    where m.davr = p_davr and (v_admin or m.teacher_id = v_men)
    order by m.ism;
    return;
  end if;

  return query
  select j.* from maosh_jonli(p_davr) j
  where v_admin or j.teacher_id = v_men
  order by j.ism;
end;
$$;

revoke execute on function ustoz_maosh(text) from public, anon;
grant  execute on function ustoz_maosh(text) to authenticated, service_role;


/* Bitta ustozning batafsil hisobi (guruh → o'quvchi). Ustoz — faqat o'zi. */
create or replace function ustoz_maosh_tafsilot(p_davr text, p_ustoz text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_r jsonb;
begin
  if auth.uid() is not null and not app_is_admin() and p_ustoz is distinct from app_teacher_id() then
    raise exception 'Bu ustozning maoshini ko''ra olmaysiz.';
  end if;
  if p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy YYYY-MM ko''rinishida bo''lsin.';
  end if;

  if maosh_oy_qulfmi(p_davr) then
    select m.tafsilot into v_r from maosh_tasdiq m where m.davr = p_davr and m.teacher_id = p_ustoz;
    return coalesce(v_r, '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'group_id', x.group_id, 'guruh', x.guruh, 'student_id', x.student_id, 'fish', x.fish,
    'stavka', x.stavka, 'n', x.n, 'darslar', x.darslar, 'ayirildi', x.ayirildi,
    'hisob_darslar', x.hisob_darslar, 'summa', x.summa, 'zamena', x.zamena
  ) order by x.zamena, x.guruh, x.fish), '[]'::jsonb)
  into v_r
  from maosh_qatorlari(p_davr) x
  where x.teacher_id = p_ustoz;
  return v_r;
end;
$$;

revoke execute on function ustoz_maosh_tafsilot(text, text) from public, anon;
grant execute on function ustoz_maosh_tafsilot(text, text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 7. Direktor tasdig'i → xarajatlar; qayta ochish
-- ------------------------------------------------------------
create or replace function maosh_tasdiqla(p_davr text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_r     record;
  v_oxir  date;
  v_soni  int := 0;
  v_xid   bigint;
  v_gross numeric;
begin
  if auth.uid() is not null and not app_is_direktor() then
    raise exception 'Maoshni faqat direktor tasdiqlaydi.';
  end if;
  if p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy YYYY-MM ko''rinishida bo''lsin.';
  end if;
  v_oxir := (to_date(p_davr || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;
  if v_oxir >= bugun_toshkent() then
    raise exception 'Oy hali tugamagan — maosh oy tugagach tasdiqlanadi.';
  end if;

  perform pg_advisory_xact_lock(hashtext('maosh-tasdiq:' || p_davr));
  if maosh_oy_qulfmi(p_davr) then
    raise exception 'Bu oy allaqachon tasdiqlangan.';
  end if;
  if exists (select 1 from maosh_jonli(p_davr) u where u.aniqmas) then
    raise exception 'Ba''zi ustozlarga stavka belgilanmagan — avval stavkani kiriting.';
  end if;

  insert into maosh_oylar (davr) values (p_davr);

  for v_r in select * from maosh_jonli(p_davr) u where u.hisob <> 0 or u.yakuniy <> 0 or u.avans <> 0 loop
    v_xid := null;
    -- Xarajat — ustozga shu oy uchun jami beriladigan pul (oldin berilgan avans ham shu ichida)
    v_gross := v_r.yakuniy + v_r.avans;
    if v_gross > 0 then
      insert into xarajatlar (sana, toifa, summa, izoh)
      values (v_oxir, 'maosh', v_gross,
              format('Ustoz maoshi · %s · %s%s', p_davr, v_r.ism,
                     case when v_r.avans > 0 then format(' (avans %s oldin berilgan)', v_r.avans) else '' end))
      returning id into v_xid;
    end if;

    insert into maosh_tasdiq (davr, teacher_id, ism, stavka, oquvchilar, hisob, avans, bonus, jarima, tuzatish, yakuniy, tafsilot, xarajat_id)
    values (p_davr, v_r.teacher_id, v_r.ism, v_r.stavka, v_r.oquvchilar, v_r.hisob, v_r.avans, v_r.bonus,
            v_r.jarima, v_r.tuzatish, v_r.yakuniy,
            (select coalesce(jsonb_agg(jsonb_build_object(
               'group_id', x.group_id, 'guruh', x.guruh, 'student_id', x.student_id, 'fish', x.fish,
               'stavka', x.stavka, 'n', x.n, 'darslar', x.darslar, 'ayirildi', x.ayirildi,
               'hisob_darslar', x.hisob_darslar, 'summa', x.summa, 'zamena', x.zamena
             ) order by x.zamena, x.guruh, x.fish), '[]'::jsonb)
             from maosh_qatorlari(p_davr) x where x.teacher_id = v_r.teacher_id),
            v_xid);
    v_soni := v_soni + 1;
  end loop;

  return v_soni;
end;
$$;

create or replace function maosh_qayta_och(p_davr text, p_sabab text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_soni int;
begin
  if auth.uid() is not null and not app_is_direktor() then
    raise exception 'Tasdiqlangan oyni faqat direktor qayta ochadi.';
  end if;
  if length(trim(coalesce(p_sabab, ''))) = 0 then
    raise exception 'Qayta ochish sababini yozing.';
  end if;
  if not maosh_oy_qulfmi(p_davr) then
    raise exception 'Bu oy tasdiqlanmagan.';
  end if;

  update xarajatlar x
     set bekor = true, bekor_sabab = 'Maosh oyi qayta ochildi: ' || trim(p_sabab)
    from maosh_tasdiq m
   where m.davr = p_davr and m.xarajat_id = x.id and not x.bekor;
  get diagnostics v_soni = row_count;

  delete from maosh_oylar where davr = p_davr;   -- maosh_tasdiq cascade
  return v_soni;
end;
$$;

revoke execute on function maosh_tasdiqla(text) from public, anon;
revoke execute on function maosh_qayta_och(text, text) from public, anon;
grant execute on function maosh_tasdiqla(text) to authenticated, service_role;
grant execute on function maosh_qayta_och(text, text) to authenticated, service_role;

update settings set qiymat = '"dars_ulushi"'::jsonb, updated_at = now()
where kalit = 'maosh.qoida';
