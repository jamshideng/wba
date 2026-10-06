-- ============================================================
--  0059 — Lidlar kanbani va Vazifalar (LeaderCRM'dan olingan g'oya)
--
--  1) leads: keyingi aloqa sanasi, teglar, bosqich sababi, aloqa
--     hisobi. Kanban ustunlari holat + sinov_sana dan hisoblanadi.
--  2) crm_vazifalar: qabulxona ishi — qo'ng'iroq, to'lov eslatish,
--     sinov darsiga chaqirish. Lid yoki o'quvchiga bog'lanadi.
--  3) Lidga "keyingi aloqa" qo'yilsa — o'sha kuni 09:00 (Toshkent)
--     ga avtomatik vazifa. Bitta lidga bitta ochiq avto-vazifa.
--
--  Huquq: faqat xodim (app_is_staff) — ustoz ko'rmaydi (botdagi qoida).
--
--  Prod'da boshqa "vazifalar" jadvali bor (Kunlik reja, migratsiyasiz
--  yaratilgan) — unga TEGILMAYDI, shuning uchun bu jadval crm_vazifalar.
--  leads.keyingi_aloqa prod'da timestamptz bo'lib allaqachon bor — o'sha
--  ishlatiladi (sana tanlansa 09:00 Toshkent).
-- ============================================================

alter table leads
  add column if not exists keyingi_aloqa timestamptz,
  add column if not exists teglar        text[] not null default '{}',
  add column if not exists sabab         text,
  add column if not exists aloqa_soni    int    not null default 0,
  add column if not exists oxirgi_aloqa  timestamptz;

comment on column leads.keyingi_aloqa is 'Qachon qayta bog''lanish kerak. Qo''yilsa avto-vazifa ochiladi (crm_vazifalar).';
comment on column leads.sabab is 'Oxirgi bosqich o''zgarishi sababi (masalan: narx mos kelmadi).';

create index if not exists leads_keyingi_aloqa_idx on leads (keyingi_aloqa) where student_id is null;

-- ------------------------------------------------------------
--  crm_vazifalar
-- ------------------------------------------------------------

do $$ begin
  create type vazifa_turi as enum ('qongiroq', 'tolov_eslatish', 'sinov_chaqirish', 'boshqa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vazifa_holat as enum ('yangi', 'jarayonda', 'bajarildi', 'bekor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vazifa_muhimlik as enum ('past', 'orta', 'yuqori');
exception when duplicate_object then null; end $$;

create table if not exists crm_vazifalar (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null check (length(btrim(nom)) between 1 and 200),
  turi         vazifa_turi     not null default 'qongiroq',
  muddat       timestamptz     not null,
  holat        vazifa_holat    not null default 'yangi',
  muhimlik     vazifa_muhimlik not null default 'orta',
  lead_id      uuid references leads (id) on delete cascade,
  student_id   text references students (id) on delete cascade,
  masul        uuid references profiles (id) on delete set null,
  izoh         text check (izoh is null or length(izoh) <= 1000),
  avto         boolean not null default false,
  yaratdi      uuid references profiles (id) on delete set null default auth.uid(),
  bajardi      uuid references profiles (id) on delete set null,
  bajarildi_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint crm_vazifalar_bitta_bogliq check (lead_id is null or student_id is null)
);

comment on table crm_vazifalar is 'Qabulxona vazifalari va eslatmalari. Avto (avto=true) — lidning keyingi aloqa sanasidan.';

create index if not exists crm_vazifalar_holat_muddat_idx on crm_vazifalar (holat, muddat);
create index if not exists crm_vazifalar_lead_idx    on crm_vazifalar (lead_id);
create index if not exists crm_vazifalar_student_idx on crm_vazifalar (student_id);
create index if not exists crm_vazifalar_masul_idx   on crm_vazifalar (masul);
create index if not exists crm_vazifalar_yaratdi_idx on crm_vazifalar (yaratdi);
create index if not exists crm_vazifalar_bajardi_idx on crm_vazifalar (bajardi);
-- Bitta lidga bitta ochiq avto-vazifa
create unique index if not exists crm_vazifalar_lead_avto_uq
  on crm_vazifalar (lead_id) where avto and holat in ('yangi', 'jarayonda');

drop trigger if exists crm_vazifalar_set_updated_at on crm_vazifalar;
create trigger crm_vazifalar_set_updated_at before update on crm_vazifalar
  for each row execute function set_updated_at();

drop trigger if exists crm_vazifalar_audit on crm_vazifalar;
create trigger crm_vazifalar_audit after insert or update or delete on crm_vazifalar
  for each row execute function audit_trigger();

/* Bajarildi belgilansa — kim va qachon; qaytarilsa tozalanadi. */
create or replace function vazifa_bajarildi_belgi()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.holat = 'bajarildi' and (tg_op = 'INSERT' or old.holat is distinct from 'bajarildi') then
    new.bajarildi_at := now();
    new.bajardi := coalesce(auth.uid(), new.bajardi);
  elsif new.holat <> 'bajarildi' then
    new.bajarildi_at := null;
    new.bajardi := null;
  end if;
  return new;
end $$;

drop trigger if exists crm_vazifalar_bajarildi on crm_vazifalar;
create trigger crm_vazifalar_bajarildi before insert or update on crm_vazifalar
  for each row execute function vazifa_bajarildi_belgi();

alter table crm_vazifalar enable row level security;
alter table crm_vazifalar force row level security;

drop policy if exists crm_vazifalar_staff on crm_vazifalar;
create policy crm_vazifalar_staff on crm_vazifalar for all to authenticated
  using (app_is_staff()) with check (app_is_staff());

grant select, insert, update, delete on crm_vazifalar to authenticated;

-- ------------------------------------------------------------
--  Lid → avto-vazifa
-- ------------------------------------------------------------

create or replace function lead_avto_vazifa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Yopilgan lid (o'quvchi bo'ldi yoki rad/kelmadi) — ochiq avto-vazifa bekor
  if new.student_id is not null or new.holat in ('yozildi', 'rad', 'kelmadi') or new.keyingi_aloqa is null then
    update crm_vazifalar set holat = 'bekor'
     where lead_id = new.id and avto and holat in ('yangi', 'jarayonda');
    return new;
  end if;

  if tg_op = 'INSERT' or new.keyingi_aloqa is distinct from old.keyingi_aloqa then
    insert into crm_vazifalar (nom, turi, muddat, lead_id, izoh, avto, yaratdi)
    values (
      'Lid bilan bog''lanish: ' || new.ism,
      case when new.sinov_sana is not null then 'sinov_chaqirish'::vazifa_turi else 'qongiroq'::vazifa_turi end,
      new.keyingi_aloqa,
      new.id,
      'Avtomatik eslatma: ' || to_char(new.keyingi_aloqa at time zone 'Asia/Tashkent', 'DD.MM.YYYY HH24:MI') || ' da ' || new.ism || ' (' || new.telefon || ') bilan bog''laning.',
      true,
      auth.uid()
    )
    on conflict (lead_id) where avto and holat in ('yangi', 'jarayonda')
    do update set muddat = excluded.muddat, nom = excluded.nom, izoh = excluded.izoh, turi = excluded.turi;
  end if;
  return new;
end $$;

revoke all on function lead_avto_vazifa() from public, anon;

drop trigger if exists leads_avto_vazifa on leads;
create trigger leads_avto_vazifa after insert or update of keyingi_aloqa, holat, student_id on leads
  for each row execute function lead_avto_vazifa();

-- Lidlar ham auditga (kanban harakatlari iz qoldirsin)
drop trigger if exists leads_audit on leads;
create trigger leads_audit after insert or update or delete on leads
  for each row execute function audit_trigger();

-- ------------------------------------------------------------
--  "Bog'lanildi" — bitta atomik amal
-- ------------------------------------------------------------

create or replace function lid_boglanildi(p_lead uuid, p_keyingi date default null, p_izoh text default null)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not app_is_staff() then
    raise exception 'Ruxsat yo''q.';
  end if;

  update leads
     set aloqa_soni   = aloqa_soni + 1,
         oxirgi_aloqa = now(),
         holat        = case when holat = 'yangi' then 'qongiroq'::lead_status else holat end,
         keyingi_aloqa = case when p_keyingi is null then null
                              else (p_keyingi + time '09:00') at time zone 'Asia/Tashkent' end,
         izoh = case when nullif(btrim(p_izoh), '') is null then izoh
                     else concat_ws(E'\n', izoh, to_char(now() at time zone 'Asia/Tashkent', 'DD.MM HH24:MI') || ' — ' || btrim(p_izoh)) end
   where id = p_lead and student_id is null;

  if not found then
    raise exception 'Lid topilmadi yoki allaqachon o''quvchi.';
  end if;

  -- Joriy ochiq avto-vazifa bajarildi (yangi sana bo'lsa trigger yangisini ochadi)
  update crm_vazifalar set holat = 'bajarildi'
   where lead_id = p_lead and avto and holat in ('yangi', 'jarayonda')
     and (p_keyingi is null or muddat < (p_keyingi + time '09:00') at time zone 'Asia/Tashkent');
end $$;

revoke all on function lid_boglanildi(uuid, date, text) from public, anon;
grant execute on function lid_boglanildi(uuid, date, text) to authenticated;
