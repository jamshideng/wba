-- ============================================================
--  0121 — Ulanishlar hisoboti: profilga kirish + ilova + Telegram (Jamshid, 08.11)
-- ============================================================
--  Ota-onalar kabinetga kirishga chaqirildi — kim kirdi, kim kirmadi.
--
--  • profil_kirishlar — har odam saytni yoki ilovani ochganda kuniga
--    ko'pi bilan bir marta profil_belgi() chaqiriladi (brauzer ham, ilova ham).
--  • "Kirgan" = auth.users.last_sign_in_at (Supabase o'zi yozadi — shu
--    migratsiyadan OLDINGI kirishlar ham ko'rinadi) yoki profil_belgi.
--  • ulanishlar_holati() — har faol o'quvchi: o'zi va ota-onasi
--    profilga kirganmi, ilovani o'rnatganmi, botga ulanganmi.
--    Hisobotlar › Ulanishlar (eski /crm/telegram sahifasi shu yerga ko'chdi).
-- ============================================================

create table if not exists profil_kirishlar (
  profile_id  uuid primary key references profiles (id) on delete cascade,
  birinchi    timestamptz not null default now(),
  oxirgi      timestamptz not null default now(),
  kirish_soni int not null default 1
);
comment on table profil_kirishlar is
  'Profilga kirish (sayt yoki ilova ochilganda, kuniga bir marta) — 0121. Yozish faqat profil_belgi() orqali.';

alter table profil_kirishlar enable row level security;
alter table profil_kirishlar force row level security;

drop policy if exists profil_kirishlar_xodim_oqish on profil_kirishlar;
create policy profil_kirishlar_xodim_oqish on profil_kirishlar for select to authenticated
  using (app_is_staff());
revoke all on profil_kirishlar from public, anon;
grant select on profil_kirishlar to authenticated;

-- Faqat o'z nomidan; 6 soatda bir martadan ko'p sanalmaydi
create or replace function profil_belgi()
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  insert into profil_kirishlar (profile_id) values (auth.uid())
  on conflict (profile_id) do update
     set oxirgi = now(),
         kirish_soni = profil_kirishlar.kirish_soni + 1
   where profil_kirishlar.oxirgi < now() - interval '6 hours';
  return true;
end;
$$;
revoke execute on function profil_belgi() from public, anon;
grant execute on function profil_belgi() to authenticated;

drop function if exists ulanishlar_holati();
create or replace function ulanishlar_holati()
returns table (
  student_id      text,
  fish            text,
  guruhlar        text,
  guruh_idlar     text[],
  oquvchi_ulangan int,          -- Telegram
  ota_ona_ulangan int,
  shaxsiy_tel     boolean,
  ota_ona_tel     boolean,
  login_bor       boolean,      -- o'quvchining sayt hisobi bor
  ota_ona_hisob   boolean,      -- ota-ona hisobi (0116) bor
  oquvchi_kirgan  timestamptz,  -- oxirgi kirish (null — hech kirmagan)
  ota_ona_kirgan  timestamptz,
  oquvchi_ilova   boolean,
  ota_ona_ilova   boolean
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not app_is_staff() then
    raise exception 'Faqat xodimlar uchun.';
  end if;
  return query
  select s.id, s.fish,
         (select string_agg(g.nom, ' · ' order by g.nom) from enrollments e join groups g on g.id = e.group_id
           where e.student_id = s.id and e.holat = 'faol'),
         coalesce((select array_agg(e.group_id) from enrollments e where e.student_id = s.id and e.holat = 'faol'), '{}'),
         (select count(*)::int from telegram_ulanish u where u.student_id = s.id and u.kim = 'oquvchi' and u.holat = 'faol'),
         (select count(*)::int from telegram_ulanish u where u.student_id = s.id and u.kim = 'ota_ona' and u.holat = 'faol'),
         tel9(s.shaxsiy_tel) is not null,
         tel9(s.ota_tel) is not null or tel9(s.ona_tel) is not null,
         s.profile_id is not null,
         s.ota_ona_id is not null,
         case when s.profile_id is null then null else greatest(
           (select a.last_sign_in_at from auth.users a where a.id = s.profile_id),
           (select k.oxirgi from profil_kirishlar k where k.profile_id = s.profile_id)) end,
         case when s.ota_ona_id is null then null else greatest(
           (select a.last_sign_in_at from auth.users a where a.id = s.ota_ona_id),
           (select k.oxirgi from profil_kirishlar k where k.profile_id = s.ota_ona_id)) end,
         s.profile_id is not null and exists (select 1 from ilova_qurilmalar i where i.profile_id = s.profile_id),
         s.ota_ona_id is not null and exists (select 1 from ilova_qurilmalar i where i.profile_id = s.ota_ona_id)
  from students s
  where s.holat = 'faol'
  order by s.fish;
end;
$$;
revoke all on function ulanishlar_holati() from public, anon;
grant execute on function ulanishlar_holati() to authenticated;
