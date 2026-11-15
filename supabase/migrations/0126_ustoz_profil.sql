-- ============================================================
--  0126 — Ustoz profili: CV, obyektivka, fayllar (Jamshid, 15.11)
-- ============================================================
--  CV (saytga chiqishi mumkin): teacher_profil, teacher_sertifikat,
--    teacher_yutuq, teacher_talim.
--  Obyektivka (ichki, qarindoshlarsiz): teacher_shaxsiy, teacher_mehnat.
--
--  Huquq (RLS): ustozning o'zi + admin/manager/direktor (app_is_admin).
--  teachers jadvali hammaga o'qiladi — shuning uchun maxfiy maydonlar
--  (pasport, JSHSHIR, manzil) alohida jadvalda.
--
--  Tasdiq: CV o'zgarsa (kim o'zgartirsa ham) holat = 'kutilmoqda';
--  saytga faqat manager tasdiqlagan nusxa (teacher_profil.ommaviy) chiqadi.
--  Ko'rsatish sozlamalari (saytda, korinish, har sertifikat/yutuq saytda)
--  faqat admin/manager/direktorda va darhol amal qiladi.
--  Obyektivka darhol saqlanadi (ichki).
--
--  Tarix: har o'zgarish teacher_profil_tarix ga (pasport/JSHSHIR — ***).
--  Fayllar: Storage 'ustoz-rasm' (ochiq) va 'ustoz-hujjat' (yopiq),
--  yo'l doim '<teacher_id>/...'.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Jadvallar
-- ------------------------------------------------------------

create table if not exists teacher_profil (
  teacher_id        text primary key references teachers (id) on delete cascade,
  rasm_yol          text,
  tavsif            text check (tavsif is null or length(tavsif) <= 1500),
  fanlar            text[] not null default '{}',
  dars_boshlagan_yil int check (dars_boshlagan_yil is null or dars_boshlagan_yil between 1970 and 2100),
  tillar            text[] not null default '{}',
  -- Ko'rsatish (faqat admin/manager/direktor)
  slug              text unique check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  saytda            boolean not null default false,
  sayt_tartib       int not null default 100,
  korinish          jsonb not null default '{"rasm": true, "tavsif": true, "fanlar": true, "tajriba": true, "tillar": true, "talim": false, "yutuqlar": true, "sertifikatlar": true}'::jsonb,
  -- Tasdiq
  holat             text not null default 'qoralama' check (holat in ('qoralama', 'kutilmoqda', 'tasdiqlangan', 'qaytarildi')),
  qaytarish_izoh    text,
  ommaviy           jsonb,
  ozgardi_vaqt      timestamptz,
  tasdiqlandi_vaqt  timestamptz,
  tasdiqladi        uuid references profiles (id) on delete set null,
  updated_at        timestamptz not null default now()
);
comment on table teacher_profil is 'Ustoz CV si (0126). ommaviy — manager tasdiqlagan nusxa, saytga faqat shu chiqadi.';

create table if not exists teacher_sertifikat (
  id          bigserial primary key,
  teacher_id  text not null references teachers (id) on delete cascade,
  turi        text not null check (length(trim(turi)) between 1 and 60),
  ball        text check (ball is null or length(ball) <= 40),
  qayerda     text check (qayerda is null or length(qayerda) <= 200),
  sana        date,
  muddat      date,
  fayl_yol    text,
  saytda      boolean not null default true,
  fayl_saytda boolean not null default false,
  tartib      int not null default 100,
  created_at  timestamptz not null default now()
);
create index if not exists teacher_sertifikat_ustoz_idx on teacher_sertifikat (teacher_id);

create table if not exists teacher_yutuq (
  id          bigserial primary key,
  teacher_id  text not null references teachers (id) on delete cascade,
  nomi        text not null check (length(trim(nomi)) between 1 and 200),
  sana        date,
  izoh        text check (izoh is null or length(izoh) <= 1000),
  fayl_yol    text,
  saytda      boolean not null default true,
  fayl_saytda boolean not null default false,
  tartib      int not null default 100,
  created_at  timestamptz not null default now()
);
create index if not exists teacher_yutuq_ustoz_idx on teacher_yutuq (teacher_id);

create table if not exists teacher_talim (
  id          bigserial primary key,
  teacher_id  text not null references teachers (id) on delete cascade,
  otm         text not null check (length(trim(otm)) between 1 and 200),
  yonalish    text check (yonalish is null or length(yonalish) <= 200),
  daraja      text check (daraja is null or daraja in ('bakalavr', 'magistr', 'phd', 'orta_maxsus', 'kurs', 'boshqa')),
  dan_yil     int check (dan_yil is null or dan_yil between 1950 and 2100),
  gacha_yil   int check (gacha_yil is null or gacha_yil between 1950 and 2100),
  oqiyapti    boolean not null default false,
  diplom_yol  text,
  created_at  timestamptz not null default now()
);
create index if not exists teacher_talim_ustoz_idx on teacher_talim (teacher_id);

create table if not exists teacher_mehnat (
  id          bigserial primary key,
  teacher_id  text not null references teachers (id) on delete cascade,
  dan_yil     int not null check (dan_yil between 1950 and 2100),
  gacha_yil   int check (gacha_yil is null or gacha_yil between 1950 and 2100),
  ish_joyi    text not null check (length(trim(ish_joyi)) between 1 and 200),
  lavozim     text check (lavozim is null or length(lavozim) <= 200),
  created_at  timestamptz not null default now()
);
create index if not exists teacher_mehnat_ustoz_idx on teacher_mehnat (teacher_id);

create table if not exists teacher_shaxsiy (
  teacher_id     text primary key references teachers (id) on delete cascade,
  tugilgan_sana  date,
  tugilgan_joy   text check (tugilgan_joy is null or length(tugilgan_joy) <= 200),
  millati        text check (millati is null or length(millati) <= 60),
  malumoti       text check (malumoti is null or malumoti in ('oliy', 'tugallanmagan_oliy', 'orta_maxsus', 'orta')),
  mutaxassisligi text check (mutaxassisligi is null or length(mutaxassisligi) <= 200),
  ilmiy_daraja   text check (ilmiy_daraja is null or length(ilmiy_daraja) <= 100),
  ilmiy_unvon    text check (ilmiy_unvon is null or length(ilmiy_unvon) <= 100),
  chet_tillari   text check (chet_tillari is null or length(chet_tillari) <= 200),
  mukofotlar     text check (mukofotlar is null or length(mukofotlar) <= 500),
  pasport        text check (pasport is null or pasport ~ '^[A-Z]{2}[0-9]{7}$'),
  pasport_yol    text,
  jshshir        text check (jshshir is null or jshshir ~ '^[0-9]{14}$'),
  manzil         text check (manzil is null or length(manzil) <= 300),
  updated_at     timestamptz not null default now()
);
comment on table teacher_shaxsiy is 'Obyektivka (0126), qarindoshlarsiz. Faqat ustozning o''zi va admin/manager/direktor.';

create table if not exists teacher_profil_tarix (
  id         bigserial primary key,
  teacher_id text not null references teachers (id) on delete cascade,
  jadval     text not null,
  yozuv_id   text,
  amal       text not null check (amal in ('qoshildi', 'ozgardi', 'ochirildi')),
  maydon     text,
  eski       text,
  yangi      text,
  kim        uuid references profiles (id) on delete set null,
  kim_ustoz  boolean not null default false,
  vaqt       timestamptz not null default now()
);
create index if not exists teacher_profil_tarix_idx on teacher_profil_tarix (teacher_id, vaqt desc);

-- Har ustozga bo'sh profil (keyingilari — trigger)
insert into teacher_profil (teacher_id) select id from teachers on conflict do nothing;

create or replace function ustoz_profil_yarat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into teacher_profil (teacher_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists ustoz_profil_yarat on teachers;
create trigger ustoz_profil_yarat after insert on teachers
  for each row execute function ustoz_profil_yarat();


-- ------------------------------------------------------------
-- 2. Huquq
-- ------------------------------------------------------------

/* Shu ustozning profilini ko'ra/o'zgartira oladimi: o'zi yoki admin/manager/direktor */
create or replace function ustoz_profil_huquq(p_teacher text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_is_admin() or (p_teacher is not null and p_teacher = app_teacher_id()), false)
$$;
revoke execute on function ustoz_profil_huquq(text) from public, anon;
grant execute on function ustoz_profil_huquq(text) to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array['teacher_profil', 'teacher_sertifikat', 'teacher_yutuq', 'teacher_talim', 'teacher_mehnat', 'teacher_shaxsiy'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists %I on %I', t || '_oqi', t);
    execute format('drop policy if exists %I on %I', t || '_yoz', t);
    execute format('create policy %I on %I for select to authenticated using (ustoz_profil_huquq(teacher_id))', t || '_oqi', t);
    execute format('create policy %I on %I for all to authenticated using (ustoz_profil_huquq(teacher_id)) with check (ustoz_profil_huquq(teacher_id))', t || '_yoz', t);
  end loop;
end $$;

-- Profil qatorini faqat trigger yaratadi/o'chiradi
drop policy if exists teacher_profil_yoz on teacher_profil;
create policy teacher_profil_yoz on teacher_profil for update to authenticated
  using (ustoz_profil_huquq(teacher_id)) with check (ustoz_profil_huquq(teacher_id));

alter table teacher_profil_tarix enable row level security;
alter table teacher_profil_tarix force row level security;
drop policy if exists teacher_profil_tarix_oqi on teacher_profil_tarix;
create policy teacher_profil_tarix_oqi on teacher_profil_tarix for select to authenticated
  using (ustoz_profil_huquq(teacher_id));


-- ------------------------------------------------------------
-- 3. Qoida triggerlari
-- ------------------------------------------------------------

/*
 * teacher_profil: ustoz ko'rsatish/tasdiq maydonlarini o'zgartira olmaydi;
 * CV maydoni o'zgarsa — holat 'kutilmoqda'. Tasdiq funksiyalari
 * 'ustoz_profil.tasdiq' sozlamasi bilan o'tadi.
 */
create or replace function teacher_profil_qoida() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tasdiq boolean := coalesce(current_setting('ustoz_profil.tasdiq', true), '') = '1';
begin
  if not v_tasdiq then
    if auth.uid() is not null and not app_is_admin() then
      if new.saytda is distinct from old.saytda or new.sayt_tartib is distinct from old.sayt_tartib
         or new.korinish is distinct from old.korinish or new.slug is distinct from old.slug then
        raise exception 'Saytda ko''rsatish sozlamalarini faqat admin o''zgartiradi.';
      end if;
    end if;
    -- Tasdiq maydonlariga faqat tasdiq funksiyalari tegadi
    new.holat            := old.holat;
    new.qaytarish_izoh   := old.qaytarish_izoh;
    new.ommaviy          := old.ommaviy;
    new.tasdiqlandi_vaqt := old.tasdiqlandi_vaqt;
    new.tasdiqladi       := old.tasdiqladi;

    if new.rasm_yol is distinct from old.rasm_yol or new.tavsif is distinct from old.tavsif
       or new.fanlar is distinct from old.fanlar or new.dars_boshlagan_yil is distinct from old.dars_boshlagan_yil
       or new.tillar is distinct from old.tillar then
      new.holat := 'kutilmoqda';
      new.qaytarish_izoh := null;
      new.ozgardi_vaqt := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists teacher_profil_qoida on teacher_profil;
create trigger teacher_profil_qoida before update on teacher_profil
  for each row execute function teacher_profil_qoida();

/* Sertifikat/yutuq: 'saytda' va 'fayl_saytda' — faqat admin */
create or replace function cv_korinish_qoida() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_admin() then
    if tg_op = 'INSERT' then
      new.fayl_saytda := false;
    elsif new.saytda is distinct from old.saytda or new.fayl_saytda is distinct from old.fayl_saytda
          or new.tartib is distinct from old.tartib then
      raise exception 'Saytda ko''rsatishni faqat admin belgilaydi.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists cv_korinish_qoida on teacher_sertifikat;
create trigger cv_korinish_qoida before insert or update on teacher_sertifikat
  for each row execute function cv_korinish_qoida();
drop trigger if exists cv_korinish_qoida on teacher_yutuq;
create trigger cv_korinish_qoida before insert or update on teacher_yutuq
  for each row execute function cv_korinish_qoida();

/* CV ro'yxatlari o'zgarsa (faqat mazmun, ko'rsatish bayrog'i emas) — profil 'kutilmoqda' */
create or replace function cv_royxat_ozgardi() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_t   text := coalesce(new.teacher_id, old.teacher_id);
  v_eski jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) - array['saytda', 'fayl_saytda', 'tartib'] end;
  v_yangi jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) - array['saytda', 'fayl_saytda', 'tartib'] end;
begin
  if v_eski is distinct from v_yangi then
    perform set_config('ustoz_profil.tasdiq', '1', true);
    update teacher_profil set holat = 'kutilmoqda', qaytarish_izoh = null, ozgardi_vaqt = now(), updated_at = now()
     where teacher_id = v_t;
    perform set_config('ustoz_profil.tasdiq', '', true);
  end if;
  return null;
end;
$$;
do $$
declare
  t text;
begin
  foreach t in array array['teacher_sertifikat', 'teacher_yutuq', 'teacher_talim'] loop
    execute format('drop trigger if exists cv_royxat_ozgardi on %I', t);
    execute format('create trigger cv_royxat_ozgardi after insert or update or delete on %I for each row execute function cv_royxat_ozgardi()', t);
  end loop;
end $$;

/* Tarix: maydon bo'yicha eski → yangi. Maxfiy maydonlar ***, fayl yo'li — "fayl" */
create or replace function ustoz_profil_tarix_yoz() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_t     text := coalesce(new.teacher_id, old.teacher_id);
  v_eski  jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_yangi jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_id    text := coalesce(v_yangi ->> 'id', v_eski ->> 'id');
  v_ustoz boolean := coalesce(v_t = app_teacher_id(), false);
  k       text;
  e       text;
  y       text;
  v_amal  text := case tg_op when 'INSERT' then 'qoshildi' when 'DELETE' then 'ochirildi' else 'ozgardi' end;
begin
  if tg_op in ('INSERT', 'DELETE') and tg_table_name <> 'teacher_profil' and tg_table_name <> 'teacher_shaxsiy' then
    insert into teacher_profil_tarix (teacher_id, jadval, yozuv_id, amal, maydon, eski, yangi, kim, kim_ustoz)
    values (v_t, tg_table_name, v_id, v_amal, null,
            case when tg_op = 'DELETE' then coalesce(v_eski ->> 'turi', v_eski ->> 'nomi', v_eski ->> 'otm', v_eski ->> 'ish_joyi') end,
            case when tg_op = 'INSERT' then coalesce(v_yangi ->> 'turi', v_yangi ->> 'nomi', v_yangi ->> 'otm', v_yangi ->> 'ish_joyi') end,
            auth.uid(), v_ustoz);
    return null;
  end if;

  for k in select jsonb_object_keys(v_eski || v_yangi) loop
    continue when k in ('id', 'teacher_id', 'created_at', 'updated_at', 'ozgardi_vaqt', 'holat', 'qaytarish_izoh',
                        'ommaviy', 'tasdiqlandi_vaqt', 'tasdiqladi');
    e := v_eski ->> k;
    y := v_yangi ->> k;
    continue when e is not distinct from y;
    if k in ('pasport', 'jshshir') then
      e := case when e is null then null else '***' end;
      y := case when y is null then null else '***' end;
    elsif k like '%\_yol' then
      e := case when e is null then null else 'fayl' end;
      y := case when y is null then null else 'yangi fayl' end;
    end if;
    insert into teacher_profil_tarix (teacher_id, jadval, yozuv_id, amal, maydon, eski, yangi, kim, kim_ustoz)
    values (v_t, tg_table_name, v_id, v_amal, k, left(e, 500), left(y, 500), auth.uid(), v_ustoz);
  end loop;
  return null;
end;
$$;
do $$
declare
  t text;
begin
  foreach t in array array['teacher_profil', 'teacher_sertifikat', 'teacher_yutuq', 'teacher_talim', 'teacher_mehnat', 'teacher_shaxsiy'] loop
    execute format('drop trigger if exists ustoz_profil_tarix on %I', t);
    execute format('create trigger ustoz_profil_tarix after insert or update or delete on %I for each row execute function ustoz_profil_tarix_yoz()', t);
  end loop;
end $$;


-- ------------------------------------------------------------
-- 4. Slug (manzil: wbalc.uz/ustozlar/<slug>)
-- ------------------------------------------------------------

create or replace function ustoz_slug_yasa(p_teacher text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_asos text;
  v_slug text;
  n      int := 1;
begin
  select lower(coalesce(nullif(trim(ismi || ' ' || coalesce(familiya, '')), ''), ism)) into v_asos from teachers where id = p_teacher;
  v_asos := translate(coalesce(v_asos, p_teacher), 'ʻʼ''`‘’', '');
  v_asos := regexp_replace(translate(v_asos, 'шщчжюяёэ', 'sscjyyye'), '[^a-z0-9]+', '-', 'g');
  v_asos := trim(both '-' from v_asos);
  if v_asos = '' then v_asos := lower(p_teacher); end if;
  v_slug := v_asos;
  while exists (select 1 from teacher_profil where slug = v_slug and teacher_id <> p_teacher) loop
    n := n + 1;
    v_slug := v_asos || '-' || n;
  end loop;
  return v_slug;
end;
$$;
revoke execute on function ustoz_slug_yasa(text) from public, anon;


/* Ustozning ulangan Telegram chatlari + tayyor matn (faqat boshqa funksiyalar ichidan) */
create or replace function ustoz_tg_chatlar(p_teacher text, p_sarlavha text, p_matn text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('chat', u.chat_id, 'sarlavha', p_sarlavha, 'matn', p_matn)), '[]'::jsonb)
  from telegram_ulanish u
  where u.holat = 'faol' and (u.teacher_id = p_teacher or u.profile_id = (select profile_id from teachers where id = p_teacher))
$$;
revoke execute on function ustoz_tg_chatlar(text, text, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5. Tasdiq (manager / direktor)
-- ------------------------------------------------------------

/* Hozirgi CV dan saytga chiqadigan nusxa */
create or replace function ustoz_cv_nusxa(p_teacher text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ism', coalesce(nullif(trim(t.ismi || ' ' || coalesce(t.familiya, '')), ''), t.ism),
    'rasm_yol', p.rasm_yol,
    'tavsif', p.tavsif,
    'fanlar', to_jsonb(p.fanlar),
    'dars_boshlagan_yil', p.dars_boshlagan_yil,
    'tillar', to_jsonb(p.tillar),
    'sertifikatlar', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'turi', s.turi, 'ball', s.ball, 'qayerda', s.qayerda,
                                 'sana', s.sana, 'muddat', s.muddat, 'fayl_yol', s.fayl_yol) order by s.tartib, s.sana desc nulls last, s.id)
                               from teacher_sertifikat s where s.teacher_id = p.teacher_id), '[]'::jsonb),
    'yutuqlar', coalesce((select jsonb_agg(jsonb_build_object('id', y.id, 'nomi', y.nomi, 'sana', y.sana, 'izoh', y.izoh,
                            'fayl_yol', y.fayl_yol) order by y.tartib, y.sana desc nulls last, y.id)
                          from teacher_yutuq y where y.teacher_id = p.teacher_id), '[]'::jsonb),
    'talim', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'otm', e.otm, 'yonalish', e.yonalish, 'daraja', e.daraja,
                         'dan_yil', e.dan_yil, 'gacha_yil', e.gacha_yil, 'oqiyapti', e.oqiyapti) order by e.dan_yil desc nulls last, e.id)
                       from teacher_talim e where e.teacher_id = p.teacher_id), '[]'::jsonb)
  )
  from teacher_profil p join teachers t on t.id = p.teacher_id
  where p.teacher_id = p_teacher
$$;
revoke execute on function ustoz_cv_nusxa(text) from public, anon;
grant execute on function ustoz_cv_nusxa(text) to authenticated, service_role;

drop function if exists ustoz_cv_tasdiqla(text);
create or replace function ustoz_cv_tasdiqla(p_teacher text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_manager() then
    raise exception 'CV ni manager tasdiqlaydi.';
  end if;
  perform set_config('ustoz_profil.tasdiq', '1', true);
  update teacher_profil
     set ommaviy = ustoz_cv_nusxa(p_teacher), holat = 'tasdiqlangan', qaytarish_izoh = null,
         tasdiqlandi_vaqt = now(), tasdiqladi = auth.uid(),
         slug = coalesce(slug, ustoz_slug_yasa(p_teacher))
   where teacher_id = p_teacher;
  if not found then
    raise exception 'Ustoz topilmadi.';
  end if;
  perform set_config('ustoz_profil.tasdiq', '', true);

  insert into bildirishnomalar (turi, sarlavha, matn, havola, havola_matn, kimga, filtr, tugash, yaratdi, manba)
  values ('eslatma', 'Ma''lumotlaringiz tasdiqlandi', 'CV dagi o''zgarishlar tasdiqlandi.',
          '/crm/malumotlarim', 'Ko''rish', array['ustoz'], jsonb_build_object('ustoz', p_teacher),
          now() + interval '7 days', auth.uid(), 'ustoz_profil');
  return jsonb_build_object('tg', ustoz_tg_chatlar(p_teacher, 'CV tasdiqlandi', 'Ma''lumotlaringiz saytga chiqishga tasdiqlandi.'));
end;
$$;
revoke execute on function ustoz_cv_tasdiqla(text) from public, anon;
grant execute on function ustoz_cv_tasdiqla(text) to authenticated, service_role;

drop function if exists ustoz_cv_qaytar(text, text);
create or replace function ustoz_cv_qaytar(p_teacher text, p_izoh text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_manager() then
    raise exception 'CV ni manager qaytaradi.';
  end if;
  if length(trim(coalesce(p_izoh, ''))) = 0 then
    raise exception 'Nima tuzatilishi kerakligini yozing.';
  end if;
  perform set_config('ustoz_profil.tasdiq', '1', true);
  update teacher_profil set holat = 'qaytarildi', qaytarish_izoh = trim(p_izoh) where teacher_id = p_teacher;
  if not found then
    raise exception 'Ustoz topilmadi.';
  end if;
  perform set_config('ustoz_profil.tasdiq', '', true);

  insert into bildirishnomalar (turi, sarlavha, matn, havola, havola_matn, kimga, filtr, muhim, tugash, yaratdi, manba)
  values ('eslatma', 'CV qaytarildi', trim(p_izoh), '/crm/malumotlarim', 'Tuzatish',
          array['ustoz'], jsonb_build_object('ustoz', p_teacher), true, now() + interval '14 days', auth.uid(), 'ustoz_profil');
  return jsonb_build_object('tg', ustoz_tg_chatlar(p_teacher, 'CV qaytarildi', trim(p_izoh)));
end;
$$;
revoke execute on function ustoz_cv_qaytar(text, text) from public, anon;
grant execute on function ustoz_cv_qaytar(text, text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 6. Xabar: kim o'zgartirsa — ikkinchi tomonga (30 daq ichida bir marta)
-- ------------------------------------------------------------

drop function if exists ustoz_profil_xabar(text, text);
create or replace function ustoz_profil_xabar(p_teacher text, p_bolim text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ustoz boolean := coalesce(p_teacher = app_teacher_id(), false);
  v_ism   text;
  v_cv    boolean := coalesce(p_bolim, '') not in ('obyektivka', 'mehnat');
  v_soni  int := 0;
  v_tg    jsonb := '[]'::jsonb;
  v_sar   text;
  r       record;
begin
  if not ustoz_profil_huquq(p_teacher) then
    raise exception 'Huquq yo''q.';
  end if;
  select ism into v_ism from teachers where id = p_teacher;

  if v_ustoz then
    -- Adminlarga (xabar) va managerlarga (CV bo'lsa — tasdiq) — direktorga emas
    for r in select id, rol::text as rol from profiles
              where holat = 'faol' and rol::text in ('admin', 'manager') and id <> auth.uid() loop
      continue when exists (select 1 from bildirishnomalar b where b.manba = 'ustoz_profil'
                              and b.filtr ->> 'profil' = r.id::text and b.filtr ->> 'ustoz_id' = p_teacher
                              and b.created_at > now() - interval '30 minutes');
      v_sar := case when r.rol = 'manager' and v_cv then format('%s CV ni o''zgartirdi — tasdiq kutilmoqda', v_ism)
                    else format('%s ma''lumotlarini o''zgartirdi', v_ism) end;
      v_tg := v_tg || coalesce((select jsonb_agg(jsonb_build_object('chat', u.chat_id, 'sarlavha', v_sar,
                                  'matn', coalesce('Bo''lim: ' || p_bolim, ''), 'havola', '/crm/ustozlar/' || p_teacher || '/profil'))
                                from telegram_ulanish u where u.holat = 'faol' and u.profile_id = r.id), '[]'::jsonb);
      insert into bildirishnomalar (turi, sarlavha, matn, havola, havola_matn, kimga, filtr, tugash, yaratdi, manba)
      values ('eslatma', v_sar,
              coalesce('Bo''lim: ' || p_bolim, null),
              '/crm/ustozlar/' || p_teacher || '/profil', 'Ko''rish', array['xodim'],
              jsonb_build_object('profil', r.id, 'ustoz_id', p_teacher), now() + interval '7 days', auth.uid(), 'ustoz_profil');
      v_soni := v_soni + 1;
    end loop;
  else
    -- Ustozga
    if not exists (select 1 from bildirishnomalar b where b.manba = 'ustoz_profil'
                     and b.filtr ->> 'ustoz' = p_teacher and b.created_at > now() - interval '30 minutes') then
      insert into bildirishnomalar (turi, sarlavha, matn, havola, havola_matn, kimga, filtr, tugash, yaratdi, manba)
      values ('eslatma', 'Ma''lumotlaringiz o''zgartirildi', coalesce('Bo''lim: ' || p_bolim, null),
              '/crm/malumotlarim', 'Ko''rish', array['ustoz'], jsonb_build_object('ustoz', p_teacher),
              now() + interval '7 days', auth.uid(), 'ustoz_profil');
      v_soni := 1;
      v_tg := ustoz_tg_chatlar(p_teacher, 'Ma''lumotlaringiz o''zgartirildi', coalesce('Bo''lim: ' || p_bolim, ''));
    end if;
  end if;
  return jsonb_build_object('soni', v_soni, 'tg', v_tg);
end;
$$;
revoke execute on function ustoz_profil_xabar(text, text) from public, anon;
grant execute on function ustoz_profil_xabar(text, text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 7. To'ldirilganlik (rasm, fanlar, tug'ilgan sana, ta'lim — majburiy)
-- ------------------------------------------------------------

create or replace view v_ustoz_toldirish
with (security_invoker = on) as
select t.id as teacher_id,
       x.qolgan,
       round(100.0 * (8 - cardinality(x.qolgan)) / 8)::int as foiz,
       (select array_agg(m) from unnest(x.qolgan) m where m in ('rasm', 'fanlar', 'tugilgan_sana', 'talim')) as majburiy_qolgan,
       p.holat, p.saytda
from teachers t
join teacher_profil p on p.teacher_id = t.id
left join teacher_shaxsiy s on s.teacher_id = t.id
cross join lateral (
  select array_remove(array[
    case when p.rasm_yol is null then 'rasm' end,
    case when coalesce(trim(p.tavsif), '') = '' then 'tavsif' end,
    case when cardinality(p.fanlar) = 0 then 'fanlar' end,
    case when p.dars_boshlagan_yil is null then 'tajriba' end,
    case when s.tugilgan_sana is null then 'tugilgan_sana' end,
    case when not exists (select 1 from teacher_talim e where e.teacher_id = t.id) then 'talim' end,
    case when not exists (select 1 from teacher_mehnat m where m.teacher_id = t.id) then 'mehnat' end,
    case when s.pasport is null or s.jshshir is null or s.manzil is null then 'pasport' end
  ], null) as qolgan
) x
where t.holat = 'faol';
grant select on v_ustoz_toldirish to authenticated;


-- ------------------------------------------------------------
-- 8. Ommaviy sayt (anon): faqat saytda=true va tasdiqlangan nusxa,
--    korinish sozlamasi va har qatorning saytda bayrog'i bilan
-- ------------------------------------------------------------

create or replace function ommaviy_ustozlar(p_slug text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(u order by (u ->> 'tartib')::int, u ->> 'ism'), '[]'::jsonb)
  from (
    select jsonb_strip_nulls(jsonb_build_object(
      'slug', p.slug,
      'tartib', p.sayt_tartib,
      'ism', o ->> 'ism',
      'rasm_yol', case when (k ->> 'rasm')::boolean then o ->> 'rasm_yol' end,
      'tavsif', case when (k ->> 'tavsif')::boolean then o ->> 'tavsif' end,
      'fanlar', case when (k ->> 'fanlar')::boolean then o -> 'fanlar' end,
      'dars_boshlagan_yil', case when (k ->> 'tajriba')::boolean then o -> 'dars_boshlagan_yil' end,
      'tillar', case when (k ->> 'tillar')::boolean then o -> 'tillar' end,
      'talim', case when (k ->> 'talim')::boolean then o -> 'talim' end,
      'sertifikatlar', case when (k ->> 'sertifikatlar')::boolean then (
        select coalesce(jsonb_agg(case when s.fayl_saytda then x else x - 'fayl_yol' end), '[]'::jsonb)
        from jsonb_array_elements(o -> 'sertifikatlar') x
        join teacher_sertifikat s on s.id = (x ->> 'id')::bigint and s.saytda) end,
      'yutuqlar', case when (k ->> 'yutuqlar')::boolean then (
        select coalesce(jsonb_agg(case when y.fayl_saytda then x else x - 'fayl_yol' end), '[]'::jsonb)
        from jsonb_array_elements(o -> 'yutuqlar') x
        join teacher_yutuq y on y.id = (x ->> 'id')::bigint and y.saytda) end
    )) as u
    from teacher_profil p
    join teachers t on t.id = p.teacher_id and t.holat = 'faol'
    cross join lateral (select p.ommaviy as o, p.korinish as k) z
    where p.saytda and p.ommaviy is not null and p.slug is not null
      and (p_slug is null or p.slug = p_slug)
  ) q
$$;
revoke execute on function ommaviy_ustozlar(text) from public;
grant execute on function ommaviy_ustozlar(text) to anon, authenticated, service_role;


/* Yopiq hujjat saytda ko'rsatiladimi: fayl_saytda + ustoz saytda + tasdiqlangan nusxada bor */
create or replace function ustoz_hujjat_ommaviymi(p_yol text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teacher_profil p
    where p.saytda and p.ommaviy is not null
      and (exists (select 1 from teacher_sertifikat s where s.teacher_id = p.teacher_id and s.fayl_yol = p_yol and s.saytda and s.fayl_saytda
                     and p.ommaviy -> 'sertifikatlar' @> jsonb_build_array(jsonb_build_object('fayl_yol', p_yol)))
           or exists (select 1 from teacher_yutuq y where y.teacher_id = p.teacher_id and y.fayl_yol = p_yol and y.saytda and y.fayl_saytda
                     and p.ommaviy -> 'yutuqlar' @> jsonb_build_array(jsonb_build_object('fayl_yol', p_yol))))
  )
$$;
revoke execute on function ustoz_hujjat_ommaviymi(text) from public;
grant execute on function ustoz_hujjat_ommaviymi(text) to anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 9. Storage: 'ustoz-rasm' (ochiq), 'ustoz-hujjat' (yopiq). Yo'l: '<teacher_id>/...'
--    (sof Postgres testida storage sxemasi bo'lmasa — o'tkazib yuboriladi)
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice '0126: storage sxemasi yo''q — bucketlar o''tkazib yuborildi';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('ustoz-rasm', 'ustoz-rasm', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
                                 allowed_mime_types = excluded.allowed_mime_types;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('ustoz-hujjat', 'ustoz-hujjat', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
                                 allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists ustoz_fayl_oqi on storage.objects';
  execute 'drop policy if exists ustoz_fayl_qosh on storage.objects';
  execute 'drop policy if exists ustoz_fayl_yangila on storage.objects';
  execute 'drop policy if exists ustoz_fayl_ochir on storage.objects';
  execute 'drop policy if exists ustoz_hujjat_ommaviy on storage.objects';

  execute $p$create policy ustoz_fayl_oqi on storage.objects for select to authenticated
    using (bucket_id in ('ustoz-rasm', 'ustoz-hujjat') and public.ustoz_profil_huquq((storage.foldername(name))[1]))$p$;
  execute $p$create policy ustoz_fayl_qosh on storage.objects for insert to authenticated
    with check (bucket_id in ('ustoz-rasm', 'ustoz-hujjat') and public.ustoz_profil_huquq((storage.foldername(name))[1]))$p$;
  execute $p$create policy ustoz_fayl_yangila on storage.objects for update to authenticated
    using (bucket_id in ('ustoz-rasm', 'ustoz-hujjat') and public.ustoz_profil_huquq((storage.foldername(name))[1]))$p$;
  execute $p$create policy ustoz_fayl_ochir on storage.objects for delete to authenticated
    using (bucket_id in ('ustoz-rasm', 'ustoz-hujjat') and public.ustoz_profil_huquq((storage.foldername(name))[1]))$p$;
  -- Yopiq hujjat saytga faqat admin "fayl saytda" qilgan va tasdiqlangan bo'lsa
  execute $p$create policy ustoz_hujjat_ommaviy on storage.objects for select to anon, authenticated
    using (bucket_id = 'ustoz-hujjat' and public.ustoz_hujjat_ommaviymi(name))$p$;
end $$;
