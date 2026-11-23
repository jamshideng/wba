-- ============================================================
--  World Bridge Academy
--  0142_kitoblar.sql · KITOBLAR HISOBI (Jamshid, 23.11)
--
--  Nechta kitob keldi, kimga nechta berildi, nechtasi qoldi.
--  Kitob kurs narxiga kiradi — to'lov va qarzga TEGILMAYDI.
--
--  Oqim (Woblar market kod mexanizmi kabi):
--    1. direktor/admin/manager katalogga kitob qo'shadi, kirim kiritadi
--    2. ustoz o'z guruhidagi o'quvchilarni belgilab buyurtma beradi →
--       soni = belgilanganlar soni, kod beriladi (KT-XXXXXX)
--    3. direktor/admin/manager kodni kiritib "Berildi" bosadi
--       yoki sabab bilan bekor qiladi
--
--  Qoldiq:
--    omborda = kirim − berildi       (FAQAT "berildi"dan keyin kamayadi)
--    band    = kutilayotgan buyurtmalar
--    bo'sh   = omborda − band        (yangi buyurtma shundan oshmaydi)
--
--  Ruxsat: direktor/admin/manager (app_is_admin) — hammasi.
--  Ustoz — faqat o'z buyurtmalari va o'quvchilari. O'quvchi/ota-ona — yopiq.
--  Kirim, berish, bekor — audit_log'ga (audit_trigger).
-- ============================================================


-- ------------------------------------------------------------
-- 1. Jadvallar
-- ------------------------------------------------------------

create table if not exists kitoblar (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null check (length(trim(nom)) > 0),
  subject_id  text references subjects (id) on delete set null,
  holat       text not null default 'faol' check (holat in ('faol', 'arxiv')),
  created_by  uuid references profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table kitoblar is 'Kitoblar katalogi (0142). Kurs narxiga kiradi — to''lovga bog''lanmaydi.';

create table if not exists kitob_kirim (
  id          uuid primary key default gen_random_uuid(),
  sana        date not null default current_date,
  kitob_id    uuid not null references kitoblar (id) on delete restrict,
  soni        int  not null check (soni between 1 and 10000),
  izoh        text,
  kiritdi     uuid references profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists kitob_kirim_kitob_idx on kitob_kirim (kitob_id, sana desc);
comment on table kitob_kirim is 'Kitob kirimi (0142). O''chirilmaydi — xato bo''lsa audit orqali ko''rinadi.';

create table if not exists kitob_buyurtmalar (
  id            uuid primary key default gen_random_uuid(),
  kod           text not null unique,
  kitob_id      uuid not null references kitoblar (id) on delete restrict,
  kitob_nomi    text not null,
  teacher_id    text references teachers (id) on delete set null,
  group_id      text references groups (id) on delete set null,
  soni          int  not null check (soni between 1 and 100),
  holat         text not null default 'kutilmoqda' check (holat in ('kutilmoqda', 'berildi', 'bekor')),
  buyurtmachi   uuid references profiles (id) on delete set null,
  berdi         uuid references profiles (id) on delete set null,
  berildi_vaqt  timestamptz,
  bekor_sabab   text,
  bekor_qildi   uuid references profiles (id) on delete set null,
  bekor_vaqt    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists kitob_buyurtmalar_holat_idx on kitob_buyurtmalar (holat, created_at desc);
create index if not exists kitob_buyurtmalar_kitob_idx on kitob_buyurtmalar (kitob_id, holat);
create index if not exists kitob_buyurtmalar_ustoz_idx on kitob_buyurtmalar (teacher_id, created_at desc);

create table if not exists kitob_buyurtma_oquvchilar (
  buyurtma_id uuid not null references kitob_buyurtmalar (id) on delete cascade,
  student_id  text not null references students (id) on delete restrict,
  primary key (buyurtma_id, student_id)
);
create index if not exists kitob_buyurtma_oquvchilar_st_idx on kitob_buyurtma_oquvchilar (student_id);

drop trigger if exists kitoblar_audit on kitoblar;
create trigger kitoblar_audit after insert or update or delete on kitoblar
  for each row execute function audit_trigger();
drop trigger if exists kitob_kirim_audit on kitob_kirim;
create trigger kitob_kirim_audit after insert or update or delete on kitob_kirim
  for each row execute function audit_trigger();
drop trigger if exists kitob_buyurtmalar_audit on kitob_buyurtmalar;
create trigger kitob_buyurtmalar_audit after insert or update or delete on kitob_buyurtmalar
  for each row execute function audit_trigger();


-- ------------------------------------------------------------
-- 2. RLS
-- ------------------------------------------------------------

alter table kitoblar                  enable row level security;
alter table kitob_kirim               enable row level security;
alter table kitob_buyurtmalar         enable row level security;
alter table kitob_buyurtma_oquvchilar enable row level security;

/* Katalog: rahbariyat yozadi; ustoz faqat o'qiydi (buyurtma uchun) */
drop policy if exists kitoblar_read on kitoblar;
create policy kitoblar_read on kitoblar for select to authenticated
  using (app_is_admin() or app_teacher_id() is not null);
drop policy if exists kitoblar_write on kitoblar;
create policy kitoblar_write on kitoblar for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

/* Kirim: faqat rahbariyat; tahrir/o'chirish yo'q (insert-only) */
drop policy if exists kitob_kirim_read on kitob_kirim;
create policy kitob_kirim_read on kitob_kirim for select to authenticated
  using (app_is_admin());
drop policy if exists kitob_kirim_insert on kitob_kirim;
create policy kitob_kirim_insert on kitob_kirim for insert to authenticated
  with check (app_is_admin());

/* Buyurtmalar: faqat funksiyalar yozadi; o'qish — rahbariyat yoki o'z buyurtmasi */
drop policy if exists kitob_buyurtmalar_read on kitob_buyurtmalar;
create policy kitob_buyurtmalar_read on kitob_buyurtmalar for select to authenticated
  using (app_is_admin() or (teacher_id is not null and teacher_id = app_teacher_id()));

drop policy if exists kitob_buyurtma_oquvchilar_read on kitob_buyurtma_oquvchilar;
create policy kitob_buyurtma_oquvchilar_read on kitob_buyurtma_oquvchilar for select to authenticated
  using (exists (
    select 1 from kitob_buyurtmalar b
    where b.id = buyurtma_id
      and (app_is_admin() or (b.teacher_id is not null and b.teacher_id = app_teacher_id()))
  ));

revoke all on kitoblar, kitob_kirim, kitob_buyurtmalar, kitob_buyurtma_oquvchilar from anon;


-- ------------------------------------------------------------
-- 3. Qoldiq
-- ------------------------------------------------------------

create or replace function kitob_qoldiq()
returns table (
  kitob_id uuid, nom text, subject_id text, holat text,
  kelgan int, berilgan int, band int, omborda int, bosh int
)
language sql stable security definer set search_path = public as $$
  select k.id, k.nom, k.subject_id, k.holat,
         coalesce(ki.n, 0)::int                                    as kelgan,
         coalesce(b.berilgan, 0)::int                              as berilgan,
         coalesce(b.band, 0)::int                                  as band,
         (coalesce(ki.n, 0) - coalesce(b.berilgan, 0))::int        as omborda,
         (coalesce(ki.n, 0) - coalesce(b.berilgan, 0) - coalesce(b.band, 0))::int as bosh
  from kitoblar k
  left join lateral (select sum(soni) as n from kitob_kirim where kitob_id = k.id) ki on true
  left join lateral (
    select sum(soni) filter (where holat = 'berildi')    as berilgan,
           sum(soni) filter (where holat = 'kutilmoqda') as band
    from kitob_buyurtmalar where kitob_id = k.id
  ) b on true
  where app_is_admin() or app_teacher_id() is not null
  order by k.holat, k.nom
$$;


-- ------------------------------------------------------------
-- 4. Buyurtma / berildi / bekor
-- ------------------------------------------------------------

/* KT-XXXXXX: chalkashtiradigan belgilarsiz (0/O, 1/I yo'q) */
create or replace function kitob_kod() returns text
language plpgsql volatile set search_path = public as $$
declare
  v_harflar constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_kod text;
begin
  loop
    v_kod := 'KT-';
    for i in 1..6 loop
      v_kod := v_kod || substr(v_harflar, 1 + floor(random() * length(v_harflar))::int, 1);
    end loop;
    exit when not exists (select 1 from kitob_buyurtmalar where kod = v_kod);
  end loop;
  return v_kod;
end;
$$;

create or replace function kitob_buyurtma(p_kitob uuid, p_group text, p_oquvchilar text[])
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_ustoz  text := app_teacher_id();
  v_k      kitoblar;
  v_ids    text[];
  v_soni   int;
  v_bosh   int;
  v_kod    text;
  v_id     uuid;
begin
  if v_ustoz is null then
    raise exception 'Kitob buyurtmasini ustoz o''z guruhi uchun beradi.';
  end if;
  if not app_teaches_group(p_group) then
    raise exception 'Bu guruh sizniki emas.';
  end if;

  select array_agg(distinct x) into v_ids
  from unnest(coalesce(p_oquvchilar, '{}')) x where nullif(trim(x), '') is not null;
  v_soni := coalesce(array_length(v_ids, 1), 0);
  if v_soni = 0 then
    raise exception 'Kamida bitta o''quvchini belgilang.';
  end if;
  if v_soni > 100 then
    raise exception 'Bitta buyurtmada 100 tadan ko''p bo''lmaydi.';
  end if;

  -- Hamma belgilanganlar shu guruhda o'qiydi
  if exists (
    select 1 from unnest(v_ids) s
    where not exists (
      select 1 from enrollments e
      where e.student_id = s and e.group_id = p_group and e.holat <> 'tugagan'
    )
  ) then
    raise exception 'Belgilangan o''quvchilardan biri bu guruhda emas.';
  end if;

  -- Bir kitob bo'yicha buyurtmalar navbat bilan (ikki ustoz bir vaqtda ortiqcha ololmaydi)
  select * into v_k from kitoblar where id = p_kitob for update;
  if v_k.id is null or v_k.holat <> 'faol' then
    raise exception 'Bu kitob hozir berilmaydi (arxivda yoki topilmadi).';
  end if;

  select q.bosh into v_bosh from kitob_qoldiq() q where q.kitob_id = p_kitob;
  if coalesce(v_bosh, 0) < v_soni then
    raise exception 'Omborda yetarli emas: % ta bo''sh, kerak %.', greatest(coalesce(v_bosh, 0), 0), v_soni;
  end if;

  -- Buyurtma — uni bergan ustoz nomidan (zamena ustozi bersa, uning o'zi ko'radi)
  v_kod := kitob_kod();
  insert into kitob_buyurtmalar (kod, kitob_id, kitob_nomi, teacher_id, group_id, soni, buyurtmachi)
  values (v_kod, v_k.id, v_k.nom, v_ustoz, p_group, v_soni, auth.uid())
  returning id into v_id;

  insert into kitob_buyurtma_oquvchilar (buyurtma_id, student_id)
  select v_id, s from unnest(v_ids) s;

  return v_kod;
end;
$$;

create or replace function kitob_berildi(p_kod text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_admin() then
    raise exception 'Kitobni direktor, admin yoki manager beradi.';
  end if;
  update kitob_buyurtmalar
     set holat = 'berildi', berdi = auth.uid(), berildi_vaqt = now()
   where kod = upper(trim(p_kod)) and holat = 'kutilmoqda';
  if not found then
    raise exception 'Kod topilmadi yoki buyurtma allaqachon yopilgan.';
  end if;
end;
$$;

create or replace function kitob_bekor(p_kod text, p_sabab text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_b kitob_buyurtmalar;
begin
  if nullif(trim(p_sabab), '') is null then
    raise exception 'Bekor qilish sababini yozing.';
  end if;
  select * into v_b from kitob_buyurtmalar where kod = upper(trim(p_kod)) for update;
  if v_b.id is null or v_b.holat <> 'kutilmoqda' then
    raise exception 'Kod topilmadi yoki buyurtma allaqachon yopilgan.';
  end if;
  -- Rahbariyat istalganini, ustoz faqat o'zinikini bekor qiladi
  if not app_is_admin() and (v_b.teacher_id is null or v_b.teacher_id is distinct from app_teacher_id()) then
    raise exception 'Bu buyurtmani bekor qila olmaysiz.';
  end if;

  update kitob_buyurtmalar
     set holat = 'bekor', bekor_sabab = trim(p_sabab), bekor_qildi = auth.uid(), bekor_vaqt = now()
   where id = v_b.id;
end;
$$;

revoke execute on function kitob_kod() from public, anon, authenticated;
revoke execute on function kitob_qoldiq() from public, anon;
grant  execute on function kitob_qoldiq() to authenticated, service_role;
revoke execute on function kitob_buyurtma(uuid, text, text[]) from public, anon;
grant  execute on function kitob_buyurtma(uuid, text, text[]) to authenticated, service_role;
revoke execute on function kitob_berildi(text) from public, anon;
grant  execute on function kitob_berildi(text) to authenticated, service_role;
revoke execute on function kitob_bekor(text, text) from public, anon;
grant  execute on function kitob_bekor(text, text) to authenticated, service_role;
