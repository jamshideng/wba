-- ============================================================
--  0138 — Reyting asosi: sozlamalar, ketish sababi, testni qayta topshirish
--         (Jamshid, 22.11)
-- ============================================================
--  1. settings['reyting'] — bitta jsonb: vaznlar, chegaralar, koeffitsientlar.
--     Kodsiz o'zgartiriladi (Sozlamalar → Reyting). Har vaznlar to'plami
--     yig'indisi 100 bo'lmasa saqlanmaydi (trigger).
--     reyting_sozlama() — standart qiymatlar ustiga saqlangani.
--  2. royxatlar.ustozga_bogliq — ketish sababi ustozga bog'liqmi
--     (ustoz reytingida: bog'liq / belgilanmagan = 1 ketish, bog'liq emas = 0,25).
--  3. Arxivga o'tkazishda (fan / o'quvchi) va keyin sabab qo'yishda:
--     sabab ro'yxatdan MAJBURIY, izoh MAJBURIY — kamida 3 so'z va 15 belgi.
--     guruhdan_chiqar (xato kiritish) o'zgarmaydi.
--  4. Oylik test: kelmagan o'quvchiga admin/direktor/manager qayta
--     topshirishga ruxsat beradi — eski natija oylik_test_tarix'ga, qator
--     e'londan olinadi, ustoz yangi natijani kiritadi. Reytingda oxirgisi.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Reyting sozlamalari
-- ------------------------------------------------------------
create or replace function reyting_standart() returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'oylik_sana',         6,     -- keyingi oyning shu kuni kechasi oylik reyting hisoblanadi
    'test_muddati_kun',   5,     -- oylik test natijasi keyingi oyning shu kunigacha kiritiladi
    'boshlanish_sana',    null,  -- shu sanadan oldingi ketishlar ustoz reytingiga kirmaydi (null — bugundan)
    'oquvchi_oylik',      jsonb_build_object('test', 50, 'davomat', 30, 'woblar', 20),
    'oquvchi_haftalik',   jsonb_build_object('davomat', 60, 'woblar', 40),
    'ustoz_oylik',        jsonb_build_object('test', 40, 'ushlash', 25, 'kechikish', 15, 'intizom', 10, 'davomat', 10),
    'ustoz_haftalik',     jsonb_build_object('kechikish', 40, 'intizom', 30, 'davomat', 30),
    'min_dars_oylik',     4,     -- kam bo'lsa "yangi", o'rin berilmaydi
    'min_dars_haftalik',  2,
    'woblar_100',         3,     -- bir darsda N woblar = 100 ball
    'bogliq_emas_koef',   0.25,  -- ustozga bog'liq bo'lmagan sabab bilan ketish
    'min_qatnashgan_dars', 2,    -- ketish hisoblanishi uchun kamida shuncha darsga kelgan
    'kechikish_k',        5,     -- har kechikkan daqiqa uchun shuncha ball ayriladi
    'intizom_n',          10,    -- har intizom hodisasi uchun shuncha ball ayriladi
    'oquvchiga_ochiq',    false  -- o'quvchi reytingi o'quvchi, ota-ona va ustozga ko'rinadimi (sinov davrida — yo'q)
  )
$$;

create or replace function reyting_sozlama() returns jsonb
language sql stable security definer set search_path = public as $$
  select reyting_standart() || coalesce((select qiymat from settings where kalit = 'reyting' and jsonb_typeof(qiymat) = 'object'), '{}'::jsonb)
$$;

revoke execute on function reyting_sozlama() from public, anon;
grant  execute on function reyting_sozlama() to authenticated, service_role;

/* Saqlashdan oldin tekshiruv: vaznlar yig'indisi 100, sonlar oralig'i */
create or replace function reyting_sozlama_tekshir() returns trigger
language plpgsql set search_path = public as $$
declare
  s     jsonb;
  v_tur text;
  v_kal text;
  v_jami numeric;
  v_kerak jsonb := jsonb_build_object(
    'oquvchi_oylik',    '["test","davomat","woblar"]'::jsonb,
    'oquvchi_haftalik', '["davomat","woblar"]'::jsonb,
    'ustoz_oylik',      '["test","ushlash","kechikish","intizom","davomat"]'::jsonb,
    'ustoz_haftalik',   '["kechikish","intizom","davomat"]'::jsonb);
begin
  if new.kalit <> 'reyting' then return new; end if;
  if jsonb_typeof(new.qiymat) <> 'object' then
    raise exception 'Reyting sozlamasi obyekt bo''lishi kerak.';
  end if;
  s := reyting_standart() || new.qiymat;

  for v_tur in select jsonb_object_keys(v_kerak) loop
    if jsonb_typeof(s -> v_tur) <> 'object' then
      raise exception '% vaznlari topilmadi.', v_tur;
    end if;
    v_jami := 0;
    for v_kal in select jsonb_array_elements_text(v_kerak -> v_tur) loop
      if jsonb_typeof(s -> v_tur -> v_kal) <> 'number' or (s -> v_tur ->> v_kal)::numeric < 0 then
        raise exception '% → % vazni son bo''lishi kerak (0 yoki ko''p).', v_tur, v_kal;
      end if;
      v_jami := v_jami + (s -> v_tur ->> v_kal)::numeric;
    end loop;
    if v_jami <> 100 then
      raise exception 'Vaznlar yig''indisi 100 bo''lishi kerak (%: %).', v_tur, v_jami;
    end if;
  end loop;

  if (s ->> 'oylik_sana')::int not between 1 and 28 then
    raise exception 'Oylik hisoblash sanasi 1–28 oralig''ida bo''lishi kerak.';
  end if;
  if (s ->> 'test_muddati_kun')::int not between 1 and 28 then
    raise exception 'Test natijasi muddati 1–28 oralig''ida bo''lishi kerak.';
  end if;
  if (s ->> 'min_dars_oylik')::int < 0 or (s ->> 'min_dars_haftalik')::int < 0
     or (s ->> 'min_qatnashgan_dars')::int < 0 then
    raise exception 'Dars chegaralari manfiy bo''lmaydi.';
  end if;
  if (s ->> 'woblar_100')::numeric <= 0 then
    raise exception '"N woblar = 100" uchun N musbat bo''lishi kerak.';
  end if;
  if (s ->> 'bogliq_emas_koef')::numeric not between 0 and 1 then
    raise exception 'Ustozga bog''liq bo''lmagan sabab koeffitsienti 0–1 oralig''ida.';
  end if;
  if (s ->> 'kechikish_k')::numeric < 0 or (s ->> 'intizom_n')::numeric < 0 then
    raise exception 'Kechikish va intizom koeffitsientlari manfiy bo''lmaydi.';
  end if;
  if jsonb_typeof(s -> 'oquvchiga_ochiq') <> 'boolean' then
    raise exception '"O''quvchilarga ochiq" ha/yo''q bo''lishi kerak.';
  end if;
  if s ->> 'boshlanish_sana' is not null and (s ->> 'boshlanish_sana') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Boshlanish sanasi YYYY-MM-DD ko''rinishida.';
  end if;
  return new;
end;
$$;

drop trigger if exists settings_reyting_tekshir on settings;
create trigger settings_reyting_tekshir before insert or update on settings
  for each row execute function reyting_sozlama_tekshir();

-- Boshlanish sanasi — shu migratsiya qo'llangan kun (eski ketishlar kirmaydi)
insert into settings (kalit, qiymat, tavsif)
values ('reyting', reyting_standart() || jsonb_build_object('boshlanish_sana', to_char(bugun_toshkent(), 'YYYY-MM-DD')),
        'O''quvchi va ustoz reytingi sozlamalari (0138) — Sozlamalar → Reyting')
on conflict (kalit) do nothing;

/* Saqlash — admin, direktor, manager (settings RLS'ini kengaytirmasdan) */
create or replace function reyting_sozlama_saqla(p_qiymat jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(app_rol() not in ('admin', 'direktor', 'manager'), true) then
    raise exception 'Reyting sozlamalarini faqat rahbariyat o''zgartiradi.';
  end if;
  insert into settings (kalit, qiymat, tavsif, ozgartirdi)
  values ('reyting', reyting_standart() || p_qiymat, 'O''quvchi va ustoz reytingi sozlamalari (0138)', auth.uid())
  on conflict (kalit) do update set qiymat = excluded.qiymat, ozgartirdi = excluded.ozgartirdi;
  return reyting_sozlama();
end;
$$;

revoke execute on function reyting_sozlama_saqla(jsonb) from public, anon;
grant  execute on function reyting_sozlama_saqla(jsonb) to authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Ketish sababi: ustozga bog'liqmi
-- ------------------------------------------------------------
alter table royxatlar add column if not exists ustozga_bogliq boolean not null default false;

comment on column royxatlar.ustozga_bogliq is
  'Faqat ketish_sabab uchun (0138): true — ustozga bog''liq sabab, ustoz reytingida to''liq 1 ketish.';

update royxatlar set ustozga_bogliq = true
 where tur = 'ketish_sabab' and kalit in ('ustoz', 'natija');

/* Belgini o'zgartirish — admin/direktor/manager */
create or replace function ketish_sabab_bogliq(p_kalit text, p_bogliq boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(app_rol() not in ('admin', 'direktor', 'manager'), true) then
    raise exception 'Huquqingiz yo''q.';
  end if;
  update royxatlar set ustozga_bogliq = coalesce(p_bogliq, false)
   where tur = 'ketish_sabab' and kalit = p_kalit;
  if not found then raise exception 'Sabab topilmadi.'; end if;
end;
$$;

revoke execute on function ketish_sabab_bogliq(text, boolean) from public, anon;
grant  execute on function ketish_sabab_bogliq(text, boolean) to authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Ketish: sabab + izoh majburiy
-- ------------------------------------------------------------
create or replace function ketish_izoh_yaroqli(p_izoh text) returns boolean
language sql immutable as $$
  select length(btrim(coalesce(p_izoh, ''))) >= 15
     and coalesce(array_length(regexp_split_to_array(btrim(coalesce(p_izoh, '')), '\s+'), 1), 0) >= 3
     and btrim(coalesce(p_izoh, '')) <> ''
$$;

create or replace function ketish_tekshir(p_turi text, p_izoh text) returns void
language plpgsql stable set search_path = public as $$
begin
  if coalesce(p_turi, '') = '' then
    raise exception 'Ketish sababini ro''yxatdan tanlang.';
  end if;
  if not exists (select 1 from royxatlar where tur = 'ketish_sabab' and kalit = p_turi and faol) then
    raise exception 'Bunday ketish sababi ro''yxatda yo''q.';
  end if;
  if not ketish_izoh_yaroqli(p_izoh) then
    raise exception 'Izoh majburiy: kamida 3 so''z va 15 belgi.';
  end if;
end;
$$;

create or replace function fan_arxivla(p_enrollment uuid, p_sana date default null, p_turi text default null, p_izoh text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_sana date := coalesce(p_sana, bugun_toshkent());
  e      enrollments%rowtype;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Arxivga o''tkazish huquqingiz yo''q.';
  end if;
  perform ketish_tekshir(p_turi, p_izoh);

  select * into e from enrollments where id = p_enrollment and holat <> 'tugagan' for update;
  if not found then
    raise exception 'Yozilish topilmadi yoki allaqachon yopilgan.';
  end if;

  update enrollments
     set tugadi = greatest(v_sana, boshlandi), holat = 'tugagan',
         ketish_sababi = p_turi, ketish_izoh = btrim(p_izoh)
   where id = p_enrollment;
  delete from invoices where enrollment_id = p_enrollment and davr > to_char(v_sana, 'YYYY-MM');

  if not exists (select 1 from enrollments where student_id = e.student_id and holat <> 'tugagan')
     and exists (select 1 from students where id = e.student_id and holat <> 'ketgan') then
    update students
       set holat = 'ketgan', arxiv_sana = greatest(v_sana, e.boshlandi),
           arxiv_sabab = btrim(p_izoh), ketish_sababi = p_turi
     where id = e.student_id;
    return 'oquvchi';
  end if;
  return 'fan';
end;
$$;

create or replace function oquvchi_arxivla(p_student text, p_sana date default null, p_sabab text default null, p_turi text default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_sana date := coalesce(p_sana, bugun_toshkent());
  v_e    record;
  v_soni int := 0;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Arxivga o''tkazish huquqingiz yo''q.';
  end if;
  if not exists (select 1 from students where id = p_student and holat <> 'ketgan') then
    raise exception 'O''quvchi topilmadi yoki allaqachon arxivda.';
  end if;
  perform ketish_tekshir(p_turi, p_sabab);

  for v_e in select id from enrollments where student_id = p_student and holat <> 'tugagan' loop
    update enrollments
       set tugadi = greatest(v_sana, boshlandi), holat = 'tugagan',
           ketish_sababi = p_turi, ketish_izoh = btrim(p_sabab)
     where id = v_e.id;
    delete from invoices where enrollment_id = v_e.id and davr > to_char(v_sana, 'YYYY-MM');
    v_soni := v_soni + 1;
  end loop;

  update students
     set holat = 'ketgan', arxiv_sana = v_sana, arxiv_sabab = btrim(p_sabab),
         ketish_sababi = p_turi
   where id = p_student;
  return v_soni;
end;
$$;

/* Keyin sabab qo'yish: izoh yangi yoki mavjudi talabga javob bersin */
create or replace function fan_ketish_sababi_belgila(p_enrollment uuid, p_turi text, p_izoh text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_izoh text;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Sababni o''zgartirish huquqingiz yo''q.';
  end if;
  select coalesce(nullif(btrim(p_izoh), ''), ketish_izoh) into v_izoh
    from enrollments where id = p_enrollment and holat = 'tugagan';
  if not found then
    raise exception 'Fan arxivda emas.';
  end if;
  perform ketish_tekshir(p_turi, v_izoh);

  update enrollments set ketish_sababi = p_turi, ketish_izoh = btrim(v_izoh)
   where id = p_enrollment;
end;
$$;

create or replace function ketish_sababi_belgila(p_student text, p_turi text, p_izoh text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_izoh text;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Huquqingiz yo''q.';
  end if;
  select coalesce(nullif(btrim(p_izoh), ''), arxiv_sabab) into v_izoh
    from students where id = p_student and holat = 'ketgan';
  if not found then
    raise exception 'O''quvchi arxivda emas.';
  end if;
  perform ketish_tekshir(p_turi, v_izoh);

  update students set ketish_sababi = p_turi, arxiv_sabab = btrim(v_izoh)
   where id = p_student;
end;
$$;

-- ------------------------------------------------------------
-- 4. Oylik test: qayta topshirish
-- ------------------------------------------------------------
alter table oylik_test_natijalar add column if not exists qayta       boolean not null default false;
alter table oylik_test_natijalar add column if not exists qayta_berdi uuid references profiles (id) on delete set null;
alter table oylik_test_natijalar add column if not exists qayta_vaqt  timestamptz;
-- Ustoz natijani birinchi marta kiritgan vaqt (reytingdagi "muddatida kiritdimi")
alter table oylik_test_natijalar add column if not exists kiritilgan_vaqt timestamptz;
update oylik_test_natijalar set kiritilgan_vaqt = created_at where kiritilgan_vaqt is null;
alter table oylik_test_natijalar alter column kiritilgan_vaqt set default now();

comment on column oylik_test_natijalar.qayta is
  'Kelmagan o''quvchiga qayta topshirishga ruxsat berilgan (0138). Eski natija — oylik_test_tarix.';

create table if not exists oylik_test_tarix (
  id           bigint generated always as identity primary key,
  natija_id    uuid not null references oylik_test_natijalar (id) on delete cascade,
  test_id      uuid not null references oylik_testlar (id) on delete cascade,
  student_id   text not null references students (id) on delete cascade,
  keldi        boolean not null,
  ball         numeric(8, 2),
  bolim_ballar numeric(8, 2)[],
  foiz         numeric(5, 1),
  izoh         text,
  sabab        text not null check (length(btrim(sabab)) between 3 and 500),
  yozdi        uuid references profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

create index if not exists oylik_test_tarix_natija_idx on oylik_test_tarix (natija_id);

alter table oylik_test_tarix enable row level security;
alter table oylik_test_tarix force row level security;

drop policy if exists oylik_test_tarix_staff on oylik_test_tarix;
create policy oylik_test_tarix_staff on oylik_test_tarix for select to authenticated
  using (app_is_staff());

create or replace function oylik_qayta_ruxsat(p_natija uuid, p_sabab text) returns void
language plpgsql security definer set search_path = public as $$
declare
  n oylik_test_natijalar%rowtype;
begin
  if auth.uid() is not null and coalesce(app_rol() not in ('admin', 'direktor', 'manager'), true) then
    raise exception 'Qayta topshirishga faqat rahbariyat ruxsat beradi.';
  end if;
  if length(btrim(coalesce(p_sabab, ''))) < 3 then
    raise exception 'Sababini yozing (masalan: kasal edi).';
  end if;
  select * into n from oylik_test_natijalar where id = p_natija for update;
  if not found then raise exception 'Natija topilmadi.'; end if;
  if n.keldi then
    raise exception 'Qayta topshirish faqat testga kelmagan o''quvchiga.';
  end if;

  insert into oylik_test_tarix (natija_id, test_id, student_id, keldi, ball, bolim_ballar, foiz, izoh, sabab)
  values (n.id, n.test_id, n.student_id, n.keldi, n.ball, n.bolim_ballar, n.foiz, n.izoh, btrim(p_sabab));

  update oylik_test_natijalar
     set qayta = true, qayta_berdi = auth.uid(), qayta_vaqt = now(), elon_qilingan = false
   where id = p_natija;
end;
$$;

revoke execute on function oylik_qayta_ruxsat(uuid, text) from public, anon;
grant  execute on function oylik_qayta_ruxsat(uuid, text) to authenticated, service_role;

/* v_oylik_natijalar — oxiriga qayta topshirish belgisi (0104 dagi ustunlar o'zgarmaydi) */
create or replace view v_oylik_natijalar with (security_invoker = on) as
select n.id, n.test_id, t.davr, t.sana, t.turi, t.maks, t.bolimlar, t.group_id,
       g.nom as guruh, s2.nom as fan, te.ism as ustoz,
       n.student_id, s.fish, n.keldi, n.ball, n.bolim_ballar, n.foiz, n.izoh,
       n.elon_qilingan, n.elon_vaqti,
       case when n.foiz is not null then rank() over (partition by n.test_id order by n.foiz desc nulls last) end as orin,
       n.qayta, n.qayta_vaqt
from oylik_test_natijalar n
join oylik_testlar t on t.id = n.test_id
join groups g on g.id = t.group_id
left join subjects s2 on s2.id = g.subject_id
left join teachers te on te.id = g.teacher_id
join students s on s.id = n.student_id;

grant select on v_oylik_natijalar to authenticated;
