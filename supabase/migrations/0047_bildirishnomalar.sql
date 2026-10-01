-- ============================================================
--  0047 — Sayt ichidagi bildirishnomalar (eslatma, e'lon, reklama, so'rovnoma)
--
--  Telegram e'lonidan (elonlar, 0021) alohida: bu — saytga kirganda
--  tepadan qalqib chiqadigan xabar. Admin kimga ko'rinishini tanlaydi
--  (o'quvchi / ota-ona / ustoz / xodim + guruh / fan / qarzdor filtri —
--  elonlar bilan bir xil qoida), muddat beradi; so'rovnomada variantlar.
--
--  Har odam uchun: ko'rdi / yopdi (bildirishnoma_holat) va javobi
--  (bildirishnoma_javoblar). Javob va belgilash faqat funksiyalar orqali.
-- ============================================================

create table if not exists bildirishnomalar (
  id           bigserial primary key,
  turi         text not null default 'eslatma' check (turi in ('eslatma', 'elon', 'reklama', 'sorovnoma')),
  sarlavha     text not null check (length(trim(sarlavha)) between 1 and 120),
  matn         text check (matn is null or length(matn) <= 2000),
  havola       text check (havola is null or havola ~ '^(/|https://)'),
  havola_matn  text check (havola_matn is null or length(havola_matn) <= 40),
  kimga        text[] not null check (kimga <@ array['oquvchi', 'ota_ona', 'ustoz', 'xodim'] and cardinality(kimga) > 0),
  filtr        jsonb not null default '{}'::jsonb,
  muhim        boolean not null default false,
  kop_tanlov   boolean not null default false,
  natija_ochiq boolean not null default true,
  boshlanish   timestamptz not null default now(),
  tugash       timestamptz,
  holat        text not null default 'faol' check (holat in ('faol', 'yopilgan')),
  yaratdi      uuid references profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  check (tugash is null or tugash > boshlanish)
);

comment on table bildirishnomalar is 'Sayt ichidagi bildirishnomalar: saytga kirganda tepadan chiqadi (0047).';
comment on column bildirishnomalar.filtr is '{} · {"guruh":"G05"} · {"fan":"ingliz-tili"} · {"qarzdor":true} — elonlar bilan bir xil';
comment on column bildirishnomalar.muhim is 'Muhim — o''zi yopilmaydi, ekran o''rtasida turadi, javob/yopish shart.';
comment on column bildirishnomalar.natija_ochiq is 'So''rovnoma: ovoz bergan odam natijani ko''radimi.';

create table if not exists bildirishnoma_variantlar (
  id               bigserial primary key,
  bildirishnoma_id bigint not null references bildirishnomalar (id) on delete cascade,
  matn             text not null check (length(trim(matn)) between 1 and 120),
  tartib           int not null default 0
);
create index if not exists bildirishnoma_variantlar_idx on bildirishnoma_variantlar (bildirishnoma_id, tartib);

create table if not exists bildirishnoma_javoblar (
  bildirishnoma_id bigint not null references bildirishnomalar (id) on delete cascade,
  variant_id       bigint not null references bildirishnoma_variantlar (id) on delete cascade,
  profile_id       uuid not null references profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (bildirishnoma_id, variant_id, profile_id)
);

create table if not exists bildirishnoma_holat (
  bildirishnoma_id bigint not null references bildirishnomalar (id) on delete cascade,
  profile_id       uuid not null references profiles (id) on delete cascade,
  korildi_at       timestamptz not null default now(),
  yopildi_at       timestamptz,
  primary key (bildirishnoma_id, profile_id)
);

alter table bildirishnomalar         enable row level security;
alter table bildirishnoma_variantlar enable row level security;
alter table bildirishnoma_javoblar   enable row level security;
alter table bildirishnoma_holat      enable row level security;
alter table bildirishnomalar         force row level security;
alter table bildirishnoma_variantlar force row level security;
alter table bildirishnoma_javoblar   force row level security;
alter table bildirishnoma_holat      force row level security;

grant usage, select on sequence bildirishnomalar_id_seq, bildirishnoma_variantlar_id_seq to authenticated;

-- ------------------------------------------------------------
-- Kimga mo'ljallangan — joriy foydalanuvchi uchun
--   o'quvchi: o'zi (students.profile_id) · ota-ona: farzandi (profiles.oquvchi_id)
--   ustoz: biriktirilgan (teachers.profile_id) · xodim: admin/direktor/qabulxona
--   Bir odam ikki rolda bo'lishi mumkin (Jamshid: admin + ustoz) — biri yetadi.
-- ------------------------------------------------------------
create or replace function bildirishnoma_menga(p_kimga text[], p_filtr jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_guruh   text := nullif(p_filtr ->> 'guruh', '');
  v_fan     text := nullif(p_filtr ->> 'fan', '');
  v_qarzdor boolean := coalesce((p_filtr ->> 'qarzdor')::boolean, false);
  v_student text;
  v_teacher text;
begin
  if auth.uid() is null then return false; end if;

  -- Xodim
  if 'xodim' = any (p_kimga) and app_is_staff() then return true; end if;

  -- Ustoz
  if 'ustoz' = any (p_kimga) then
    v_teacher := app_teacher_id();
    if v_teacher is not null
       and (v_guruh is null or exists (select 1 from groups g where g.id = v_guruh and g.teacher_id = v_teacher))
       and (v_fan is null or exists (select 1 from groups g where g.subject_id = v_fan and g.teacher_id = v_teacher and g.holat = 'faol'))
    then return true; end if;
  end if;

  -- O'quvchi yoki ota-ona — bitta o'quvchi bo'yicha filtr
  if 'oquvchi' = any (p_kimga) then v_student := app_student_id(); end if;
  if v_student is null and 'ota_ona' = any (p_kimga) then
    select oquvchi_id into v_student from profiles where id = auth.uid() and rol = 'ota_ona';
  end if;
  if v_student is null then return false; end if;

  return exists (select 1 from students s where s.id = v_student and s.holat <> 'ketgan')
     and (v_guruh is null or exists (
           select 1 from enrollments e where e.student_id = v_student and e.group_id = v_guruh and e.holat <> 'tugagan'))
     and (v_fan is null or exists (
           select 1 from enrollments e join groups g on g.id = e.group_id
           where e.student_id = v_student and g.subject_id = v_fan and e.holat <> 'tugagan'))
     and (not v_qarzdor or coalesce((select qarz from v_student_balance where student_id = v_student), 0) > 0);
end;
$$;

revoke execute on function bildirishnoma_menga(text[], jsonb) from public, anon;
grant execute on function bildirishnoma_menga(text[], jsonb) to authenticated;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
drop policy if exists bildirishnomalar_oqish on bildirishnomalar;
create policy bildirishnomalar_oqish on bildirishnomalar for select to authenticated
  using (
    app_is_staff()
    or (holat = 'faol' and boshlanish <= now() and (tugash is null or tugash > now())
        and bildirishnoma_menga(kimga, filtr))
  );
drop policy if exists bildirishnomalar_admin on bildirishnomalar;
create policy bildirishnomalar_admin on bildirishnomalar for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

drop policy if exists bildirishnoma_variantlar_oqish on bildirishnoma_variantlar;
create policy bildirishnoma_variantlar_oqish on bildirishnoma_variantlar for select to authenticated
  using (exists (select 1 from bildirishnomalar b where b.id = bildirishnoma_id));
drop policy if exists bildirishnoma_variantlar_admin on bildirishnoma_variantlar;
create policy bildirishnoma_variantlar_admin on bildirishnoma_variantlar for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- Javob va holat: o'ziniki ko'rinadi, xodim hammasini; yozish — faqat funksiyalar
drop policy if exists bildirishnoma_javoblar_oqish on bildirishnoma_javoblar;
create policy bildirishnoma_javoblar_oqish on bildirishnoma_javoblar for select to authenticated
  using (profile_id = auth.uid() or app_is_staff());
drop policy if exists bildirishnoma_holat_oqish on bildirishnoma_holat;
create policy bildirishnoma_holat_oqish on bildirishnoma_holat for select to authenticated
  using (profile_id = auth.uid() or app_is_staff());

-- ------------------------------------------------------------
-- Amallar
-- ------------------------------------------------------------

-- Ko'rdi / yopdi (p_yopildi = true — boshqa qalqib chiqmaydi)
create or replace function bildirishnoma_belgila(p_id bigint, p_yopildi boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Kirish kerak.'; end if;
  if not exists (select 1 from bildirishnomalar b where b.id = p_id and bildirishnoma_menga(b.kimga, b.filtr)) then
    return;   -- o'ziga tegishli emas — jim o'tkaziladi
  end if;
  insert into bildirishnoma_holat (bildirishnoma_id, profile_id, yopildi_at)
  values (p_id, auth.uid(), case when p_yopildi then now() end)
  on conflict (bildirishnoma_id, profile_id) do update
    set yopildi_at = coalesce(bildirishnoma_holat.yopildi_at, excluded.yopildi_at);
end;
$$;

-- So'rovnomaga javob: ovozni almashtirsa bo'ladi (so'rovnoma ochiq ekan)
create or replace function sorovnomaga_javob(p_id bigint, p_variantlar bigint[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_b bildirishnomalar;
  v_soni int := coalesce(cardinality(p_variantlar), 0);
begin
  if auth.uid() is null then raise exception 'Kirish kerak.'; end if;
  select * into v_b from bildirishnomalar where id = p_id;
  if v_b.id is null or v_b.turi <> 'sorovnoma' then raise exception 'So''rovnoma topilmadi.'; end if;
  if v_b.holat <> 'faol' or v_b.boshlanish > now() or (v_b.tugash is not null and v_b.tugash <= now()) then
    raise exception 'So''rovnoma yopilgan.';
  end if;
  if not bildirishnoma_menga(v_b.kimga, v_b.filtr) then raise exception 'Bu so''rovnoma siz uchun emas.'; end if;
  if v_soni = 0 then raise exception 'Variantni tanlang.'; end if;
  if not v_b.kop_tanlov and v_soni > 1 then raise exception 'Faqat bitta variant tanlanadi.'; end if;
  if exists (select 1 from unnest(p_variantlar) v
             where not exists (select 1 from bildirishnoma_variantlar x where x.id = v and x.bildirishnoma_id = p_id)) then
    raise exception 'Variant noto''g''ri.';
  end if;

  delete from bildirishnoma_javoblar where bildirishnoma_id = p_id and profile_id = auth.uid();
  insert into bildirishnoma_javoblar (bildirishnoma_id, variant_id, profile_id)
  select p_id, v, auth.uid() from (select distinct unnest(p_variantlar) as v) x;

  insert into bildirishnoma_holat (bildirishnoma_id, profile_id, yopildi_at)
  values (p_id, auth.uid(), now())
  on conflict (bildirishnoma_id, profile_id) do update set yopildi_at = coalesce(bildirishnoma_holat.yopildi_at, now());
end;
$$;

-- Natija: xodim har doim; ovoz bergan — natija_ochiq bo'lsa
create or replace function sorovnoma_natija(p_id bigint)
returns table (variant_id bigint, matn text, ovoz bigint, jami bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (app_is_staff() or exists (
      select 1 from bildirishnomalar b
      where b.id = p_id and b.natija_ochiq
        and exists (select 1 from bildirishnoma_javoblar j where j.bildirishnoma_id = p_id and j.profile_id = auth.uid()))) then
    raise exception 'Natija ko''rsatilmaydi.';
  end if;
  return query
    select v.id, v.matn,
           (select count(*) from bildirishnoma_javoblar j where j.variant_id = v.id),
           (select count(distinct j.profile_id) from bildirishnoma_javoblar j where j.bildirishnoma_id = p_id)
    from bildirishnoma_variantlar v
    where v.bildirishnoma_id = p_id
    order by v.tartib, v.id;
end;
$$;

-- Admin uchun statistika: ko'rdi / yopdi / javob berdi
create or replace function bildirishnoma_statistika()
returns table (bildirishnoma_id bigint, korgan bigint, yopgan bigint, javob_bergan bigint)
language sql stable security definer set search_path = public as $$
  select b.id,
         (select count(*) from bildirishnoma_holat h where h.bildirishnoma_id = b.id),
         (select count(*) from bildirishnoma_holat h where h.bildirishnoma_id = b.id and h.yopildi_at is not null),
         (select count(distinct j.profile_id) from bildirishnoma_javoblar j where j.bildirishnoma_id = b.id)
  from bildirishnomalar b
  where app_is_staff()
$$;

revoke execute on function bildirishnoma_belgila(bigint, boolean) from public, anon;
revoke execute on function sorovnomaga_javob(bigint, bigint[]) from public, anon;
revoke execute on function sorovnoma_natija(bigint) from public, anon;
revoke execute on function bildirishnoma_statistika() from public, anon;
grant execute on function bildirishnoma_belgila(bigint, boolean) to authenticated;
grant execute on function sorovnomaga_javob(bigint, bigint[]) to authenticated;
grant execute on function sorovnoma_natija(bigint) to authenticated;
grant execute on function bildirishnoma_statistika() to authenticated;

-- ------------------------------------------------------------
-- Menga tegishli faol bildirishnomalar (xodim ham faqat O'ZINIKINI ko'radi —
-- RLS esa unga hammasini beradi, shuning uchun alohida funksiya)
-- ------------------------------------------------------------
create or replace function mening_bildirishnomalarim()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.muhim desc, x.created_at desc), '[]'::jsonb)
  from (
    select b.id, b.turi, b.sarlavha, b.matn, b.havola, b.havola_matn, b.muhim,
           b.kop_tanlov, b.natija_ochiq, b.created_at,
           h.korildi_at is not null as korilgan,
           h.yopildi_at is not null as yopilgan,
           exists (select 1 from bildirishnoma_javoblar j where j.bildirishnoma_id = b.id and j.profile_id = auth.uid()) as javob_berdim,
           coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'matn', v.matn) order by v.tartib, v.id)
                     from bildirishnoma_variantlar v where v.bildirishnoma_id = b.id), '[]'::jsonb) as variantlar
    from bildirishnomalar b
    left join bildirishnoma_holat h on h.bildirishnoma_id = b.id and h.profile_id = auth.uid()
    where auth.uid() is not null
      and b.holat = 'faol' and b.boshlanish <= now() and (b.tugash is null or b.tugash > now())
      and bildirishnoma_menga(b.kimga, b.filtr)
    order by b.created_at desc
    limit 30
  ) x
$$;

revoke execute on function mening_bildirishnomalarim() from public, anon;
grant execute on function mening_bildirishnomalarim() to authenticated;
