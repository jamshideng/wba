-- ============================================================
--  0092 — Ilovani (PWA) o'rnatganlarni sanash (Jamshid, 24.10)
-- ============================================================
--  Ilova ekranga o'rnatilgan holda (display-mode: standalone) ochilsa,
--  brauzer kuniga ko'pi bilan bir marta ilova_belgi() ni chaqiradi.
--  Qurilma — brauzer xotirasidagi tasodifiy ID (bir odam — bir necha qurilma).
--  Hisobotlar › O'quvchilar: o'rnatgan odamlar soni rol bo'yicha,
--  qurilmalar (iPhone / Android / kompyuter), oxirgi 7 kunda ochganlar.
--  Belgi faqat shu migratsiyadan keyingi ochilishlardan yig'iladi.
-- ============================================================

create table if not exists ilova_qurilmalar (
  qurilma     uuid primary key,
  profile_id  uuid not null references profiles (id) on delete cascade,
  platforma   text not null check (platforma in ('iphone', 'android', 'kompyuter')),
  birinchi    timestamptz not null default now(),
  oxirgi      timestamptz not null default now(),
  kirish_soni int not null default 1
);
create index if not exists ilova_qurilmalar_profile_idx on ilova_qurilmalar (profile_id);

comment on table ilova_qurilmalar is 'PWA o''rnatilgan holda ochilgan qurilmalar (0092). Yozish faqat ilova_belgi() orqali.';

alter table ilova_qurilmalar enable row level security;
alter table ilova_qurilmalar force row level security;

drop policy if exists ilova_qurilmalar_xodim_oqish on ilova_qurilmalar;
create policy ilova_qurilmalar_xodim_oqish on ilova_qurilmalar for select to authenticated
  using (app_is_staff());

-- Faqat o'z nomidan; boshqa odamning qurilma ID'sini egallab bo'lmaydi
create or replace function ilova_belgi(p_qurilma uuid, p_platforma text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_qurilma is null then
    return false;
  end if;
  insert into ilova_qurilmalar (qurilma, profile_id, platforma)
  values (p_qurilma, auth.uid(),
          case when p_platforma in ('iphone', 'android', 'kompyuter') then p_platforma else 'kompyuter' end)
  on conflict (qurilma) do update
     set oxirgi = now(),
         kirish_soni = ilova_qurilmalar.kirish_soni + 1,
         profile_id = auth.uid()   -- qurilmada boshqa hisob bilan kirilsa — oxirgisi
   where ilova_qurilmalar.oxirgi < now() - interval '6 hours'
      or ilova_qurilmalar.profile_id <> auth.uid();
  return true;
end;
$$;
revoke execute on function ilova_belgi(uuid, text) from public, anon;
grant execute on function ilova_belgi(uuid, text) to authenticated;

create or replace function hisobot_ilova()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_staff() then
    raise exception 'Hisobot faqat xodimlar uchun.';
  end if;
  return (
    with q as (
      select i.*, p.rol from ilova_qurilmalar i join profiles p on p.id = i.profile_id
    )
    select jsonb_build_object(
      'odam',       (select count(distinct profile_id) from q),
      'qurilma',    (select count(*) from q),
      'hafta',      (select count(distinct profile_id) from q where oxirgi > now() - interval '7 days'),
      'rollar',     coalesce((select jsonb_object_agg(rol, n) from (
                      select rol, count(distinct profile_id) n from q group by rol) r), '{}'::jsonb),
      'platformalar', coalesce((select jsonb_object_agg(platforma, n) from (
                      select platforma, count(*) n from q group by platforma) r), '{}'::jsonb),
      'boshlangan', (select min(birinchi) from q)
    )
  );
end;
$$;
revoke execute on function hisobot_ilova() from public, anon;
grant execute on function hisobot_ilova() to authenticated;
