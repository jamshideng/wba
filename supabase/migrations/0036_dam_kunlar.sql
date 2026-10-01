-- ============================================================
--  World Bridge Academy
--  0036_dam_kunlar.sql · kanikul / bayram — butun markazda dars yo'q kunlar
--
--  Jamshid (01.10): admin kanikul yoki bayram kunlarini belgilaydi
--  (masalan 1-oktabr — Ustozlar kuni). Bunday kuni:
--    - davomat qilinmaydi, ustozdan "belgilanmagan dars" so'ralmaydi;
--    - bugungi darslar, hisobot, keyingi darslar uni o'tkazib yuboradi;
--    - jurnalda ustun "dam" bo'lib qoladi.
--
--  Hammasi bitta joyda: guruh_dars_kunimi(kunlar, sana) endi dam_kunlar
--  jadvalini ham tekshiradi. Shu funksiyani ishlatadigan hamma narsa
--  (v_bugungi_darslar, tushum_hisobot, keyingi_darslar, generate_lessons,
--  davomat_belgila, woblar_ber, probniy_belgila) o'zi to'g'rilanadi.
--  Funksiya endi IMMUTABLE emas, STABLE (jadvaldan o'qiydi).
--
--  O'sha kuni allaqachon ochilgan dars bo'lsa (belgi qo'yilgan) —
--  o'chirilmaydi; jurnal uni ko'rsataveradi, faqat yangi belgi qo'yilmaydi.
-- ============================================================

create table if not exists dam_kunlar (
  sana       date primary key,
  sabab      text not null check (length(trim(sabab)) > 0),
  kiritdi    uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table dam_kunlar is
  'Butun markazda dars bo''lmaydigan kunlar (kanikul, bayram). Admin/direktor belgilaydi; davomat so''ralmaydi.';

alter table dam_kunlar enable row level security;
alter table dam_kunlar force row level security;

-- Hamma kirgan odam ko'radi (ustoz jurnalda, o'quvchi keyingi darslarda)
drop policy if exists dam_kunlar_read on dam_kunlar;
create policy dam_kunlar_read on dam_kunlar for select to authenticated using (true);

drop policy if exists dam_kunlar_admin on dam_kunlar;
create policy dam_kunlar_admin on dam_kunlar for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

drop trigger if exists dam_kunlar_audit on dam_kunlar;
create trigger dam_kunlar_audit after insert or update or delete on dam_kunlar
  for each row execute function audit_trigger();

-- audit_trigger to_jsonb(new)->>'id' oladi; bu jadvalda id yo'q — sana yoziladi
create or replace function dam_kun_kiritdi() returns trigger
language plpgsql set search_path = public as $$
begin
  new.kiritdi := coalesce(new.kiritdi, auth.uid());
  return new;
end;
$$;

drop trigger if exists dam_kunlar_kiritdi on dam_kunlar;
create trigger dam_kunlar_kiritdi before insert on dam_kunlar
  for each row execute function dam_kun_kiritdi();


create or replace function dam_kunimi(p_sana date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from dam_kunlar where sana = p_sana)
$$;

create or replace function guruh_dars_kunimi(p_kunlar smallint[], p_sana date) returns boolean
language sql stable security definer set search_path = public as $$
  select extract(isodow from p_sana)::smallint = any (p_kunlar)
     and not exists (select 1 from dam_kunlar where sana = p_sana)
$$;

revoke execute on function dam_kunimi(date) from public, anon;
grant  execute on function dam_kunimi(date) to authenticated, service_role;
