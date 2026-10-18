-- ============================================================
--  0077 — MANAGER: huquqlar, nazorat, ogohlantirish, jarima, admin maoshi
-- ============================================================
--  Jamshid (17–18.10):
--    * manager — admin bilan deyarli bir xil, lavozimi baland (direktordan past):
--      app_is_admin / app_is_staff ichida; app_is_manager = manager yoki direktor.
--      Manager rolini faqat direktor yoki manager beradi/oladi.
--    * Nazorat (nazorat_hodisalar) — avtomatik yig'iladi (cron, har 30 daqiqa):
--        ustoz: kechikdi · davomat qilinmadi (kun oxiri, 21:00) ·
--               o'quvchi ketma-ket 3 dars kelmadi · woblar berilmadi (21:00)
--        admin: lid qo'ng'irog'i kechikdi · vazifa muddati o'tdi ·
--               qarzdorga oy ichida eslatma qilinmadi (oy oxiri) ·
--               to'lov kech kiritildi · to'lov 2 kundan beri tasdiqlanmagan
--      Managerga sayt + Telegram xabari (route /api/cron/nazorat).
--    * Ogohlantirish — manager tayyor matn bilan yuboradi; oy ichida 3 tadan
--      keyin manager jarima qo'llay oladi (summani o'zi yozadi).
--    * Admin maoshi: oylik (xodim_oylik) ± avans/bonus/jarima/tuzatish;
--      admin yozuvlarini faqat manager/direktor kiritadi; direktor tasdig'i bilan
--      xarajatlarga tushadi (ustozlar bilan birga).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Rol huquqlari
-- ------------------------------------------------------------
create or replace function app_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_rol() in ('admin', 'direktor', 'manager'), false)
$$;

create or replace function app_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_rol() in ('admin', 'direktor', 'qabulxona', 'manager'), false)
$$;

/* Admin ustidan nazorat: manager va direktor */
create or replace function app_is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_rol() in ('manager', 'direktor'), false)
$$;
revoke execute on function app_is_manager() from public, anon;
grant execute on function app_is_manager() to authenticated, service_role;

/* Telegram ulash, e'lon oluvchilar, push — xodim ro'yxatiga manager ham */
do $$
declare
  v_f   record;
  v_def text;
begin
  for v_f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname in ('bildirishnoma_profilga', 'elon_oluvchilar', 'telegram_ula_telefon', 'telegram_ula_token')
  loop
    v_def := pg_get_functiondef(v_f.oid);
    if v_def like '%''admin'', ''direktor'', ''qabulxona'')%' then
      execute replace(v_def, '''admin'', ''direktor'', ''qabulxona'')', '''admin'', ''direktor'', ''qabulxona'', ''manager'')');
    end if;
  end loop;
end $$;

/* Manager rolini faqat direktor yoki manager beradi; direktorni — faqat direktor */
create or replace function profiles_rol_himoya() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or new.rol is not distinct from old.rol then
    return new;
  end if;

  if new.id = auth.uid() then
    raise exception 'O''z rolingizni o''zgartirib bo''lmaydi.';
  end if;

  if (new.rol = 'direktor' or old.rol = 'direktor') and not app_is_direktor() then
    raise exception 'Direktor rolini faqat direktor bera oladi yoki olib qo''ya oladi.';
  end if;

  if (new.rol = 'manager' or old.rol = 'manager') and not app_is_manager() then
    raise exception 'Manager rolini faqat direktor yoki manager bera oladi.';
  end if;

  return new;
end;
$$;

/* Bildirishnoma: bitta xodimga ({"profil": uuid}) yoki managerlarga ({"rol": "manager"}) */
create or replace function bildirishnoma_menga(p_kimga text[], p_filtr jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_guruh   text := nullif(p_filtr ->> 'guruh', '');
  v_fan     text := nullif(p_filtr ->> 'fan', '');
  v_oquvchi text := nullif(p_filtr ->> 'oquvchi', '');
  v_ustozf  text := nullif(p_filtr ->> 'ustoz', '');
  v_profil  text := nullif(p_filtr ->> 'profil', '');
  v_rolf    text := nullif(p_filtr ->> 'rol', '');
  v_qarzdor boolean := coalesce((p_filtr ->> 'qarzdor')::boolean, false);
  v_student text;
  v_teacher text;
begin
  if auth.uid() is null then return false; end if;

  -- 0077: bitta odamga yoki managerlarga
  if v_profil is not null then return auth.uid()::text = v_profil; end if;
  if v_rolf = 'manager' then return app_is_manager(); end if;

  -- Xodim (bitta o'quvchiga mo'ljallangan xabar xodimga chiqmaydi)
  if v_oquvchi is null and v_ustozf is null and 'xodim' = any (p_kimga) and app_is_staff() then return true; end if;

  -- Ustoz
  if v_oquvchi is null and 'ustoz' = any (p_kimga) then
    v_teacher := app_teacher_id();
    if v_teacher is not null
       and (v_guruh is null or exists (select 1 from groups g where g.id = v_guruh and g.teacher_id = v_teacher))
       and (v_ustozf is null or v_teacher = v_ustozf)
       and (v_fan is null or exists (select 1 from groups g where g.subject_id = v_fan and g.teacher_id = v_teacher and g.holat = 'faol'))
    then return true; end if;
  end if;

  -- Bitta ustozga mo'ljallangan xabar o'quvchi/ota-onaga chiqmaydi
  if v_ustozf is not null then return false; end if;

  -- O'quvchi yoki ota-ona — bitta o'quvchi bo'yicha filtr
  if 'oquvchi' = any (p_kimga) then v_student := app_student_id(); end if;
  if v_student is null and 'ota_ona' = any (p_kimga) then
    select oquvchi_id into v_student from profiles where id = auth.uid() and rol = 'ota_ona';
  end if;
  if v_student is null then return false; end if;
  if v_oquvchi is not null and v_student <> v_oquvchi then return false; end if;

  return exists (select 1 from students s where s.id = v_student and s.holat <> 'ketgan')
     and (v_guruh is null or exists (
           select 1 from enrollments e where e.student_id = v_student and e.group_id = v_guruh and e.holat <> 'tugagan'))
     and (v_fan is null or exists (
           select 1 from enrollments e join groups g on g.id = e.group_id
           where e.student_id = v_student and g.subject_id = v_fan and e.holat <> 'tugagan'))
     and (not v_qarzdor or coalesce((select qarz from v_student_balance where student_id = v_student), 0) > 0);
end;
$$;


-- ------------------------------------------------------------
-- 2. Admin maoshi: oylik + maosh_harakatlar.profile_id
-- ------------------------------------------------------------
create table if not exists xodim_oylik (
  profile_id uuid primary key references profiles (id) on delete cascade,
  summa      numeric(14, 0) not null check (summa >= 0),
  updated_at timestamptz not null default now()
);

comment on table xodim_oylik is 'Admin/qabulxona/manager oyligi (0077). Faqat manager va direktor ko''radi; xodim o''zinikini.';

alter table xodim_oylik enable row level security;
drop policy if exists xodim_oylik_read on xodim_oylik;
create policy xodim_oylik_read on xodim_oylik for select to authenticated
  using (app_is_manager() or profile_id = auth.uid());
drop policy if exists xodim_oylik_write on xodim_oylik;
create policy xodim_oylik_write on xodim_oylik for all to authenticated
  using (app_is_manager()) with check (app_is_manager());
grant select, insert, update, delete on xodim_oylik to authenticated;
grant all on xodim_oylik to service_role;

drop trigger if exists xodim_oylik_audit on xodim_oylik;
create trigger xodim_oylik_audit after insert or update or delete on xodim_oylik
  for each row execute function audit_trigger();

alter table maosh_harakatlar alter column teacher_id drop not null;
alter table maosh_harakatlar add column if not exists profile_id uuid references profiles (id) on delete restrict;
alter table maosh_harakatlar drop constraint if exists maosh_harakatlar_kimga;
alter table maosh_harakatlar add constraint maosh_harakatlar_kimga
  check ((teacher_id is null) <> (profile_id is null));
create index if not exists maosh_harakatlar_profil on maosh_harakatlar (davr, profile_id) where profile_id is not null and not bekor;

-- Ustoz yozuvlari — admin/manager/direktor; admin (xodim) yozuvlari — faqat manager/direktor
drop policy if exists maosh_harakatlar_read on maosh_harakatlar;
create policy maosh_harakatlar_read on maosh_harakatlar for select to authenticated
  using ((teacher_id is not null and (app_is_admin() or teacher_id = app_teacher_id()))
         or (profile_id is not null and (app_is_manager() or profile_id = auth.uid())));

drop policy if exists maosh_harakatlar_insert on maosh_harakatlar;
create policy maosh_harakatlar_insert on maosh_harakatlar for insert to authenticated
  with check (app_is_admin() and not bekor and (profile_id is null or app_is_manager()));

drop policy if exists maosh_harakatlar_update on maosh_harakatlar;
create policy maosh_harakatlar_update on maosh_harakatlar for update to authenticated
  using (app_is_admin() and (profile_id is null or app_is_manager()))
  with check (app_is_admin() and (profile_id is null or app_is_manager()));

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
  if new.teacher_id is distinct from old.teacher_id or new.profile_id is distinct from old.profile_id
     or new.davr is distinct from old.davr
     or new.turi is distinct from old.turi or new.summa is distinct from old.summa
     or new.kiritgan is distinct from old.kiritgan then
    raise exception 'Yozuv o''zgarmaydi — bekor qilib, to''g''risini qayta kiriting.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

/* Xodimlar (admin, qabulxona, manager) oylik hisobi — jonli, ichki */
create or replace function xodim_maosh_jonli(p_davr text)
returns table (
  profile_id uuid, ism text, rol user_role, oylik numeric,
  avans numeric, bonus numeric, jarima numeric, tuzatish numeric, yakuniy numeric
)
language sql stable security definer set search_path = public as $$
  with h as (
    select m.profile_id as pid,
      coalesce(sum(m.summa) filter (where m.turi = 'avans'), 0)    as av,
      coalesce(sum(m.summa) filter (where m.turi = 'bonus'), 0)    as bo,
      coalesce(sum(m.summa) filter (where m.turi = 'jarima'), 0)   as ja,
      coalesce(sum(m.summa) filter (where m.turi = 'tuzatish'), 0) as tu
    from maosh_harakatlar m
    where m.davr = p_davr and not m.bekor and m.profile_id is not null
    group by m.profile_id
  )
  select p.id, p.ism, p.rol, o.summa,
         coalesce(h.av, 0), coalesce(h.bo, 0), coalesce(h.ja, 0), coalesce(h.tu, 0),
         coalesce(o.summa, 0) - coalesce(h.av, 0) + coalesce(h.bo, 0) - coalesce(h.ja, 0) + coalesce(h.tu, 0)
  from profiles p
  left join xodim_oylik o on o.profile_id = p.id
  left join h on h.pid = p.id
  where p.rol in ('admin', 'qabulxona', 'manager')
    and (p.holat = 'faol' or o.profile_id is not null or h.pid is not null)
$$;
revoke execute on function xodim_maosh_jonli(text) from public, anon, authenticated;
grant execute on function xodim_maosh_jonli(text) to service_role;

create table if not exists maosh_tasdiq_xodim (
  davr       text not null references maosh_oylar (davr) on delete cascade,
  profile_id uuid not null references profiles (id) on delete restrict,
  ism        text not null,
  oylik      numeric(14, 0),
  avans      numeric(14, 0) not null,
  bonus      numeric(14, 0) not null,
  jarima     numeric(14, 0) not null,
  tuzatish   numeric(14, 0) not null,
  yakuniy    numeric(14, 0) not null,
  xarajat_id bigint references xarajatlar (id) on delete set null,
  primary key (davr, profile_id)
);
alter table maosh_tasdiq_xodim enable row level security;
drop policy if exists maosh_tasdiq_xodim_read on maosh_tasdiq_xodim;
create policy maosh_tasdiq_xodim_read on maosh_tasdiq_xodim for select to authenticated
  using (app_is_manager() or profile_id = auth.uid());
grant select on maosh_tasdiq_xodim to authenticated;
grant all on maosh_tasdiq_xodim to service_role;

/* Xodimlar maoshi: manager/direktor — hammasi; xodim — o'zi. Tasdiqlangan oy — nusxadan. */
create or replace function xodim_maosh(p_davr text)
returns table (
  profile_id uuid, ism text, rol user_role, oylik numeric,
  avans numeric, bonus numeric, jarima numeric, tuzatish numeric, yakuniy numeric, tasdiqlangan boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_hammasi boolean := app_is_manager() or auth.uid() is null;
begin
  if p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy YYYY-MM ko''rinishida bo''lsin.';
  end if;
  if maosh_oy_qulfmi(p_davr) then
    return query
    select m.profile_id, m.ism, p.rol, m.oylik, m.avans, m.bonus, m.jarima, m.tuzatish, m.yakuniy, true
    from maosh_tasdiq_xodim m join profiles p on p.id = m.profile_id
    where m.davr = p_davr and (v_hammasi or m.profile_id = auth.uid())
    order by m.ism;
    return;
  end if;
  return query
  select j.*, false from xodim_maosh_jonli(p_davr) j
  where v_hammasi or j.profile_id = auth.uid()
  order by j.ism;
end;
$$;
revoke execute on function xodim_maosh(text) from public, anon;
grant execute on function xodim_maosh(text) to authenticated, service_role;


/* Tasdiq: ustozlar (0075) + xodimlar oyligi → xarajatlar */
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

  for v_r in select * from xodim_maosh_jonli(p_davr) u where u.oylik is not null or u.yakuniy <> 0 or u.avans <> 0 loop
    v_xid := null;
    v_gross := v_r.yakuniy + v_r.avans;
    if v_gross > 0 then
      insert into xarajatlar (sana, toifa, summa, izoh)
      values (v_oxir, 'maosh', v_gross,
              format('Xodim maoshi · %s · %s%s', p_davr, v_r.ism,
                     case when v_r.avans > 0 then format(' (avans %s oldin berilgan)', v_r.avans) else '' end))
      returning id into v_xid;
    end if;
    insert into maosh_tasdiq_xodim (davr, profile_id, ism, oylik, avans, bonus, jarima, tuzatish, yakuniy, xarajat_id)
    values (p_davr, v_r.profile_id, v_r.ism, v_r.oylik, v_r.avans, v_r.bonus, v_r.jarima, v_r.tuzatish, v_r.yakuniy, v_xid);
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
   where not x.bekor and x.id in (
     select xarajat_id from maosh_tasdiq where davr = p_davr
     union select xarajat_id from maosh_tasdiq_xodim where davr = p_davr);
  get diagnostics v_soni = row_count;

  delete from maosh_oylar where davr = p_davr;   -- nusxalar cascade
  return v_soni;
end;
$$;


-- ------------------------------------------------------------
-- 3. Nazorat hodisalari
-- ------------------------------------------------------------
create table if not exists nazorat_hodisalar (
  id          bigserial primary key,
  turi        text not null check (turi in (
                'ustoz_kechikdi', 'davomat_qilinmadi', 'oquvchi_3_kelmadi', 'woblar_berilmadi',
                'lid_qongiroq', 'vazifa_muddati', 'qarzdor_eslatilmadi', 'tolov_kech', 'tolov_tasdiqlanmadi')),
  sana        date not null default bugun_toshkent(),
  teacher_id  text references teachers (id) on delete cascade,
  profile_id  uuid references profiles (id) on delete set null,   -- mas'ul xodim (admin)
  group_id    text references groups (id) on delete set null,
  student_id  text references students (id) on delete set null,
  lead_id     uuid references leads (id) on delete set null,
  vazifa_id   uuid references crm_vazifalar (id) on delete set null,
  payment_id  bigint references payments (id) on delete set null,
  tafsilot    text not null,
  kalit       text not null unique,                                -- qayta yozilmasin
  holat       text not null default 'yangi' check (holat in ('yangi', 'ogohlantirildi', 'yopildi')),
  yopdi       uuid references profiles (id) on delete set null,
  yopish_izoh text,
  yuborildi   boolean not null default false,                      -- managerga Telegram ketdimi
  created_at  timestamptz not null default now()
);

create index if not exists nazorat_yangi on nazorat_hodisalar (holat, created_at desc);
create index if not exists nazorat_ustoz on nazorat_hodisalar (teacher_id, sana desc) where teacher_id is not null;
create index if not exists nazorat_xodim on nazorat_hodisalar (profile_id, sana desc) where profile_id is not null;

comment on table nazorat_hodisalar is 'Ustoz va adminlarning qoidabuzarliklari — avtomatik (nazorat_yig, 0077). Manager/direktor ko''radi.';

alter table nazorat_hodisalar enable row level security;
drop policy if exists nazorat_read on nazorat_hodisalar;
create policy nazorat_read on nazorat_hodisalar for select to authenticated using (app_is_manager());
drop policy if exists nazorat_update on nazorat_hodisalar;
create policy nazorat_update on nazorat_hodisalar for update to authenticated
  using (app_is_manager()) with check (app_is_manager());
grant select, update on nazorat_hodisalar to authenticated;
grant all on nazorat_hodisalar to service_role;


/*
 * Yig'uvchi — cron (har 30 daqiqa) chaqiradi. Bir hodisa bir marta (kalit).
 * Qaytaradi — yangi qo'shilganlar soni.
 */
create or replace function nazorat_yig()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_bugun date := bugun_toshkent();
  v_soat  time := (now() at time zone 'Asia/Tashkent')::time;
  v_davr  text := to_char(bugun_toshkent(), 'YYYY-MM');
  v_oxir  date := (date_trunc('month', bugun_toshkent()) + interval '1 month' - interval '1 day')::date;
  v_soni  int := 0;
  v_n     int;
begin
  if auth.uid() is not null and not app_is_manager() then
    raise exception 'Nazoratni faqat tizim yoki manager yurgizadi.';
  end if;

  -- Ustoz kechikdi (oxirgi 3 kun)
  insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, tafsilot, kalit)
  select 'ustoz_kechikdi', k.sana, k.teacher_id, k.group_id,
         format('%s daqiqa kechikdi%s', k.daqiqa, coalesce(' · ' || k.sabab, '')),
         'kech:' || k.id
  from ustoz_kechikish k
  where k.sana >= v_bugun - 3
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- Kun oxiri (21:00 dan keyin): davomat qilinmadi, woblar berilmadi
  if v_soat >= time '21:00' then
    insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, tafsilot, kalit)
    select 'davomat_qilinmadi', v_bugun, dars_ustozi(g.id, v_bugun), g.id,
           format('%s — bugungi dars davomati qilinmadi', g.nom),
           'dav:' || g.id || ':' || v_bugun
    from groups g
    where g.holat = 'faol' and guruh_dars_kunimi(g.kunlar, v_bugun)
      and exists (select 1 from enrollments e where e.group_id = g.id and e.holat = 'faol' and e.boshlandi <= v_bugun)
      and not exists (select 1 from lessons l where l.group_id = g.id and l.sana = v_bugun and l.otkazildi)
      and dars_ustozi(g.id, v_bugun) is not null
    on conflict (kalit) do nothing;
    get diagnostics v_n = row_count; v_soni := v_soni + v_n;

    insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, tafsilot, kalit)
    select 'woblar_berilmadi', v_bugun, coalesce(l.zamena_teacher_id, g.teacher_id), g.id,
           format('%s — dars o''tdi, lekin birorta ham woblar berilmadi', g.nom),
           'wob:' || g.id || ':' || v_bugun
    from lessons l join groups g on g.id = l.group_id
    where l.sana = v_bugun and l.otkazildi
      and not exists (select 1 from woblr w where w.group_id = g.id
                        and (w.created_at at time zone 'Asia/Tashkent')::date = v_bugun)
      and not exists (select 1 from probniy_woblar w where w.group_id = g.id
                        and (w.created_at at time zone 'Asia/Tashkent')::date = v_bugun)
      and coalesce(l.zamena_teacher_id, g.teacher_id) is not null
    on conflict (kalit) do nothing;
    get diagnostics v_n = row_count; v_soni := v_soni + v_n;
  end if;

  -- O'quvchi ketma-ket 3 dars kelmadi (oxirgi 3 belgisi "kelmadi", oxirgisi 3 kun ichida)
  insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, student_id, tafsilot, kalit)
  select 'oquvchi_3_kelmadi', x.oxirgi, g.teacher_id, g.id, x.student_id,
         format('%s — ketma-ket 3 dars kelmadi (%s guruhi). Bog''lanish kerak.', s.fish, g.nom),
         'kel3:' || x.group_id || ':' || x.student_id || ':' || x.oxirgi
  from (
    select l.group_id, a.student_id,
           max(l.sana) as oxirgi,
           bool_and(a.holat in ('kelmadi', 'sababli')) as hammasi_yoq,
           count(*) as n
    from (
      select a.*, row_number() over (partition by l.group_id, a.student_id order by l.sana desc) as rn
      from attendance a join lessons l on l.id = a.lesson_id
      where l.sana > v_bugun - 45
    ) a
    join lessons l on l.id = a.lesson_id
    where a.rn <= 3
    group by l.group_id, a.student_id
  ) x
  join groups g on g.id = x.group_id
  join students s on s.id = x.student_id
  join enrollments e on e.group_id = x.group_id and e.student_id = x.student_id and e.holat = 'faol'
  where x.n = 3 and x.hammasi_yoq and x.oxirgi >= v_bugun - 3
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- Lid qo'ng'irog'i va vazifa muddati o'tdi (1 soatdan ortiq)
  insert into nazorat_hodisalar (turi, sana, profile_id, lead_id, vazifa_id, tafsilot, kalit)
  select case when v.lead_id is not null then 'lid_qongiroq' else 'vazifa_muddati' end,
         (v.muddat at time zone 'Asia/Tashkent')::date, v.masul, v.lead_id, v.id,
         format('%s — muddati %s edi', v.nom, to_char(v.muddat at time zone 'Asia/Tashkent', 'DD.MM HH24:MI')),
         'vaz:' || v.id
  from crm_vazifalar v
  where v.holat in ('yangi', 'jarayonda') and v.muddat < now() - interval '1 hour'
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- To'lov kech kiritildi (saytda, to'lov sanasidan 1 kundan ko'p keyin)
  insert into nazorat_hodisalar (turi, sana, profile_id, student_id, payment_id, tafsilot, kalit)
  select 'tolov_kech', (p.created_at at time zone 'Asia/Tashkent')::date, p.qabul_qildi, p.student_id, p.id,
         format('%s so''m · to''lov sanasi %s, kiritilgan %s', p.summa, to_char(p.sana, 'DD.MM'),
                to_char(p.created_at at time zone 'Asia/Tashkent', 'DD.MM HH24:MI')),
         'tolk:' || p.id
  from payments p
  where p.manba = 'crm' and not p.bekor
    and p.created_at > now() - interval '3 days'
    and (p.created_at at time zone 'Asia/Tashkent')::date - p.sana > 1
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- To'lov 2 kundan beri tasdiqlanmagan
  insert into nazorat_hodisalar (turi, sana, profile_id, student_id, payment_id, tafsilot, kalit)
  select 'tolov_tasdiqlanmadi', v_bugun, p.qabul_qildi, p.student_id, p.id,
         format('%s so''m · %s dan beri tasdiqlanmagan', p.summa, to_char(p.created_at at time zone 'Asia/Tashkent', 'DD.MM')),
         'tast:' || p.id
  from payments p
  where p.manba = 'crm' and not p.bekor and not p.tasdiqlangan
    and p.created_at < now() - interval '2 days'
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- Oy oxiri (oxirgi kun 20:00 dan keyin): qarzdorga oy ichida eslatma qilinmadi
  if v_bugun = v_oxir and v_soat >= time '20:00' then
    insert into nazorat_hodisalar (turi, sana, student_id, tafsilot, kalit)
    select 'qarzdor_eslatilmadi', v_bugun, b.student_id,
           format('%s — qarz %s so''m, oy davomida "To''lov eslatish" bajarilmadi', b.fish, b.qarz),
           'qarz:' || b.student_id || ':' || v_davr
    from v_student_balance b
    join students s on s.id = b.student_id and s.holat = 'faol'
    where b.qarz > 0
      and not exists (
        select 1 from crm_vazifalar v
        where v.student_id = b.student_id and v.turi = 'tolov_eslatish' and v.holat = 'bajarildi'
          and to_char(v.bajarildi_at at time zone 'Asia/Tashkent', 'YYYY-MM') = v_davr)
    on conflict (kalit) do nothing;
    get diagnostics v_n = row_count; v_soni := v_soni + v_n;
  end if;

  return v_soni;
end;
$$;
revoke execute on function nazorat_yig() from public, anon;
grant execute on function nazorat_yig() to authenticated, service_role;


-- ------------------------------------------------------------
-- 4. Ogohlantirish va jarima
-- ------------------------------------------------------------
create table if not exists ogohlantirishlar (
  id          bigserial primary key,
  hodisa_id   bigint references nazorat_hodisalar (id) on delete set null,
  teacher_id  text references teachers (id) on delete cascade,
  profile_id  uuid references profiles (id) on delete cascade,
  davr        text not null default to_char(bugun_toshkent(), 'YYYY-MM') check (davr ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  matn        text not null check (length(trim(matn)) between 1 and 1000),
  berdi       uuid references profiles (id) on delete set null default auth.uid(),
  bekor       boolean not null default false,
  created_at  timestamptz not null default now(),
  check ((teacher_id is null) <> (profile_id is null))
);
create index if not exists ogohlantirish_davr on ogohlantirishlar (davr, teacher_id, profile_id) where not bekor;

comment on table ogohlantirishlar is 'Manager ogohlantirishlari (0077). Oy ichida 3 tadan keyin jarima mumkin.';

alter table ogohlantirishlar enable row level security;
drop policy if exists ogohlantirish_read on ogohlantirishlar;
create policy ogohlantirish_read on ogohlantirishlar for select to authenticated
  using (app_is_manager()
         or (teacher_id is not null and teacher_id = app_teacher_id())
         or profile_id = auth.uid());
drop policy if exists ogohlantirish_bekor on ogohlantirishlar;
create policy ogohlantirish_bekor on ogohlantirishlar for update to authenticated
  using (app_is_manager()) with check (app_is_manager());
grant select, update on ogohlantirishlar to authenticated;
grant all on ogohlantirishlar to service_role;

drop trigger if exists ogohlantirishlar_audit on ogohlantirishlar;
create trigger ogohlantirishlar_audit after insert or update on ogohlantirishlar
  for each row execute function audit_trigger();

/* Shu oy ogohlantirishlari soni */
create or replace function ogohlantirish_soni(p_teacher text, p_profile uuid, p_davr text default null)
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from ogohlantirishlar o
  where not o.bekor and o.davr = coalesce(p_davr, to_char(bugun_toshkent(), 'YYYY-MM'))
    and (o.teacher_id is not distinct from p_teacher) and (o.profile_id is not distinct from p_profile)
$$;
revoke execute on function ogohlantirish_soni(text, uuid, text) from public, anon;
grant execute on function ogohlantirish_soni(text, uuid, text) to authenticated, service_role;

/*
 * Ogohlantirish: yoziladi, hodisa "ogohlantirildi", odamga sayt bildirishnomasi.
 * Telegram'ni server amali yuboradi. Qaytaradi — shu oydagi soni.
 */
create or replace function ogohlantir(p_hodisa bigint, p_teacher text, p_profile uuid, p_matn text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_soni int;
begin
  if auth.uid() is not null and not app_is_manager() then
    raise exception 'Ogohlantirishni faqat manager yoki direktor beradi.';
  end if;
  if (p_teacher is null) = (p_profile is null) then
    raise exception 'Kimni ogohlantirish kerak — ustoz yoki xodimni tanlang.';
  end if;
  if length(trim(coalesce(p_matn, ''))) = 0 then
    raise exception 'Ogohlantirish matnini yozing.';
  end if;

  insert into ogohlantirishlar (hodisa_id, teacher_id, profile_id, matn)
  values (p_hodisa, p_teacher, p_profile, trim(p_matn));

  if p_hodisa is not null then
    update nazorat_hodisalar set holat = 'ogohlantirildi', yopdi = auth.uid() where id = p_hodisa;
  end if;

  v_soni := ogohlantirish_soni(p_teacher, p_profile);

  insert into bildirishnomalar (turi, sarlavha, matn, kimga, filtr, muhim, tugash, yaratdi, manba)
  values ('eslatma', format('Ogohlantirish (%s/3)', v_soni), trim(p_matn),
          case when p_teacher is not null then array['ustoz'] else array['xodim'] end,
          case when p_teacher is not null then jsonb_build_object('ustoz', p_teacher)
               else jsonb_build_object('profil', p_profile) end,
          true, now() + interval '7 days', auth.uid(), 'nazorat');

  return v_soni;
end;
$$;
revoke execute on function ogohlantir(bigint, text, uuid, text) from public, anon;
grant execute on function ogohlantir(bigint, text, uuid, text) to authenticated, service_role;

/* Jarima — oy ichida 3+ ogohlantirishdan keyin; summani manager yozadi */
create or replace function nazorat_jarima(p_teacher text, p_profile uuid, p_summa numeric, p_sabab text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  if auth.uid() is not null and not app_is_manager() then
    raise exception 'Jarimani faqat manager yoki direktor qo''llaydi.';
  end if;
  if (p_teacher is null) = (p_profile is null) then
    raise exception 'Kimga jarima — ustoz yoki xodimni tanlang.';
  end if;
  if p_summa is null or p_summa <= 0 then
    raise exception 'Jarima summasini yozing.';
  end if;
  if length(trim(coalesce(p_sabab, ''))) = 0 then
    raise exception 'Jarima sababini yozing.';
  end if;
  if ogohlantirish_soni(p_teacher, p_profile) < 3 then
    raise exception 'Jarima shu oy 3 ta ogohlantirishdan keyin qo''llanadi (hozir %).', ogohlantirish_soni(p_teacher, p_profile);
  end if;

  insert into maosh_harakatlar (teacher_id, profile_id, davr, turi, summa, izoh)
  values (p_teacher, p_profile, to_char(bugun_toshkent(), 'YYYY-MM'), 'jarima', p_summa, 'Nazorat: ' || trim(p_sabab))
  returning id into v_id;

  insert into bildirishnomalar (turi, sarlavha, matn, kimga, filtr, muhim, tugash, yaratdi, manba)
  values ('eslatma', 'Jarima', format('%s so''m jarima: %s', p_summa, trim(p_sabab)),
          case when p_teacher is not null then array['ustoz'] else array['xodim'] end,
          case when p_teacher is not null then jsonb_build_object('ustoz', p_teacher)
               else jsonb_build_object('profil', p_profile) end,
          true, now() + interval '7 days', auth.uid(), 'nazorat');
  return v_id;
end;
$$;
revoke execute on function nazorat_jarima(text, uuid, numeric, text) from public, anon;
grant execute on function nazorat_jarima(text, uuid, numeric, text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 5. Cron: har 30 daqiqa → /api/cron/nazorat (yig'adi va managerga yuboradi)
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron/pg_net yo''q — nazorat jadvali qo''yilmadi (lokal test).';
    return;
  end if;
  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'nazorat';
  perform cron.schedule(
    'nazorat',
    '*/30 * * * *',
    $cmd$
      select net.http_post(
        url     := 'https://wbalc.uz/api/cron/nazorat',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := '{}'::jsonb
      )
    $cmd$
  );
end $$;


/*
 * Telegram manzillari (chat_id). Ustoz yoki xodim — o'shaning chatlari;
 * ikkalasi bo'sh — managerlar (manager yo'q bo'lsa — direktor).
 * Yuborishni server (amal yoki cron) qiladi.
 */
create or replace function nazorat_chatlar(p_teacher text, p_profile uuid)
returns bigint[]
language plpgsql stable security definer set search_path = public as $$
declare
  v_r bigint[];
begin
  if auth.uid() is not null and not app_is_manager() then
    raise exception 'Faqat manager yoki direktor.';
  end if;
  if p_teacher is not null then
    select array_agg(distinct u.chat_id) into v_r
    from telegram_ulanish u
    where u.holat = 'faol'
      and (u.teacher_id = p_teacher or u.profile_id = (select profile_id from teachers where id = p_teacher));
  elsif p_profile is not null then
    select array_agg(distinct u.chat_id) into v_r
    from telegram_ulanish u where u.holat = 'faol' and u.profile_id = p_profile;
  else
    select array_agg(distinct u.chat_id) into v_r
    from telegram_ulanish u join profiles p on p.id = u.profile_id
    where u.holat = 'faol' and p.holat = 'faol'
      and p.rol = case when exists (select 1 from profiles where rol = 'manager' and holat = 'faol')
                       then 'manager'::user_role else 'direktor'::user_role end;
  end if;
  return coalesce(v_r, '{}');
end;
$$;
revoke execute on function nazorat_chatlar(text, uuid) from public, anon;
grant execute on function nazorat_chatlar(text, uuid) to authenticated, service_role;
