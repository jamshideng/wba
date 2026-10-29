-- ============================================================
--  0104 — Oylik test natijalari (Jamshid, 28.10)
-- ============================================================
--  Har oy har guruh bitta oylik test yozadi. Natijani USTOZ kiritadi,
--  ADMIN (admin / direktor / manager) e'lon qiladi — e'lon qilinmagan
--  natijani o'quvchi va ota-ona ko'rmaydi.
--
--  Test turi guruhga qarab ustozning o'zi tanlaydi:
--    · 'foiz'      — natija to'g'ridan-to'g'ri foizda (0–100);
--    · 'ball'      — 34/40 kabi: maks ball bir marta, har o'quvchiga ball;
--    · 'bolimlar'  — ustoz o'zi qo'shgan bo'limlar, har biri o'z shkalasi bilan
--                    (Grammar 100 = foiz, Writing 9 = band…), har biri alohida
--                    ko'rsatiladi; umumiy foiz = yozilgan bo'limlar foizining
--                    o'rtachasi (100 lik bo'lim 9 lik bo'limni bosib ketmasin);
--    · 'ielts'     — Listening, Reading, Writing, Speaking (0–9, 0.5 qadam);
--                    ball = Overall band (IELTS yaxlitlash: o'rtacha .25 → .5,
--                    .75 → keyingi butun), foiz = Overall / 9.
--  Foiz bazada hisoblanadi (trigger), ilovada emas.
--
--  Huquq:
--    · xodim (app_is_staff) — hammasi;
--    · ustoz — faqat o'z guruhi, faqat e'lon qilinmagan natija;
--    · e'lon qilish / qaytarish — faqat admin, direktor, manager;
--    · o'quvchi / ota-ona — faqat o'ziniki va faqat e'lon qilingani.
-- ============================================================

create table if not exists oylik_testlar (
  id          uuid primary key default gen_random_uuid(),
  group_id    text not null references groups (id) on delete restrict,
  davr        text not null check (davr ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  sana        date,
  turi        text not null default 'ball' check (turi in ('foiz', 'ball', 'bolimlar', 'ielts')),
  maks        numeric(8, 2) check (maks is null or maks > 0),
  -- [{"nom": "Reading", "maks": 40}, ...] — faqat 'bolimlar' turida
  bolimlar    jsonb not null default '[]'::jsonb check (jsonb_typeof(bolimlar) = 'array'),
  izoh        text,
  kiritdi     uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (group_id, davr)
);

comment on table oylik_testlar is
  'Oylik test (0104): har guruhga oyiga bitta. Turi: foiz / ball (maks) / bolimlar (har bo''lim maks bilan).';

create table if not exists oylik_test_natijalar (
  id             uuid primary key default gen_random_uuid(),
  test_id        uuid not null references oylik_testlar (id) on delete cascade,
  student_id     text not null references students (id) on delete cascade,
  keldi          boolean not null default true,
  -- 'foiz' turida — foizning o'zi, 'ball' turida — ball, 'ielts' — Overall band
  ball           numeric(8, 2) check (ball is null or ball >= 0),
  -- 'bolimlar' turida — har bo'lim balli, oylik_testlar.bolimlar tartibida
  bolim_ballar   numeric(8, 2)[],
  foiz           numeric(5, 1),          -- trigger hisoblaydi
  izoh           text,
  elon_qilingan  boolean not null default false,
  elon_vaqti     timestamptz,
  elon_qildi     uuid,
  kiritdi        uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (test_id, student_id)
);

create index if not exists oylik_test_natijalar_student_idx on oylik_test_natijalar (student_id);

comment on column oylik_test_natijalar.foiz is
  'Bazada hisoblanadi (0104): foiz turida = ball; ball turida = ball / maks; bolimlar = bo''limlar foizining o''rtachasi; ielts = Overall / 9. Kelmagan — NULL.';

-- ------------------------------------------------------------
--  Foiz hisobi va tekshiruv
-- ------------------------------------------------------------

create or replace function oylik_natija_foiz() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t        oylik_testlar;
  jami_m   numeric := 0;
  jami_b   numeric := 0;
  i        int;
  m        numeric;
begin
  select * into t from oylik_testlar where id = new.test_id;
  new.updated_at := now();

  if not new.keldi then
    new.ball := null;
    new.bolim_ballar := null;
    new.foiz := null;
    return new;
  end if;

  if t.turi = 'ielts' then
    new.ball := null;
    new.foiz := null;
    if new.bolim_ballar is null or coalesce(array_length(new.bolim_ballar, 1), 0) = 0 then
      return new;
    end if;
    for i in 1 .. 4 loop
      if new.bolim_ballar[i] is not null
         and (new.bolim_ballar[i] < 0 or new.bolim_ballar[i] > 9 or new.bolim_ballar[i] * 2 <> floor(new.bolim_ballar[i] * 2)) then
        raise exception 'IELTS band 0 dan 9 gacha, 0.5 qadam bilan bo''ladi (masalan 6.5)';
      end if;
    end loop;
    -- Overall faqat 4 bo'lim ham yozilganda
    if new.bolim_ballar[1] is not null and new.bolim_ballar[2] is not null
       and new.bolim_ballar[3] is not null and new.bolim_ballar[4] is not null then
      new.ball := floor((new.bolim_ballar[1] + new.bolim_ballar[2] + new.bolim_ballar[3] + new.bolim_ballar[4]) / 4 * 2 + 0.5) / 2;
      new.foiz := round(new.ball * 100 / 9, 1);
    end if;
    return new;
  end if;

  if t.turi = 'bolimlar' then
    if new.bolim_ballar is null or coalesce(array_length(new.bolim_ballar, 1), 0) = 0 then
      new.foiz := null;
      return new;
    end if;
    -- jami_m — yozilgan bo'limlar soni, jami_b — ularning foizlari yig'indisi
    for i in 0 .. jsonb_array_length(t.bolimlar) - 1 loop
      m := (t.bolimlar -> i ->> 'maks')::numeric;
      if new.bolim_ballar[i + 1] is not null then
        if new.bolim_ballar[i + 1] < 0 or new.bolim_ballar[i + 1] > m then
          raise exception '% bo''limi uchun ball 0 dan % gacha bo''lishi kerak', t.bolimlar -> i ->> 'nom', m;
        end if;
        jami_m := jami_m + 1;
        jami_b := jami_b + new.bolim_ballar[i + 1] * 100 / m;
      end if;
    end loop;
    new.ball := null;
    new.foiz := case when jami_m > 0 then round(jami_b / jami_m, 1) end;
  else
    m := case when t.turi = 'foiz' then 100 else t.maks end;
    if new.ball is null or m is null then
      new.foiz := null;
    else
      if new.ball > m then
        raise exception 'Ball % dan oshmasligi kerak', m;
      end if;
      new.foiz := round(new.ball * 100 / m, 1);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists oylik_natija_foiz on oylik_test_natijalar;
create trigger oylik_natija_foiz before insert or update on oylik_test_natijalar
  for each row execute function oylik_natija_foiz();

/* E'lon faqat admin/direktor/manager qo'lida. Ustoz e'lon qilingan
   natijaga tegolmaydi (RLS ham to'sadi — bu ikkinchi qavat). */
create or replace function oylik_natija_elon_qoidasi() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  elonchi boolean := coalesce(app_rol() in ('admin', 'direktor', 'manager'), false)
                     or auth.uid() is null;  -- service_role / migratsiya
begin
  if tg_op = 'INSERT' then
    if new.elon_qilingan and not elonchi then
      raise exception 'Natijani faqat admin e''lon qiladi';
    end if;
  else
    if (new.elon_qilingan is distinct from old.elon_qilingan) and not elonchi then
      raise exception 'Natijani faqat admin e''lon qiladi';
    end if;
    if old.elon_qilingan and not elonchi then
      raise exception 'E''lon qilingan natijani faqat admin o''zgartiradi';
    end if;
  end if;
  if new.elon_qilingan and (tg_op = 'INSERT' or not old.elon_qilingan) then
    new.elon_vaqti := now();
    new.elon_qildi := auth.uid();
  elsif not new.elon_qilingan then
    new.elon_vaqti := null;
    new.elon_qildi := null;
  end if;
  return new;
end;
$$;

drop trigger if exists oylik_natija_elon on oylik_test_natijalar;
create trigger oylik_natija_elon before insert or update on oylik_test_natijalar
  for each row execute function oylik_natija_elon_qoidasi();

/* Test sozlamasi (tur, maks, bo'limlar) o'zgarsa — natijalar foizi qayta
   hisoblanadi. E'lon qilingan natijasi bor testni ustoz o'zgartirolmaydi. */
create or replace function oylik_test_ozgardi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE'
     and (new.turi, new.maks, new.bolimlar) is distinct from (old.turi, old.maks, old.bolimlar) then
    if not coalesce(app_rol() in ('admin', 'direktor', 'manager'), auth.uid() is null)
       and exists (select 1 from oylik_test_natijalar where test_id = new.id and elon_qilingan) then
      raise exception 'Natijalari e''lon qilingan testni faqat admin o''zgartiradi';
    end if;
  end if;
  if new.turi = 'ielts' then
    new.maks := 9;
    new.bolimlar := '[{"nom":"Listening","maks":9},{"nom":"Reading","maks":9},{"nom":"Writing","maks":9},{"nom":"Speaking","maks":9}]'::jsonb;
  end if;
  if new.turi = 'ball' and new.maks is null then
    raise exception 'Ball turida maksimal ball kerak';
  end if;
  if new.turi = 'bolimlar' and jsonb_array_length(new.bolimlar) = 0 then
    raise exception 'Kamida bitta bo''lim qo''shing';
  end if;
  return new;
end;
$$;

drop trigger if exists oylik_test_ozgardi on oylik_testlar;
create trigger oylik_test_ozgardi before insert or update on oylik_testlar
  for each row execute function oylik_test_ozgardi();

create or replace function oylik_test_qayta_hisob() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.turi, new.maks, new.bolimlar) is distinct from (old.turi, old.maks, old.bolimlar) then
    update oylik_test_natijalar set updated_at = now() where test_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists oylik_test_qayta_hisob on oylik_testlar;
create trigger oylik_test_qayta_hisob after update on oylik_testlar
  for each row execute function oylik_test_qayta_hisob();

-- ------------------------------------------------------------
--  RLS
-- ------------------------------------------------------------

/* Siyosatlar bir-birini chaqirib aylanib qolmasin (testlar ↔ natijalar) —
   kesishgan tekshiruvlar security definer funksiyada. */
create or replace function oylik_test_guruhi(p_test uuid) returns text
language sql stable security definer set search_path = public as $$
  select group_id from oylik_testlar where id = p_test
$$;

create or replace function oylik_test_menga_ochiqmi(p_test uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from oylik_test_natijalar n
     where n.test_id = p_test and n.elon_qilingan
       and n.student_id in (app_student_id(), app_farzand_id())
  )
$$;

grant execute on function oylik_test_guruhi(uuid), oylik_test_menga_ochiqmi(uuid) to authenticated;

alter table oylik_testlar enable row level security;
alter table oylik_testlar force row level security;
alter table oylik_test_natijalar enable row level security;
alter table oylik_test_natijalar force row level security;

drop policy if exists oylik_testlar_staff on oylik_testlar;
create policy oylik_testlar_staff on oylik_testlar for all to authenticated
  using (app_is_staff()) with check (app_is_staff());

drop policy if exists oylik_testlar_ustoz_oqish on oylik_testlar;
create policy oylik_testlar_ustoz_oqish on oylik_testlar for select to authenticated
  using (app_teaches_group(group_id));

drop policy if exists oylik_testlar_ustoz_yozish on oylik_testlar;
create policy oylik_testlar_ustoz_yozish on oylik_testlar for insert to authenticated
  with check (app_teaches_group(group_id));

drop policy if exists oylik_testlar_ustoz_tahrir on oylik_testlar;
create policy oylik_testlar_ustoz_tahrir on oylik_testlar for update to authenticated
  using (app_teaches_group(group_id)) with check (app_teaches_group(group_id));

drop policy if exists oylik_testlar_oz on oylik_testlar;
create policy oylik_testlar_oz on oylik_testlar for select to authenticated
  using (oylik_test_menga_ochiqmi(id));

drop policy if exists oylik_natijalar_staff on oylik_test_natijalar;
create policy oylik_natijalar_staff on oylik_test_natijalar for all to authenticated
  using (app_is_staff()) with check (app_is_staff());

drop policy if exists oylik_natijalar_ustoz_oqish on oylik_test_natijalar;
create policy oylik_natijalar_ustoz_oqish on oylik_test_natijalar for select to authenticated
  using (app_teaches_group(oylik_test_guruhi(test_id)));

drop policy if exists oylik_natijalar_ustoz_yozish on oylik_test_natijalar;
create policy oylik_natijalar_ustoz_yozish on oylik_test_natijalar for insert to authenticated
  with check (not elon_qilingan
              and app_teaches_group(oylik_test_guruhi(test_id)));

drop policy if exists oylik_natijalar_ustoz_tahrir on oylik_test_natijalar;
create policy oylik_natijalar_ustoz_tahrir on oylik_test_natijalar for update to authenticated
  using (not elon_qilingan
         and app_teaches_group(oylik_test_guruhi(test_id)))
  with check (not elon_qilingan
              and app_teaches_group(oylik_test_guruhi(test_id)));

drop policy if exists oylik_natijalar_oz on oylik_test_natijalar;
create policy oylik_natijalar_oz on oylik_test_natijalar for select to authenticated
  using (elon_qilingan and student_id in (app_student_id(), app_farzand_id()));

grant select, insert, update, delete on oylik_testlar, oylik_test_natijalar to authenticated;

-- ------------------------------------------------------------
--  Ko'rinish: natija + guruh, fan, ustoz, guruhdagi o'rin
--  (security_invoker — RLS saqlanadi)
-- ------------------------------------------------------------

create or replace view v_oylik_natijalar with (security_invoker = on) as
select n.id, n.test_id, t.davr, t.sana, t.turi, t.maks, t.bolimlar,
       t.group_id, g.nom as guruh, s2.nom as fan, te.ism as ustoz,
       n.student_id, s.fish, n.keldi, n.ball, n.bolim_ballar, n.foiz, n.izoh,
       n.elon_qilingan, n.elon_vaqti,
       case when n.foiz is not null then
         rank() over (partition by n.test_id order by n.foiz desc nulls last)
       end as orin
  from oylik_test_natijalar n
  join oylik_testlar t on t.id = n.test_id
  join groups g on g.id = t.group_id
  left join subjects s2 on s2.id = g.subject_id
  left join teachers te on te.id = g.teacher_id
  join students s on s.id = n.student_id;

grant select on v_oylik_natijalar to authenticated;

/* O'quvchi/ota-ona uchun: o'z natijasi va guruhdagi o'rni. O'rin
   faqat e'lon qilingan natijalar orasida — boshqalarning bali chiqmaydi,
   faqat "N tadan M-o'rin". */
create or replace function oylik_natijalarim()
returns table (davr text, guruh text, fan text, turi text, maks numeric, bolimlar jsonb,
               keldi boolean, ball numeric, bolim_ballar numeric[], foiz numeric,
               izoh text, orin bigint, jami bigint)
language sql stable security definer set search_path = public as $$
  with e as (
    select n.*, rank() over (partition by n.test_id order by n.foiz desc nulls last) as orin,
           count(n.foiz) over (partition by n.test_id) as jami
      from oylik_test_natijalar n
     where n.elon_qilingan
       and n.test_id in (select test_id from oylik_test_natijalar
                          where student_id in (app_student_id(), app_farzand_id()) and elon_qilingan)
  )
  select t.davr, g.nom, s2.nom, t.turi, t.maks, t.bolimlar,
         e.keldi, e.ball, e.bolim_ballar, e.foiz, e.izoh,
         case when e.foiz is not null then e.orin end, e.jami
    from e
    join oylik_testlar t on t.id = e.test_id
    join groups g on g.id = t.group_id
    left join subjects s2 on s2.id = g.subject_id
   where e.student_id in (app_student_id(), app_farzand_id())
   order by t.davr desc, g.nom
$$;

grant execute on function oylik_natijalarim() to authenticated;

-- ------------------------------------------------------------
--  E'lon xabari (Jamshid, 28.10): natija e'lon qilinganda o'quvchi
--  va ota-onaga — saytga kirganda chiqadigan eslatma (bildirishnoma),
--  telefon (push) va Telegram. Bildirishnomani trigger yozadi; push va
--  Telegram'ni server (after) oylik_xabar_manzil orqali yuboradi.
--  Har natijaga bitta tashqi xabar: qayta e'londa Telegram qayta ketmaydi.
-- ------------------------------------------------------------

create table if not exists oylik_test_xabar (
  natija_id         uuid primary key references oylik_test_natijalar (id) on delete cascade,
  bildirishnoma_id  bigint references bildirishnomalar (id) on delete set null,
  tashqi_yuborildi  boolean not null default false,
  created_at        timestamptz not null default now()
);

alter table oylik_test_xabar enable row level security;
alter table oylik_test_xabar force row level security;
drop policy if exists oylik_test_xabar_staff on oylik_test_xabar;
create policy oylik_test_xabar_staff on oylik_test_xabar for select to authenticated using (app_is_staff());
grant select on oylik_test_xabar to authenticated;

/* 70.50 → '70.5', 7.0 → '7' */
create or replace function oylik_son(p numeric) returns text
language sql immutable as $$ select trim_scale(p)::text $$;

/* Xabar matni: "Oktabr 2026 · Ingliz tili" + natija qatori */
create or replace function oylik_xabar_matni(p_natija uuid, out sarlavha text, out matn text)
language plpgsql stable security definer set search_path = public as $$
declare
  n   oylik_test_natijalar;
  t   oylik_testlar;
  nom text;
  oy  text[] := array['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  q   text;
begin
  select * into n from oylik_test_natijalar where id = p_natija;
  select * into t from oylik_testlar where id = n.test_id;
  select coalesce(s.nom, g.nom) into nom from groups g left join subjects s on s.id = g.subject_id where g.id = t.group_id;

  if not n.keldi then
    q := 'Testga kelmagan';
  elsif t.turi = 'foiz' then
    q := 'Natija: ' || coalesce(oylik_son(n.ball) || '%', '—');
  elsif t.turi = 'ball' then
    q := 'Natija: ' || coalesce(oylik_son(n.ball), '—') || ' / ' || oylik_son(t.maks) || coalesce(' (' || oylik_son(n.foiz) || '%)', '');
  elsif t.turi = 'ielts' then
    select string_agg(left(b ->> 'nom', 1) || ' ' || coalesce(to_char(n.bolim_ballar[i], 'FM0.0'), '—'), ' · ' order by i)
      into q from jsonb_array_elements(t.bolimlar) with ordinality as x(b, i);
    q := q || coalesce(' · Overall ' || to_char(n.ball, 'FM0.0'), '');
  else
    select string_agg(b ->> 'nom' || ' ' ||
             case when (b ->> 'maks')::numeric = 100 then oylik_son(n.bolim_ballar[i]) || '%'
                  else oylik_son(n.bolim_ballar[i]) || '/' || oylik_son((b ->> 'maks')::numeric) end,
             ' · ' order by i)
      into q from jsonb_array_elements(t.bolimlar) with ordinality as x(b, i)
     where n.bolim_ballar[i] is not null;
    q := coalesce(q, '—') || coalesce(' · umumiy ' || oylik_son(n.foiz) || '%', '');
  end if;

  sarlavha := 'Oylik test natijasi chiqdi';
  matn := oy[substr(t.davr, 6, 2)::int] || ' ' || substr(t.davr, 1, 4) || ' · ' || nom || E'\n' || q
          || coalesce(E'\nUstoz izohi: ' || n.izoh, '');
end;
$$;

create or replace function oylik_natija_elon_xabari() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_x   oylik_test_xabar;
  v_m   record;
  v_bid bigint;
begin
  select * into v_x from oylik_test_xabar where natija_id = new.id;

  if not new.elon_qilingan then
    -- E'londan olindi — eslatma yopiladi
    if v_x.bildirishnoma_id is not null then
      update bildirishnomalar set holat = 'yopilgan' where id = v_x.bildirishnoma_id;
    end if;
    return null;
  end if;
  if tg_op = 'UPDATE' and old.elon_qilingan and old.foiz is not distinct from new.foiz
     and old.bolim_ballar is not distinct from new.bolim_ballar and old.keldi = new.keldi
     and old.izoh is not distinct from new.izoh then
    return null;  -- e'lon qilingan natijada hech narsa o'zgarmadi
  end if;

  select * into v_m from oylik_xabar_matni(new.id);
  if v_x.bildirishnoma_id is not null and exists (select 1 from bildirishnomalar where id = v_x.bildirishnoma_id) then
    update bildirishnomalar
       set sarlavha = v_m.sarlavha, matn = v_m.matn, holat = 'faol',
           tugash = greatest(tugash, now() + interval '7 days')
     where id = v_x.bildirishnoma_id;
    delete from bildirishnoma_holat where bildirishnoma_id = v_x.bildirishnoma_id;  -- qayta chiqsin
  else
    insert into bildirishnomalar (turi, sarlavha, matn, havola, havola_matn, kimga, filtr, tugash, yaratdi, manba)
    values ('eslatma', v_m.sarlavha, v_m.matn, '/crm', 'Natijani ko‘rish',
            array['oquvchi', 'ota_ona'], jsonb_build_object('oquvchi', new.student_id),
            now() + interval '7 days', auth.uid(), 'oylik_test')
    returning id into v_bid;
    insert into oylik_test_xabar (natija_id, bildirishnoma_id) values (new.id, v_bid)
    on conflict (natija_id) do update set bildirishnoma_id = excluded.bildirishnoma_id;
  end if;
  return null;
end;
$$;

drop trigger if exists oylik_natija_elon_xabari on oylik_test_natijalar;
create trigger oylik_natija_elon_xabari after insert or update on oylik_test_natijalar
  for each row execute function oylik_natija_elon_xabari();

/* Push va Telegram manzillari — faqat e'lon qila oladiganga, har natijaga bir marta */
create or replace function oylik_xabar_manzil(p_natija uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_x oylik_test_xabar;
  v_b bildirishnomalar;
  v_n oylik_test_natijalar;
  v_m record;
begin
  if not coalesce(app_rol() in ('admin', 'direktor', 'manager'), false) then
    raise exception 'Huquq yo''q.';
  end if;
  select * into v_n from oylik_test_natijalar where id = p_natija and elon_qilingan;
  select * into v_x from oylik_test_xabar where natija_id = p_natija;
  if v_n.id is null or v_x.natija_id is null or v_x.tashqi_yuborildi then return null; end if;
  select * into v_b from bildirishnomalar where id = v_x.bildirishnoma_id;
  select * into v_m from oylik_xabar_matni(p_natija);
  update oylik_test_xabar set tashqi_yuborildi = true where natija_id = p_natija;

  return jsonb_build_object(
    'student', v_n.student_id,
    'sarlavha', v_m.sarlavha,
    'matn', v_m.matn,
    'push', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', o.endpoint, 'p256dh', o.p256dh, 'auth', o.auth))
      from push_obunalar o
      where v_b.id is not null and bildirishnoma_profilga(o.profile_id, v_b.kimga, v_b.filtr)
    ), '[]'::jsonb),
    'tg', coalesce((
      select jsonb_agg(distinct u.chat_id) from telegram_ulanish u
       where u.student_id = v_n.student_id and u.kim in ('oquvchi', 'ota_ona') and u.holat = 'faol'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function oylik_xabar_manzil(uuid) from public, anon;
grant execute on function oylik_xabar_manzil(uuid) to authenticated;
revoke all on function oylik_xabar_matni(uuid) from public, anon;
