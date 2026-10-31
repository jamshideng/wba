-- ============================================================
-- 0110 — dars kunlari tarixi va ustozning guruh tahriri
--
-- 1. guruh_jadvali: dars kunlari sanaga bog'lanadi. O'zgarish tanlangan
--    sanadan kuchga kiradi, undan oldingi kunlar va maosh o'zgarmaydi.
--    groups.kunlar — bugungi jadval (ko'rsatish uchun), har kecha yangilanadi.
-- 2. Eski jadvaldagi belgilanmagan dars bo'lsa, kunlar o'zgartirilmaydi.
--    Tekshiruv yangi sana turgan oy boshidan: undan eski davomat bo'shliqlari
--    (oktabr ko'chirishi) har bir o'zgarishni bloklamasin.
-- 3. Ustoz o'z guruhining faqat nomi va bosqichini o'zgartiradi. O'zi qo'shgan
--    bosqich faqat shu guruhda ko'rinadi (levels.group_id).
-- ============================================================

create table if not exists guruh_jadvali (
  group_id   text not null references groups (id) on delete cascade,
  dan        date not null,
  kunlar     smallint[] not null check (cardinality(kunlar) > 0 and kunlar <@ array[1,2,3,4,5,6,7]::smallint[]),
  yozdi      uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, dan)
);

alter table guruh_jadvali enable row level security;
alter table guruh_jadvali force row level security;

-- Guruhni ko'ra oladigan har kim jadvalini ham ko'radi; yozish faqat funksiyalar orqali
drop policy if exists guruh_jadvali_oqish on guruh_jadvali;
create policy guruh_jadvali_oqish on guruh_jadvali for select to authenticated
  using (exists (select 1 from groups g where g.id = group_id));
revoke all on guruh_jadvali from public, anon;
grant select on guruh_jadvali to authenticated;

-- Hozirgi jadval butun o'tmish uchun amal qiladi: o'tgan oylar hisobi o'zgarmaydi
insert into guruh_jadvali (group_id, dan, kunlar)
select id, date '2000-01-01', kunlar from groups where kunlar is not null
on conflict do nothing;

create or replace function guruh_kunlari(p_group text, p_sana date) returns smallint[]
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select j.kunlar from guruh_jadvali j where j.group_id = p_group and j.dan <= p_sana order by j.dan desc limit 1),
    (select g.kunlar from groups g where g.id = p_group)
  )
$$;
revoke execute on function guruh_kunlari(text, date) from public, anon;
grant execute on function guruh_kunlari(text, date) to authenticated, service_role;

/* Yangi guruh va boshqa yo'l bilan o'zgargan kunlar ham tarixga tushadi */
create or replace function guruh_jadval_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into guruh_jadvali (group_id, dan, kunlar) values (new.id, date '2000-01-01', new.kunlar)
    on conflict do nothing;
  elsif guruh_kunlari(new.id, bugun_toshkent()) is distinct from new.kunlar then
    insert into guruh_jadvali (group_id, dan, kunlar, yozdi) values (new.id, bugun_toshkent(), new.kunlar, auth.uid())
    on conflict (group_id, dan) do update set kunlar = excluded.kunlar, yozdi = excluded.yozdi;
  end if;
  return null;
end;
$$;
revoke execute on function guruh_jadval_trigger() from public, anon, authenticated;

drop trigger if exists groups_jadval_tarix on groups;
create trigger groups_jadval_tarix after insert or update of kunlar on groups
  for each row execute function guruh_jadval_trigger();

-- ------------------------------------------------------------
-- Sanaga bog'liq hisoblar: joriy kunlar o'rniga shu sanadagi jadval.
-- 0079 dagidek funksiyalarning amaldagi matni tahrirlanadi.
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_eski text;
  v_yangi text;
  v_soni int := 0;
begin
  for r in
    select p.oid, p.proname from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and p.prosrc ~ '(guruh_dars_kunimi\((g\.kunlar|v_g\.kunlar|v_kunlar|kunlar),|any \((g|v_g)\.kunlar\))'
  loop
    v_eski := pg_get_functiondef(r.oid);
    v_yangi := regexp_replace(v_eski, 'guruh_dars_kunimi\(g\.kunlar, ([a-z_.:0-9]+)\)',
                              'guruh_dars_kunimi(guruh_kunlari(g.id, \1), \1)', 'g');
    v_yangi := regexp_replace(v_yangi, 'guruh_dars_kunimi\(v_g\.kunlar, ([a-z_.:0-9]+)\)',
                              'guruh_dars_kunimi(guruh_kunlari(v_g.id, \1), \1)', 'g');
    v_yangi := regexp_replace(v_yangi, 'guruh_dars_kunimi\((v_kunlar|kunlar), ([a-z_.:0-9]+)\)',
                              'guruh_dars_kunimi(guruh_kunlari(p_group, \2), \2)', 'g');
    v_yangi := replace(v_yangi, 'extract(isodow from p_eski)::smallint = any (v_g.kunlar)',
                                'extract(isodow from p_eski)::smallint = any (guruh_kunlari(v_g.id, p_eski))');
    v_yangi := replace(v_yangi, 'extract(isodow from k)::smallint = any (g.kunlar)',
                                'extract(isodow from k)::smallint = any (guruh_kunlari(g.id, k::date))');
    if v_yangi = v_eski then
      raise exception '0110: % funksiyasidagi kunlar ifodasi tanilmadi', r.proname;
    end if;
    execute v_yangi;
    v_soni := v_soni + 1;
    raise notice '0110: % sanaga bog''landi', r.proname;
  end loop;
  if v_soni = 0 then
    raise exception '0110: birorta funksiya topilmadi';
  end if;
end $$;

-- ------------------------------------------------------------
-- Admin: dars kunlarini sanadan boshlab o'zgartirish
-- ------------------------------------------------------------
create or replace function guruh_belgilanmagan_kunlar(p_group text, p_dan date) returns date[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(k::date order by k), '{}')
  from generate_series(date_trunc('month', p_dan)::date,
                       least(p_dan, bugun_toshkent()) - 1, interval '1 day') k
  where guruh_dars_kuni(p_group, k::date)
    and exists (select 1 from enrollments e
                where e.group_id = p_group and e.boshlandi <= k::date
                  and (e.tugadi is null or e.tugadi >= k::date))
    and not exists (select 1 from lessons l where l.group_id = p_group and l.sana = k::date and l.otkazildi)
$$;
revoke execute on function guruh_belgilanmagan_kunlar(text, date) from public, anon;
grant execute on function guruh_belgilanmagan_kunlar(text, date) to authenticated, service_role;

create or replace function guruh_jadval_ozgartir(p_group text, p_kunlar smallint[], p_dan date) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_kunlar smallint[];
  v_bosh date[];
begin
  if not app_is_admin() then
    raise exception 'Dars kunlarini faqat admin o''zgartiradi.';
  end if;
  if not exists (select 1 from groups where id = p_group) then
    raise exception 'Guruh topilmadi.';
  end if;
  v_kunlar := array(select distinct x from unnest(p_kunlar) x order by x);
  if cardinality(v_kunlar) = 0 then
    raise exception 'Dars kunlarini tanlang — kamida bitta kun.';
  end if;
  if p_dan is null then
    raise exception 'Yangi jadval qaysi sanadan boshlanishini tanlang.';
  end if;

  -- O'zgarish yo'q: shu sanadagi jadval bir xil va undan keyin rejalangan boshqasi yo'q
  if guruh_kunlari(p_group, p_dan) = v_kunlar
     and not exists (select 1 from guruh_jadvali where group_id = p_group and dan > p_dan) then
    return false;
  end if;

  v_bosh := guruh_belgilanmagan_kunlar(p_group, p_dan);
  if cardinality(v_bosh) > 0 then
    raise exception 'Dars kunlari o''zgarmadi: avval eski darslar davomatini belgilang (%).',
      (select string_agg(to_char(d, 'DD.MM'), ', ' order by d) from unnest(v_bosh) d);
  end if;

  delete from guruh_jadvali where group_id = p_group and dan >= p_dan;
  insert into guruh_jadvali (group_id, dan, kunlar, yozdi) values (p_group, p_dan, v_kunlar, auth.uid());

  -- Yangi jadvalga tushmaydigan, hali o'tilmagan bo'sh darslar ustun bo'lib qolmasin
  delete from lessons l
  where l.group_id = p_group and l.sana >= p_dan and not l.otkazildi
    and l.kochirilgan_dan is null and l.kochirildi_ga is null and l.zamena_teacher_id is null
    and not guruh_dars_kunimi(v_kunlar, l.sana)
    and not exists (select 1 from attendance a where a.lesson_id = l.id);

  update groups set kunlar = guruh_kunlari(p_group, bugun_toshkent()) where id = p_group;
  return true;
end;
$$;
revoke execute on function guruh_jadval_ozgartir(text, smallint[], date) from public, anon;
grant execute on function guruh_jadval_ozgartir(text, smallint[], date) to authenticated;

/* Kelgusi sanaga rejalangan jadval o'sha kuni groups.kunlar ga o'tadi */
create or replace function guruh_jadval_yangila() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update groups g set kunlar = guruh_kunlari(g.id, bugun_toshkent())
  where g.kunlar is distinct from guruh_kunlari(g.id, bugun_toshkent());
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function guruh_jadval_yangila() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron yo''q — jadval yangilash qo''yilmadi (lokal test).';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'guruh-jadval';
  -- 19:01 UTC = 00:01 Toshkent
  perform cron.schedule('guruh-jadval', '1 19 * * *', 'select public.guruh_jadval_yangila()');
end $$;

-- ------------------------------------------------------------
-- Bosqichlar: group_id bo'lsa — faqat shu guruhniki
-- ------------------------------------------------------------
alter table levels add column if not exists group_id text references groups (id) on delete cascade;
alter table levels drop constraint if exists levels_subject_id_nom_key;
create unique index if not exists levels_umumiy_nom on levels (subject_id, lower(nom)) where group_id is null;
create unique index if not exists levels_guruh_nom on levels (group_id, lower(nom)) where group_id is not null;

drop policy if exists levels_read on levels;
create policy levels_read on levels for select to anon, authenticated
  using (group_id is null or auth.uid() is not null);

-- ------------------------------------------------------------
-- Ustoz: faqat o'z guruhi, faqat nom va bosqich
-- ------------------------------------------------------------
create or replace function ustoz_guruhi(p_group text) returns groups
language plpgsql stable security definer set search_path = public as $$
declare v_g groups;
begin
  select * into v_g from groups where id = p_group;
  if v_g.id is null or app_teacher_id() is null or v_g.teacher_id is distinct from app_teacher_id() then
    raise exception 'Bu guruhni tahrirlash huquqingiz yo''q.';
  end if;
  return v_g;
end;
$$;
revoke execute on function ustoz_guruhi(text) from public, anon, authenticated;

/* Nom boshidagi bosqich almashadi ("Beginner · Diana · 10:00" → "Elementary · Diana · 10:00") */
create or replace function guruh_nom_bosqichi(p_nom text, p_eski text, p_yangi text) returns text
language sql immutable as $$
  select case
    when p_eski is null or p_yangi is null then p_nom
    when p_nom = p_eski then p_yangi
    when starts_with(p_nom, p_eski || ' · ') then p_yangi || substr(p_nom, length(p_eski) + 1)
    else p_nom
  end
$$;

create or replace function guruh_ustoz_tahrir(p_group text, p_nom text, p_level bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_g groups;
  v_nom text := btrim(coalesce(p_nom, ''));
  v_fan text;
  v_eski text;
  v_yangi text;
begin
  v_g := ustoz_guruhi(p_group);
  if v_nom = '' then
    raise exception 'Guruh nomini yozing.';
  end if;
  if length(v_nom) > 200 then
    raise exception 'Guruh nomi juda uzun.';
  end if;
  if p_level is not null and not exists (
    select 1 from levels l where l.id = p_level and l.subject_id = v_g.subject_id
      and (l.group_id is null or l.group_id = p_group)
  ) then
    raise exception 'Bu bosqich guruh yo''nalishiga tegishli emas.';
  end if;

  -- Ustoz nomni o'zi o'zgartirmagan bo'lsa, nomdagi bosqich ham almashadi
  if v_nom = v_g.nom and p_level is distinct from v_g.level_id then
    select nom into v_fan from subjects where id = v_g.subject_id;
    select coalesce((select nom from levels where id = v_g.level_id), v_fan) into v_eski;
    select coalesce((select nom from levels where id = p_level), v_fan) into v_yangi;
    v_nom := guruh_nom_bosqichi(v_nom, v_eski, v_yangi);
  end if;

  update groups set nom = v_nom, level_id = p_level where id = p_group;
end;
$$;

create or replace function ustoz_bosqich_qosh(p_group text, p_nom text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_g groups;
  v_nom text := btrim(coalesce(p_nom, ''));
  v_id bigint;
begin
  v_g := ustoz_guruhi(p_group);
  if v_g.subject_id is null then
    raise exception 'Avval admin guruh yo''nalishini tanlashi kerak.';
  end if;
  if v_nom = '' or length(v_nom) > 80 then
    raise exception 'Bosqich nomini yozing (80 belgigacha).';
  end if;
  if exists (select 1 from levels l where l.subject_id = v_g.subject_id and lower(l.nom) = lower(v_nom)
             and (l.group_id is null or l.group_id = p_group)) then
    raise exception 'Bu bosqich ro''yxatda bor.';
  end if;
  insert into levels (subject_id, nom, group_id, tartib)
  values (v_g.subject_id, v_nom, p_group, 1000) returning id into v_id;
  return v_id;
end;
$$;

create or replace function ustoz_bosqich_tahrir(p_level bigint, p_nom text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_l levels;
  v_g groups;
  v_nom text := btrim(coalesce(p_nom, ''));
begin
  select * into v_l from levels where id = p_level;
  if v_l.group_id is null then
    raise exception 'Umumiy bosqichni faqat admin o''zgartiradi.';
  end if;
  v_g := ustoz_guruhi(v_l.group_id);
  if v_nom = '' or length(v_nom) > 80 then
    raise exception 'Bosqich nomini yozing (80 belgigacha).';
  end if;
  if exists (select 1 from levels l where l.id <> p_level and l.subject_id = v_l.subject_id and lower(l.nom) = lower(v_nom)
             and (l.group_id is null or l.group_id = v_l.group_id)) then
    raise exception 'Bu bosqich ro''yxatda bor.';
  end if;
  update levels set nom = v_nom where id = p_level;
  if v_g.level_id = p_level then
    update groups set nom = guruh_nom_bosqichi(nom, v_l.nom, v_nom) where id = v_g.id;
  end if;
end;
$$;

create or replace function ustoz_bosqich_ochir(p_level bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_l levels;
  v_g groups;
  v_fan text;
begin
  select * into v_l from levels where id = p_level;
  if v_l.group_id is null then
    raise exception 'Umumiy bosqichni faqat admin o''zgartiradi.';
  end if;
  v_g := ustoz_guruhi(v_l.group_id);
  if v_g.level_id = p_level then
    select nom into v_fan from subjects where id = v_g.subject_id;
    update groups set level_id = null, nom = guruh_nom_bosqichi(nom, v_l.nom, v_fan) where id = v_g.id;
  end if;
  delete from levels where id = p_level;
end;
$$;

revoke execute on function guruh_ustoz_tahrir(text, text, bigint) from public, anon;
grant execute on function guruh_ustoz_tahrir(text, text, bigint) to authenticated;
revoke execute on function ustoz_bosqich_qosh(text, text) from public, anon;
grant execute on function ustoz_bosqich_qosh(text, text) to authenticated;
revoke execute on function ustoz_bosqich_tahrir(bigint, text) from public, anon;
grant execute on function ustoz_bosqich_tahrir(bigint, text) to authenticated;
revoke execute on function ustoz_bosqich_ochir(bigint) from public, anon;
grant execute on function ustoz_bosqich_ochir(bigint) to authenticated;
