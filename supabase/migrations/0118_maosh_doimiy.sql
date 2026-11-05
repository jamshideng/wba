-- ============================================================
--  0118 — MAOSH SOZLAMALARI: doimiy ushlanma / qo'shimcha (Jamshid, 05.11)
-- ============================================================
--  Jamshid turni o'zi yaratadi (masalan "Soliq" — ayiriladi, "Yo'l puli" —
--  qo'shiladi) va har ustozga alohida summa beradi: qaysi oydan, ixtiyoriy
--  qaysi oygacha. Shu oralig'idagi har oyda ustoz maoshidan avtomatik
--  ayiriladi (yoki qo'shiladi) — har oy qo'lda yozish shart emas.
--
--    * Faqat shu oyda darslar bo'yicha hisobi bor (hisob > 0) ustozga
--      qo'llanadi — ishlamagan oyda soliq olinmaydi.
--    * Tasdiqlangan oy nusxadan o'qiladi (maosh_tasdiq.doimiy) — keyin
--      summa o'zgarsa ham eski oy o'zgarmaydi.
--    * Bitta ustoz × bitta tur — bitta qoida (summa o'zgarsa tahrirlanadi).
--    * Xarajat (maosh_tasdiqla) — ustozga beriladigan pul (yakuniy + avans),
--      avvalgidek.
-- ============================================================

create table if not exists maosh_turlar (
  id          bigint generated always as identity primary key,
  nom         text not null check (length(btrim(nom)) between 1 and 60),
  ishora      smallint not null check (ishora in (-1, 1)),   -- -1 ayiriladi, 1 qo'shiladi
  faol        boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists maosh_turlar_nom_uq on maosh_turlar (lower(btrim(nom)));
comment on table maosh_turlar is
  'Doimiy maosh turlari (0118): Jamshid o''zi yaratadi. ishora -1 — maoshdan ayiriladi (soliq), 1 — qo''shiladi.';

create table if not exists maosh_doimiy (
  id          bigint generated always as identity primary key,
  teacher_id  text not null references teachers (id) on delete cascade,
  tur_id      bigint not null references maosh_turlar (id) on delete restrict,
  summa       numeric(14, 0) not null check (summa > 0),
  dan         text not null check (dan ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  gacha       text check (gacha is null or gacha ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  updated_at  timestamptz not null default now(),
  unique (teacher_id, tur_id),
  check (gacha is null or gacha >= dan)
);
comment on table maosh_doimiy is
  'Ustozga doimiy summa (0118): dan..gacha oylarida maoshga avtomatik qo''llanadi (tur ishorasi bilan).';

alter table maosh_turlar enable row level security;
alter table maosh_turlar force row level security;
alter table maosh_doimiy enable row level security;
alter table maosh_doimiy force row level security;

drop policy if exists maosh_turlar_read on maosh_turlar;
create policy maosh_turlar_read on maosh_turlar for select to authenticated using (app_is_admin());
drop policy if exists maosh_turlar_write on maosh_turlar;
create policy maosh_turlar_write on maosh_turlar for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

drop policy if exists maosh_doimiy_read on maosh_doimiy;
create policy maosh_doimiy_read on maosh_doimiy for select to authenticated using (app_is_admin());
drop policy if exists maosh_doimiy_write on maosh_doimiy;
create policy maosh_doimiy_write on maosh_doimiy for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

grant select, insert, update, delete on maosh_turlar, maosh_doimiy to authenticated;
grant all on maosh_turlar, maosh_doimiy to service_role;

drop trigger if exists maosh_turlar_audit on maosh_turlar;
create trigger maosh_turlar_audit after insert or update or delete on maosh_turlar
  for each row execute function audit_trigger();
drop trigger if exists maosh_doimiy_audit on maosh_doimiy;
create trigger maosh_doimiy_audit after insert or update or delete on maosh_doimiy
  for each row execute function audit_trigger();

-- Tasdiqlangan oy nusxasi
alter table maosh_tasdiq add column if not exists doimiy numeric(14, 0) not null default 0;
alter table maosh_tasdiq add column if not exists doimiy_tafsilot jsonb not null default '[]'::jsonb;


-- ------------------------------------------------------------
-- Jonli hisob: doimiy (± summa) va tafsiloti qo'shiladi
-- ------------------------------------------------------------
drop function if exists ustoz_maosh(text);
drop function if exists maosh_jonli(text);

create function maosh_jonli(p_davr text)
returns table (
  teacher_id  text, ism text, stavka numeric, oquvchilar int, hisob numeric,
  avans numeric, bonus numeric, jarima numeric, tuzatish numeric, yakuniy numeric,
  aniqmas boolean, tasdiqlangan boolean,
  doimiy numeric, doimiy_tafsilot jsonb
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
  ),
  d as (
    select md.teacher_id as tid,
           sum(t.ishora * md.summa) as jami,
           jsonb_agg(jsonb_build_object('nom', t.nom, 'summa', t.ishora * md.summa) order by t.ishora, t.nom) as taf
    from maosh_doimiy md
    join maosh_turlar t on t.id = md.tur_id and t.faol
    join q on q.tid = md.teacher_id and coalesce(q.s, 0) > 0
    where md.dan <= p_davr and (md.gacha is null or md.gacha >= p_davr)
    group by md.teacher_id
  )
  select
    t.id, t.ism, s.qiymati,
    coalesce(q.n, 0)::int,
    coalesce(q.s, 0),
    coalesce(h.av, 0), coalesce(h.bo, 0), coalesce(h.ja, 0), coalesce(h.tu, 0),
    coalesce(q.s, 0) - coalesce(h.av, 0) + coalesce(h.bo, 0) - coalesce(h.ja, 0) + coalesce(h.tu, 0)
      + coalesce(d.jami, 0),
    coalesce(q.aniqmas, false),
    false,
    coalesce(d.jami, 0),
    coalesce(d.taf, '[]'::jsonb)
  from teachers t
  left join teacher_salaries s on s.teacher_id = t.id
  left join q on q.tid = t.id
  left join h on h.tid = t.id
  left join d on d.tid = t.id
  where (t.holat = 'faol' or q.tid is not null or h.tid is not null)
$$;
revoke execute on function maosh_jonli(text) from public, anon, authenticated;
grant execute on function maosh_jonli(text) to service_role;

create function ustoz_maosh(p_davr text)
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
  tasdiqlangan boolean,
  doimiy      numeric,
  doimiy_tafsilot jsonb
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
           m.tuzatish, m.yakuniy, false, true, m.doimiy, m.doimiy_tafsilot
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


-- ------------------------------------------------------------
-- Tasdiq: doimiy summalar ham nusxaga (joyida yamash — 0077/0097 saqlanadi)
-- ------------------------------------------------------------
do $$
declare
  v_def  text := pg_get_functiondef('maosh_tasdiqla(text)'::regprocedure);
  v_ust  text := 'tuzatish, yakuniy, tafsilot, xarajat_id)';
  v_yangi text;
begin
  if v_def like '%doimiy_tafsilot%' then
    return;
  end if;
  if position(v_ust in v_def) = 0 or v_def !~ 'where x\.teacher_id = v_r\.teacher_id\),\s*v_xid\);' then
    raise exception 'maosh_tasdiqla kutilgan ko''rinishda emas';
  end if;
  v_yangi := replace(v_def, v_ust, 'tuzatish, yakuniy, tafsilot, xarajat_id, doimiy, doimiy_tafsilot)');
  v_yangi := regexp_replace(v_yangi,
    'where x\.teacher_id = v_r\.teacher_id\),(\s*)v_xid\);',
    'where x.teacher_id = v_r.teacher_id),\1v_xid, v_r.doimiy, v_r.doimiy_tafsilot);');
  execute v_yangi;
end;
$$;
