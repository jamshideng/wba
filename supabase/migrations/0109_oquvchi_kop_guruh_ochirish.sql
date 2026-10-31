-- ============================================================
-- 0109 — yangi o'quvchini birdan bir nechta guruhga yozish va
--        xato kiritilgan o'quvchini o'chirish
--
-- 1. oquvchi_qosh: p.qoshimcha_guruhlar = [{group_id, boshlandi}].
--    Hammasi bitta tranzaksiyada: bittasi o'xshamasa, o'quvchi ham
--    yaratilmaydi. Chegirma faqat birinchi guruhga yoziladi.
-- 2. oquvchi_xato_ochir: faqat haqiqiy ma'lumoti yo'q o'quvchi
--    o'chadi; bor bo'lsa nima borligi aytiladi. Nusxasi jurnalda.
-- 3. keyingi_id: o'chirilgan ID boshqa bolaga qayta berilmaydi.
-- ============================================================

create or replace function oquvchi_qosh(p jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_g  jsonb;
begin
  if not app_is_staff() then
    raise exception 'O''quvchi qo''shish huquqingiz yo''q.';
  end if;
  if coalesce(trim(p ->> 'fish'), '') = '' then
    raise exception 'Ism familya kiritilmagan.';
  end if;

  v_id := keyingi_id('students', 'S', 3);

  insert into students (id, fish, tugilgan_sana, ota_tel, ona_tel, shaxsiy_tel, izoh, qoshilgan_sana)
  values (
    v_id,
    trim(p ->> 'fish'),
    nullif(p ->> 'tugilgan_sana', '')::date,
    nullif(p ->> 'ota_tel', ''),
    nullif(p ->> 'ona_tel', ''),
    nullif(p ->> 'shaxsiy_tel', ''),
    nullif(p ->> 'izoh', ''),
    bugun_toshkent()
  );

  if coalesce(p ->> 'group_id', '') <> '' then
    perform guruhga_biriktir(v_id, p ->> 'group_id', nullif(p ->> 'boshlandi', '')::date, p);
  end if;

  for v_g in select * from jsonb_array_elements(coalesce(p -> 'qoshimcha_guruhlar', '[]'::jsonb)) loop
    perform guruhga_biriktir(v_id, v_g ->> 'group_id', nullif(v_g ->> 'boshlandi', '')::date, '{}'::jsonb);
  end loop;

  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- O'chirilganlar jurnali
-- ------------------------------------------------------------
create table if not exists oquvchi_ochirilgan (
  student_id    text primary key,
  fish          text not null,
  sabab         text not null,
  nusxa         jsonb not null,
  band_idlar    text[] not null default '{}',   -- yozilishlarning Sheets ID'lari ham band qoladi
  ochirdi       uuid references profiles (id) on delete set null,
  ochirilgan_at timestamptz not null default now()
);

alter table oquvchi_ochirilgan enable row level security;

drop policy if exists oquvchi_ochirilgan_oqish on oquvchi_ochirilgan;
create policy oquvchi_ochirilgan_oqish on oquvchi_ochirilgan
  for select to authenticated using (app_is_admin());

-- Yozish faqat oquvchi_xato_ochir orqali
revoke all on oquvchi_ochirilgan from public, anon;
grant select on oquvchi_ochirilgan to authenticated;

create or replace function keyingi_id(p_jadval text, p_prefiks text, p_uzunlik int default 3)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_yoz int;
  v_och int;
begin
  if p_jadval not in ('students', 'groups', 'teachers') then
    raise exception 'Noma''lum jadval: %', p_jadval;
  end if;
  if p_prefiks !~ '^[A-Z]{1,3}$' then
    raise exception 'Prefiks faqat katta harflar: %', p_prefiks;
  end if;

  perform pg_advisory_xact_lock(hashtext('keyingi_id:' || p_jadval));

  execute format(
    'select coalesce(max(substring(id from %s)::int), 0) from %I where id ~ %L',
    length(p_prefiks) + 1, p_jadval, '^' || p_prefiks || '[0-9]+$'
  ) into v_max;

  if p_jadval = 'students' then
    select coalesce(max(substring(sheets_id from length(p_prefiks) + 1)::int), 0) into v_yoz
    from enrollments where sheets_id ~ ('^' || p_prefiks || '[0-9]+$');

    select coalesce(max(substring(b from length(p_prefiks) + 1)::int), 0) into v_och
    from oquvchi_ochirilgan o, unnest(o.band_idlar || o.student_id) b
    where b ~ ('^' || p_prefiks || '[0-9]+$');

    v_max := greatest(v_max, v_yoz, v_och);
  end if;

  return p_prefiks || lpad((v_max + 1)::text, p_uzunlik, '0');
end;
$$;

-- ------------------------------------------------------------
-- Nima o'chirishga to'sqinlik qiladi — sahifa ham, o'chirish ham shu ro'yxatga qaraydi
-- ------------------------------------------------------------
create or replace function oquvchi_ochirish_tosiqlar(p_student text)
returns text[]
language plpgsql stable security definer set search_path = public as $$
declare
  v text[] := '{}';
  n int;
begin
  if not app_is_admin() then
    raise exception 'O''quvchini o''chirish huquqingiz yo''q.';
  end if;

  select count(*) into n from payments where student_id = p_student;
  if n > 0 then v := v || format('%s ta to''lov', n); end if;

  select count(*) into n from attendance where student_id = p_student;
  if n > 0 then v := v || format('%s ta davomat belgisi', n); end if;

  select count(*) into n from woblr where student_id = p_student;
  if n > 0 then v := v || format('%s ta woblar yozuvi', n); end if;

  select count(*) into n from woblr_redemptions where student_id = p_student;
  if n > 0 then v := v || format('%s ta woblar sarfi', n); end if;

  select count(*) into n from woblr_takliflar where student_id = p_student;
  if n > 0 then v := v || format('%s ta Market taklifi', n); end if;

  select count(*) into n from oylik_test_natijalar where student_id = p_student;
  if n > 0 then v := v || format('%s ta oylik test natijasi', n); end if;

  select count(*) into n from tuzatishlar t join enrollments e on e.id = t.enrollment_id
   where e.student_id = p_student;
  if n > 0 then v := v || format('%s ta hisob tuzatishi', n); end if;

  if exists (select 1 from students where id = p_student and profile_id is not null) then
    v := v || 'kabinet hisobi'::text;
  end if;

  if exists (select 1 from profiles where oquvchi_id = p_student) then
    v := v || 'ulangan ota-ona hisobi'::text;
  end if;

  return v;
end;
$$;

create or replace function oquvchi_xato_ochir(p_student text, p_sabab text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_s      students;
  v_tosiq  text[];
  v_nusxa  jsonb;
  v_band   text[];
begin
  if not app_is_admin() then
    raise exception 'O''quvchini o''chirish huquqingiz yo''q.';
  end if;
  if coalesce(trim(p_sabab), '') = '' then
    raise exception 'O''chirish sababini yozing.';
  end if;

  select * into v_s from students where id = p_student for update;
  if not found then
    raise exception 'O''quvchi topilmadi.';
  end if;

  v_tosiq := oquvchi_ochirish_tosiqlar(p_student);
  if cardinality(v_tosiq) > 0 then
    raise exception 'O''chirib bo''lmaydi, o''quvchida bor: %.', array_to_string(v_tosiq, ', ');
  end if;

  select jsonb_build_object(
    'oquvchi', to_jsonb(v_s),
    'yozilishlar', coalesce((select jsonb_agg(to_jsonb(e)) from enrollments e where e.student_id = p_student), '[]'::jsonb),
    'hisoblar', coalesce((select jsonb_agg(to_jsonb(i)) from invoices i
                           join enrollments e on e.id = i.enrollment_id where e.student_id = p_student), '[]'::jsonb),
    'lidlar', coalesce((select jsonb_agg(l.id) from leads l where l.student_id = p_student), '[]'::jsonb)
  ) into v_nusxa;

  select coalesce(array_agg(sheets_id) filter (where sheets_id is not null), '{}') into v_band
    from enrollments where student_id = p_student;

  insert into oquvchi_ochirilgan (student_id, fish, sabab, nusxa, band_idlar, ochirdi)
  values (p_student, v_s.fish, trim(p_sabab), v_nusxa, v_band, auth.uid());

  delete from students where id = p_student;
end;
$$;

revoke execute on function oquvchi_ochirish_tosiqlar(text) from public, anon;
grant  execute on function oquvchi_ochirish_tosiqlar(text) to authenticated;
revoke execute on function oquvchi_xato_ochir(text, text) from public, anon;
grant  execute on function oquvchi_xato_ochir(text, text) to authenticated;
