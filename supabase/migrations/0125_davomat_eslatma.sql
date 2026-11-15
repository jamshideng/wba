-- ============================================================
-- 0125 — davomat qilinmasa ustozga eslatma (Jamshid, 11.11)
--
-- 1. davomat_eslatma: bitta guruh + sana + tur (1 — tugagach 10 daq,
--    2 — 60 daq) uchun bitta qator. unique(group_id, sana, turi) —
--    cron ikki marta ishlasa ham ikkinchi xabar ketmaydi: yuborishdan
--    OLDIN qator band qilinadi.
-- 2. "Davomat qilingan" = o'sha kuni guruhdagi HAR BIR faol o'quvchiga
--    belgi qo'yilgan (Jamshid tanlovi). Bitta belgi yetmaydi.
-- 3. Dars kuni: guruh_dars_kuni (ko'chirilgan dars hisobga olinadi);
--    dam kuni (0036) — dars yo'q, agar shu kunga ko'chirilgan dars bo'lmasa.
--    Ustoz — dars_ustozi (zamena bo'lsa o'rinbosar).
-- 4. Davomat to'liq bo'lgach eslatma va saytdagi bildirishnoma o'zi
--    yopiladi (attendance trigger).
-- 5. Zamena kuni davomatni faqat o'rinbosar ustoz (yoki admin) qiladi —
--    guruh ustozida o'sha kun yopiq (ko'chirilgan kun kabi).
-- 6. pg_cron har 5 daqiqada /api/cron/davomat ni chaqiradi; kalit
--    Supabase Vault'da ('cron_sir'), migratsiyada kalit yo'q.
-- Kech dars: ustoz faqat bugungi davomatni kiritadi (0085) — o'zgarmadi;
-- eslatma vaqti yarim tundan o'tsa, u yuborilmaydi (ilova tomonda).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Jadval
-- ------------------------------------------------------------
create table if not exists davomat_eslatma (
  id               bigserial primary key,
  group_id         text not null references groups (id) on delete cascade,
  sana             date not null,
  turi             smallint not null check (turi in (1, 2)),
  teacher_id       text references teachers (id) on delete set null,
  jami             int,
  belgilangan      int,
  telegram         text not null default 'kutilmoqda'
                   check (telegram in ('kutilmoqda', 'yetkazildi', 'ulanmagan', 'xato')),
  telegram_xato    text,
  bildirishnoma_id bigint references bildirishnomalar (id) on delete set null,
  hal_qilindi_at   timestamptz,
  created_at       timestamptz not null default now(),
  unique (group_id, sana, turi)
);

create index if not exists davomat_eslatma_ochiq on davomat_eslatma (group_id, sana) where hal_qilindi_at is null;
create index if not exists davomat_eslatma_ustoz on davomat_eslatma (teacher_id, sana desc);

comment on table davomat_eslatma is
  'Davomat qilinmagan dars uchun ustozga eslatma (0125). turi 1 — tugagach 10 daq, 2 — 60 daq. Yozish faqat cron (service_role) va trigger orqali.';

alter table davomat_eslatma enable row level security;
alter table davomat_eslatma force row level security;

-- Ustoz faqat o'zinikini, admin/direktor hammasini ko'radi; yozish — faqat service_role
drop policy if exists davomat_eslatma_oqish on davomat_eslatma;
create policy davomat_eslatma_oqish on davomat_eslatma for select to authenticated
  using (app_is_admin() or teacher_id = app_teacher_id());

revoke all on davomat_eslatma from public, anon, authenticated;
grant select on davomat_eslatma to authenticated;
grant all on davomat_eslatma to service_role;
grant usage, select on sequence davomat_eslatma_id_seq to service_role;

-- ------------------------------------------------------------
-- 2. O'sha kun davomati: nechta faol o'quvchi, nechtasiga belgi bor
-- ------------------------------------------------------------
create or replace function davomat_holati(p_group text, p_sana date, out jami int, out belgilangan int)
language sql stable security definer set search_path = public as $$
  select count(*)::int,
         count(a.student_id)::int
  from enrollments e
  left join lessons l on l.group_id = e.group_id and l.sana = p_sana
  left join attendance a on a.lesson_id = l.id and a.student_id = e.student_id
  where e.group_id = p_group
    and e.holat = 'faol'
    and e.boshlandi <= p_sana
    and (e.tugadi is null or e.tugadi >= p_sana)
$$;

revoke execute on function davomat_holati(text, date) from public, anon, authenticated;
grant execute on function davomat_holati(text, date) to service_role;

-- ------------------------------------------------------------
-- 3. Nomzodlar: bugun darsi tugagan, davomati to'liq bo'lmagan guruhlar.
--    Qaysi eslatma (1/2) vaqti kelgani — ilovada (src/lib/davomat-eslatma.ts).
-- ------------------------------------------------------------
create or replace function davomat_eslatma_nomzodlar()
returns table (
  group_id    text,
  nom         text,
  teacher_id  text,
  profile_id  uuid,
  boshlanish  time,
  tugash      time,
  jami        int,
  belgilangan int,
  yuborilgan  smallint[]
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_bugun date := bugun_toshkent();
  v_soat  time := (now() at time zone 'Asia/Tashkent')::time;
begin
  if auth.uid() is not null then
    raise exception 'Faqat cron (service_role).';
  end if;

  return query
  with g as (
    select g.id, g.nom, g.boshlanish, g.tugash, dars_ustozi(g.id, v_bugun) as ustoz
    from groups g
    where g.holat = 'faol'
      and g.tugash is not null
      and g.tugash <= v_soat
      and guruh_dars_kuni(g.id, v_bugun)
      and (not dam_kunimi(v_bugun)
           or exists (select 1 from lessons l
                      where l.group_id = g.id and l.sana = v_bugun and l.kochirilgan_dan is not null))
  )
  select g.id, g.nom, g.ustoz, t.profile_id, g.boshlanish, g.tugash, h.jami, h.belgilangan,
         coalesce((select array_agg(d.turi order by d.turi) from davomat_eslatma d
                   where d.group_id = g.id and d.sana = v_bugun), '{}')::smallint[]
  from g
  join teachers t on t.id = g.ustoz
  cross join lateral davomat_holati(g.id, v_bugun) h
  where h.jami > 0 and h.belgilangan < h.jami;
end;
$$;

revoke execute on function davomat_eslatma_nomzodlar() from public, anon, authenticated;
grant execute on function davomat_eslatma_nomzodlar() to service_role;

-- ------------------------------------------------------------
-- 4. Davomat to'liq bo'ldi → eslatma "hal qilindi", bildirishnoma yopiladi
-- ------------------------------------------------------------
create or replace function davomat_eslatma_yop() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group text;
  v_sana  date;
  v_h     record;
begin
  select l.group_id, l.sana into v_group, v_sana from lessons l where l.id = new.lesson_id;
  if v_group is null then return null; end if;

  -- Ochiq eslatma kam bo'ladi — avval shuni tekshiramiz, keyin sanaymiz
  if not exists (select 1 from davomat_eslatma d
                 where d.group_id = v_group and d.sana = v_sana and d.hal_qilindi_at is null) then
    return null;
  end if;

  select * into v_h from davomat_holati(v_group, v_sana);
  if v_h.belgilangan < v_h.jami then return null; end if;

  update bildirishnomalar b set holat = 'yopilgan'
  where b.holat = 'faol'
    and b.id in (select d.bildirishnoma_id from davomat_eslatma d
                 where d.group_id = v_group and d.sana = v_sana and d.hal_qilindi_at is null);

  update davomat_eslatma d set hal_qilindi_at = now(), belgilangan = v_h.belgilangan, jami = v_h.jami
  where d.group_id = v_group and d.sana = v_sana and d.hal_qilindi_at is null;

  return null;
end;
$$;

drop trigger if exists attendance_davomat_eslatma on attendance;
create trigger attendance_davomat_eslatma
  after insert or update on attendance
  for each row execute function davomat_eslatma_yop();

-- ------------------------------------------------------------
-- 5. Zamena kuni: davomatni o'rinbosar ustoz (yoki admin) qiladi.
--    0085 dagi davomat_belgila + bitta tekshiruv.
-- ------------------------------------------------------------
create or replace function davomat_belgila(
  p_group    text,
  p_sana     date,
  p_belgilar jsonb
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_dars   uuid;
  v_kunlar smallint[];
  v_soni   int := 0;
  v_ochir  int := 0;
  v_zamena text;
begin
  if auth.uid() is not null and not (app_teaches_group(p_group) or app_is_admin()) then
    raise exception 'Bu guruhga davomat qo''yish huquqingiz yo''q.';
  end if;

  if p_sana > bugun_toshkent() then
    raise exception 'Kelasi kunga davomat qo''yib bo''lmaydi.';
  end if;

  if auth.uid() is not null and not app_is_admin() and p_sana < bugun_toshkent() then
    raise exception 'O''tgan kun davomatini faqat admin tuzatadi.';
  end if;

  -- 0125: zamena berilgan kun guruh ustozida yopiq
  if auth.uid() is not null and not app_is_admin() then
    select l.zamena_teacher_id into v_zamena from lessons l where l.group_id = p_group and l.sana = p_sana;
    if v_zamena is not null and v_zamena is distinct from app_teacher_id() then
      raise exception 'Bu kun zamena: davomatni o''rinbosar ustoz qiladi.';
    end if;
  end if;

  select kunlar into v_kunlar from groups where id = p_group;
  if v_kunlar is null then
    raise exception 'Guruh topilmadi.';
  end if;

  select id into v_dars from lessons where group_id = p_group and sana = p_sana;

  if v_dars is null and not guruh_dars_kunimi(v_kunlar, p_sana) then
    raise exception 'Bu kun guruhning dars kuni emas.';
  end if;

  if v_dars is null then
    insert into lessons (group_id, sana, otkazildi)
    values (p_group, p_sana, true)
    on conflict (group_id, sana) do update set otkazildi = true
    returning id into v_dars;
  else
    update lessons set otkazildi = true where id = v_dars and not otkazildi;
  end if;

  -- null → belgini olib tashlash
  delete from attendance a
  using jsonb_each(coalesce(p_belgilar, '{}'::jsonb)) kv
  where a.lesson_id = v_dars
    and a.student_id = kv.key
    and jsonb_typeof(kv.value) = 'null';
  get diagnostics v_ochir = row_count;

  insert into attendance (lesson_id, student_id, holat, belgiladi)
  select v_dars, kv.key, (kv.value #>> '{}')::attendance_status, auth.uid()
  from jsonb_each(coalesce(p_belgilar, '{}'::jsonb)) kv
  where jsonb_typeof(kv.value) = 'string'
    and exists (
      select 1 from enrollments e
      where e.student_id = kv.key and e.group_id = p_group and e.holat <> 'tugagan'
    )
  on conflict (lesson_id, student_id) do update
    set holat = excluded.holat, belgiladi = excluded.belgiladi, updated_at = now();
  get diagnostics v_soni = row_count;

  -- 0085: belgi qolmadi (va mavzu/woblar yo'q) — dars o'tilmagan hisoblanadi
  update lessons l set otkazildi = false
  where l.id = v_dars and l.otkazildi and l.mavzu is null
    and not exists (select 1 from attendance a where a.lesson_id = l.id)
    and not exists (select 1 from woblr w where w.lesson_id = l.id);

  return v_soni + v_ochir;
end;
$$;

revoke execute on function davomat_belgila(text, date, jsonb) from public, anon;
grant  execute on function davomat_belgila(text, date, jsonb) to authenticated, service_role;

-- ------------------------------------------------------------
-- 6. Jadval: har 5 daqiqa (kalit — Vault 'cron_sir', bo'lmasa 401)
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron/pg_net yo''q — davomat eslatmasi jadvali qo''yilmadi (lokal test).';
    return;
  end if;
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.unschedule(jobid) from cron.job where jobname = 'davomat-eslatma';
  perform cron.schedule('davomat-eslatma', '*/5 * * * *', $c$
    select net.http_post(
      url := 'https://wbalc.uz/api/cron/davomat',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_sir'), '')),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000)
  $c$);
end $$;
