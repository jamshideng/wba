-- ============================================================
--  0065 — Woblar market: o'quvchi TAKLIFLARI (istak)
-- ============================================================
--  Jamshid (10.10): Marketda "Taklif yuborish" tugmasi. O'quvchi keyingi
--  bozor uchun yoki umuman taklif yozadi: nomi, rasmi (bo'lsa), havola,
--  tavsifi, qo'shimcha izoh. Admin panelda (Market › Boshqaruv › Takliflar)
--  ko'rinadi; admin holatini o'zgartiradi:
--     yangi → korib_chiqamiz → olib_kelindi ("siz uchun olib kelindi")
--                            ↘ rad_etildi
--  Woblar yechilmaydi — bu faqat istak. Olib kelingach admin uni oddiy
--  mahsulot qilib qo'shadi (forma taklifdan to'ldiriladi).
-- ============================================================

create table if not exists woblr_takliflar (
  id             uuid primary key default gen_random_uuid(),
  student_id     text not null references students (id) on delete cascade,
  nom            text not null check (length(trim(nom)) between 2 and 120),
  tavsif         text check (tavsif is null or length(tavsif) <= 1000),
  havola         text check (havola is null or (havola ~* '^https?://' and length(havola) <= 500)),
  rasm_url       text check (rasm_url is null or length(rasm_url) <= 500),
  taxminiy_narx  int  check (taxminiy_narx is null or taxminiy_narx between 1 and 100000),
  qachon         text not null default 'umumiy' check (qachon in ('keyingi_bozor', 'umumiy')),
  izoh           text check (izoh is null or length(izoh) <= 500),
  holat          text not null default 'yangi'
                 check (holat in ('yangi', 'korib_chiqamiz', 'olib_kelindi', 'rad_etildi')),
  admin_javob    text check (admin_javob is null or length(admin_javob) <= 500),
  korib_chiqdi   uuid references profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists woblr_takliflar_student_idx on woblr_takliflar (student_id, created_at desc);
create index if not exists woblr_takliflar_holat_idx   on woblr_takliflar (holat, created_at desc);

comment on table woblr_takliflar is
  'Woblar market: o''quvchi istaklari (Marketda yo''q narsa). Woblar yechilmaydi; admin holatini boshqaradi.';

alter table woblr_takliflar enable row level security;
alter table woblr_takliflar force row level security;

-- O'quvchi: o'zinikini ko'radi va yangi taklif qo'shadi (faqat o'zi nomidan, faqat 'yangi')
drop policy if exists takliflar_oquvchi_oqish on woblr_takliflar;
create policy takliflar_oquvchi_oqish on woblr_takliflar for select to authenticated
  using (student_id = app_student_id());

drop policy if exists takliflar_oquvchi_yozish on woblr_takliflar;
create policy takliflar_oquvchi_yozish on woblr_takliflar for insert to authenticated
  with check (
    student_id = app_student_id() and holat = 'yangi'
    and admin_javob is null and korib_chiqdi is null
  );

-- Xodim: hammasini ko'radi; holat va javobni admin/direktor/qabulxona o'zgartiradi
drop policy if exists takliflar_xodim_oqish on woblr_takliflar;
create policy takliflar_xodim_oqish on woblr_takliflar for select to authenticated
  using (app_is_staff());

drop policy if exists takliflar_xodim_ozgartirish on woblr_takliflar;
create policy takliflar_xodim_ozgartirish on woblr_takliflar for update to authenticated
  using (app_is_staff()) with check (app_is_staff());

-- Xodim o'zgartirsa ham taklif mazmuni (nima so'ralgan) o'zgarmaydi — faqat holat/javob
create or replace function taklif_ozgarish() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.student_id is distinct from old.student_id or new.nom is distinct from old.nom
     or new.tavsif is distinct from old.tavsif or new.havola is distinct from old.havola
     or new.rasm_url is distinct from old.rasm_url or new.taxminiy_narx is distinct from old.taxminiy_narx
     or new.qachon is distinct from old.qachon or new.izoh is distinct from old.izoh
     or new.created_at is distinct from old.created_at then
    raise exception 'Taklif mazmunini o''zgartirib bo''lmaydi — faqat holat va javob.';
  end if;
  new.updated_at := now();
  new.korib_chiqdi := coalesce(auth.uid(), new.korib_chiqdi);
  return new;
end;
$$;

drop trigger if exists taklif_ozgarish on woblr_takliflar;
create trigger taklif_ozgarish before update on woblr_takliflar
  for each row execute function taklif_ozgarish();

drop trigger if exists woblr_takliflar_audit on woblr_takliflar;
create trigger woblr_takliflar_audit after insert or update or delete on woblr_takliflar
  for each row execute function audit_trigger();

-- Bir o'quvchidan kuniga ko'pi bilan 10 ta taklif (spam bo'lmasin)
create or replace function taklif_cheklov() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from woblr_takliflar
       where student_id = new.student_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Bir kunda 10 tadan ko''p taklif yuborib bo''lmaydi.';
  end if;
  return new;
end;
$$;
revoke execute on function taklif_cheklov() from public, anon, authenticated;

drop trigger if exists taklif_cheklov on woblr_takliflar;
create trigger taklif_cheklov before insert on woblr_takliflar
  for each row execute function taklif_cheklov();


-- Rasm: o'quvchi faqat "takliflar/<o'z uid>/..." ga yuklaydi (market bucket ommaviy o'qiladi)
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage yo''q — taklif rasmlari siyosati o''tkazib yuborildi';
    return;
  end if;
  execute $p$ drop policy if exists market_taklif_rasm on storage.objects $p$;
  execute $p$ create policy market_taklif_rasm on storage.objects for insert to authenticated
              with check (bucket_id = 'market'
                          and name like 'takliflar/' || auth.uid()::text || '/%'
                          and public.app_student_id() is not null) $p$;
end $$;
