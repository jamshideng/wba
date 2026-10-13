-- ============================================================
--  0067 — TAKRORIY O'QUVCHILAR (Jamshid, 13.10)
--
--  Muammo: Sheets'da bitta odam ikki xil ID bilan yozilgan bo'lishi
--  mumkin (ismi boshqacha imlo bilan, masalan "Muhammadeva" va
--  "Muhummadeva"). Tizim ularni ikki odam deb sanaydi — qarz, maosh,
--  hisobotlar ikkiga bo'linadi.
--
--  1) takroriy_oquvchilar() — shubhali juftliklar, sababi bilan:
--       • shaxsiy telefoni bir xil;
--       • ismi juda o'xshash (harf, tutuq belgisi, so'z tartibi farqi);
--       • ota/ona telefoni bir xil VA ismi ham o'xshash. Faqat ota-ona
--         telefoni bir xil bo'lsa — bu aka-uka/opa-singil, chiqmaydi.
--  2) oquvchi_takror_emas — admin "bu boshqa odam" desa, juftlik
--     ro'yxatdan yo'qoladi.
--  3) oquvchi_birlashtir(asosiy, ikkinchi) — ikkinchi ID'ning hamma
--     yozuvlari (qatnashuv, to'lov, davomat, woblar, lid, Telegram,
--     ota-ona hisobi …) asosiyga o'tadi. Ikkinchi O'CHIRILMAYDI —
--     arxivga tushadi ("Birlashtirildi → S014"), izi qoladi.
--     Ikkalasi bitta guruhda faol bo'lsa — to'xtaydi: avval qo'lda
--     bittasini guruhdan chiqarish kerak (qarz ikki marta yozilgan).
--
--  Huquq: faqat admin/direktor.
-- ============================================================

-- Ismni solishtirish uchun: kichik harf, tutuq/apostrof va belgilarsiz,
-- so'zlar alifbo tartibida ("Asilya Muhammadeva" = "Muhammadeva Asilya").
create or replace function ism_kaliti(p text) returns text
language sql immutable set search_path = public as $$
  select coalesce(string_agg(w, ' ' order by w), '')
  from unnest(regexp_split_to_array(
    trim(regexp_replace(
      translate(lower(coalesce(p, '')), 'ʻʼ''‘’`ʹ', ''),
      '[^a-zа-яё0-9]+', ' ', 'g')),
    '\s+')) w
  where w <> '';
$$;

-- Telefonni solishtirish uchun: oxirgi 9 raqam (998 bilan/bilansiz bir xil)
create or replace function tel_kaliti(p text) returns text
language sql immutable set search_path = public as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 9), '');
$$;

-- Ikki matn qanchalik o'xshash: 0..1 (Levenshtein / uzunlik).
-- pg_trgm/fuzzystrmatch'siz, har qanday Postgres'da ishlaydi.
create or replace function matn_oxshashligi(s text, t text) returns numeric
language plpgsql immutable set search_path = public as $$
declare
  m int := length(coalesce(s, ''));
  n int := length(coalesce(t, ''));
  oldingi int[];
  joriy int[];
  i int; j int;
begin
  if m = 0 and n = 0 then return 1; end if;
  if m = 0 or n = 0 then return 0; end if;
  if s = t then return 1; end if;
  oldingi := array(select generate_series(0, n));
  for i in 1..m loop
    joriy := array[i] || array_fill(0, array[n]);
    for j in 1..n loop
      joriy[j + 1] := least(
        oldingi[j + 1] + 1,
        joriy[j] + 1,
        oldingi[j] + case when substr(s, i, 1) = substr(t, j, 1) then 0 else 1 end
      );
    end loop;
    oldingi := joriy;
  end loop;
  return round(1 - oldingi[n + 1]::numeric / greatest(m, n), 3);
end;
$$;

-- Ikki ism (F.I.Sh) qanchalik o'xshash: 0..1.
-- Umumiy so'z bo'lsa (odatda familiya) — u chiqarib tashlanadi va QOLGANI
-- solishtiriladi: "Bahtiyorov Dilbek" ~ "Bahtiyorov Dilnur" → dilbek/dilnur
-- = 0.5 (aka-uka), "Muhammadeva Asilya" ~ "Muhummadeva Asilya" →
-- muhammadeva/muhummadeva = 0.82 (imlo xatosi).
create or replace function ism_oxshashligi(a text, b text) returns numeric
language sql immutable set search_path = public as $$
  with x as (select string_to_array(ism_kaliti(a), ' ') sa, string_to_array(ism_kaliti(b), ' ') sb),
  q as (
    select sa, sb,
      array(select w from unnest(sa) w where w <> all (sb) order by w) ra,
      array(select w from unnest(sb) w where w <> all (sa) order by w) rb
    from x
  )
  select case
    when ism_kaliti(a) = '' or ism_kaliti(b) = '' then 0
    when cardinality(ra) < cardinality(sa) or cardinality(rb) < cardinality(sb)
      then matn_oxshashligi(array_to_string(ra, ' '), array_to_string(rb, ' '))
    else matn_oxshashligi(ism_kaliti(a), ism_kaliti(b))
  end
  from q;
$$;

-- ------------------------------------------------------------
-- "Bu boshqa odam" belgisi
-- ------------------------------------------------------------
create table if not exists oquvchi_takror_emas (
  a          text not null references students (id) on delete cascade,
  b          text not null references students (id) on delete cascade,
  belgiladi  uuid references profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);

comment on table oquvchi_takror_emas is
  'Admin "bu ikkisi boshqa-boshqa odam" degan juftliklar — takroriy ro''yxatida qayta chiqmaydi. a < b.';

alter table oquvchi_takror_emas enable row level security;
alter table oquvchi_takror_emas force row level security;

drop policy if exists oquvchi_takror_emas_admin on oquvchi_takror_emas;
create policy oquvchi_takror_emas_admin on oquvchi_takror_emas for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

grant select, insert, delete on oquvchi_takror_emas to authenticated;
grant all on oquvchi_takror_emas to service_role;

-- ------------------------------------------------------------
-- Shubhali juftliklar
-- ------------------------------------------------------------
create or replace function takroriy_oquvchilar()
returns table (
  a_id        text,
  a_fish      text,
  a_holat     student_status,
  b_id        text,
  b_fish      text,
  b_holat     student_status,
  oxshashlik  numeric,
  sabab       text
)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not app_is_admin() and auth.uid() is not null then
    raise exception 'Faqat admin va direktor uchun.';
  end if;

  return query
  with s as (
    select st.id, st.fish, st.holat, ism_kaliti(st.fish) as k,
           tel_kaliti(st.shaxsiy_tel) as sh,
           array_remove(array[tel_kaliti(st.ota_tel), tel_kaliti(st.ona_tel)], null) as ota_ona
    from students st
    -- Birlashtirib arxivlangani qayta chiqmasin
    where coalesce(st.arxiv_sabab, '') not like 'Birlashtirildi%'
  ),
  juft as (
    select x.id as aid, y.id as bid, x.fish as af, y.fish as bf, x.holat as ah, y.holat as bh,
           ism_oxshashligi(x.fish, y.fish) as o,
           (x.sh is not null and x.sh = y.sh) as shaxsiy,
           (x.ota_ona && y.ota_ona) as oilaviy
    from s x
    join s y on x.id < y.id
    -- Arzon oldindan saralash: kamida bitta umumiy so'z yoki telefon
    where (x.sh is not null and x.sh = y.sh)
       or x.ota_ona && y.ota_ona
       or exists (select 1 from unnest(string_to_array(x.k, ' ')) w1
                  join unnest(string_to_array(y.k, ' ')) w2
                    on length(w1) >= 3 and left(w1, 3) = left(w2, 3))
  )
  select j.aid, j.af, j.ah, j.bid, j.bf, j.bh, j.o,
    concat_ws(' · ',
      case when j.shaxsiy then 'shaxsiy telefoni bir xil' end,
      case when j.oilaviy then 'ota/ona telefoni bir xil' end,
      case when j.o = 1 then 'ismi bir xil' when j.o >= 0.8 then 'ismi juda o''xshash' end)
  from juft j
  where (j.shaxsiy or j.o >= 0.8 or (j.oilaviy and j.o >= 0.7))
    and not exists (select 1 from oquvchi_takror_emas e where e.a = j.aid and e.b = j.bid)
  order by j.shaxsiy desc, j.o desc, j.aid;
end;
$$;

revoke execute on function takroriy_oquvchilar() from public, anon;
grant  execute on function takroriy_oquvchilar() to authenticated, service_role;

-- ------------------------------------------------------------
-- Birlashtirish
-- ------------------------------------------------------------
create or replace function oquvchi_birlashtir(p_asosiy text, p_ikkinchi text)
returns jsonb
-- definer: audit_log ga oddiy foydalanuvchi to'g'ridan-to'g'ri yoza olmaydi.
-- Huquq birinchi qatorda tekshiriladi.
language plpgsql security definer set search_path = public as $$
declare
  a students%rowtype;
  b students%rowtype;
  v_guruh text;
  n_yoz int; n_tol int; n_dav int; n_qolgan int;
begin
  if not app_is_admin() and auth.uid() is not null then
    raise exception 'Birlashtirish faqat admin va direktorga ochiq.';
  end if;
  if p_asosiy = p_ikkinchi then
    raise exception 'Bitta o''quvchini o''zi bilan birlashtirib bo''lmaydi.';
  end if;

  select * into a from students where id = p_asosiy for update;
  select * into b from students where id = p_ikkinchi for update;
  if a.id is null or b.id is null then
    raise exception 'O''quvchi topilmadi.';
  end if;
  if coalesce(b.arxiv_sabab, '') like 'Birlashtirildi%' then
    raise exception '% allaqachon birlashtirilgan.', b.id;
  end if;

  -- Ikkalasi bitta guruhda faol — qarz ikki marta yozilgan, qo'lda hal qilinadi
  select g.nom into v_guruh
  from enrollments e1
  join enrollments e2 on e2.group_id = e1.group_id and e2.student_id = b.id and e2.holat <> 'tugagan'
  join groups g on g.id = e1.group_id
  where e1.student_id = a.id and e1.holat <> 'tugagan'
  limit 1;
  if v_guruh is not null then
    raise exception 'Ikkalasi ham "%" guruhida — avval bittasini guruhdan chiqaring, keyin birlashtiring.', v_guruh;
  end if;

  if a.profile_id is not null and b.profile_id is not null then
    raise exception 'Ikkalasining ham login hisobi bor — avval bittasini o''chiring yoki bloklang.';
  end if;

  update enrollments set student_id = a.id where student_id = b.id;
  get diagnostics n_yoz = row_count;
  update payments set student_id = a.id where student_id = b.id;
  get diagnostics n_tol = row_count;
  -- Bir dars uchun ikkala ID'da belgi bo'lsa — asosiyniki qoladi, ikkinchisi arxivdagi ID'da
  update attendance x set student_id = a.id
  where x.student_id = b.id
    and not exists (select 1 from attendance y where y.lesson_id = x.lesson_id and y.student_id = a.id);
  get diagnostics n_dav = row_count;
  update woblr             set student_id = a.id where student_id = b.id;
  update woblr_redemptions set student_id = a.id where student_id = b.id;
  update woblr_takliflar   set student_id = a.id where student_id = b.id;
  update leads             set student_id = a.id where student_id = b.id;
  update crm_vazifalar     set student_id = a.id where student_id = b.id;
  update profiles          set oquvchi_id = a.id where oquvchi_id = b.id;   -- ota-ona hisoblari
  update telegram_ulanish x set student_id = a.id
  where x.student_id = b.id
    and not exists (select 1 from telegram_ulanish y
                    where y.chat_id = x.chat_id and y.kim = x.kim and y.student_id = a.id);
  update elon_yetkazish x set student_id = a.id
  where x.student_id = b.id
    and not exists (select 1 from elon_yetkazish y
                    where y.elon_id = x.elon_id and y.chat_id = x.chat_id and y.student_id = a.id);

  -- Login hisobi faqat ikkinchida bo'lsa — asosiyga o'tadi
  if a.profile_id is null and b.profile_id is not null then
    update students set profile_id = null where id = b.id;
    update students set profile_id = b.profile_id where id = a.id;
  end if;

  -- Asosiyda bo'sh maydonlar ikkinchidan to'ldiriladi
  update students set
    tugilgan_sana  = coalesce(tugilgan_sana, b.tugilgan_sana),
    ota_tel        = coalesce(ota_tel, b.ota_tel),
    ona_tel        = coalesce(ona_tel, b.ona_tel),
    shaxsiy_tel    = coalesce(shaxsiy_tel, b.shaxsiy_tel),
    qoshilgan_sana = least(qoshilgan_sana, b.qoshilgan_sana),
    izoh           = concat_ws(' · ', izoh, 'Birlashtirildi: ' || b.id || ' ' || b.fish),
    updated_at     = now()
  where id = a.id;

  -- Ikkinchi o'chirilmaydi — arxivga
  update students set
    holat       = 'ketgan',
    arxiv_sana  = coalesce(arxiv_sana, bugun_toshkent()),
    arxiv_sabab = 'Birlashtirildi → ' || a.id,
    updated_at  = now()
  where id = b.id;

  select count(*) into n_qolgan from attendance where student_id = b.id;

  insert into audit_log (profile_id, amal, jadval, obyekt_id, eski, yangi)
  values (auth.uid(), 'BIRLASHTIRISH', 'students', a.id,
          jsonb_build_object('ikkinchi', b.id, 'fish', b.fish),
          jsonb_build_object('qatnashuv', n_yoz, 'tolov', n_tol, 'davomat', n_dav));

  return jsonb_build_object('asosiy', a.id, 'ikkinchi', b.id,
    'qatnashuv', n_yoz, 'tolov', n_tol, 'davomat', n_dav, 'davomat_qoldi', n_qolgan);
end;
$$;

revoke execute on function oquvchi_birlashtir(text, text) from public, anon;
grant  execute on function oquvchi_birlashtir(text, text) to authenticated, service_role;
