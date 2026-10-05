-- ============================================================
--  0055 — Telefon xabarnomalari (Web Push, PWA)
--
--  Har qurilma (brauzer/ilova) xabarnomaga ruxsat bersa — bitta obuna
--  (endpoint + kalitlar). Bitta odamda bir nechta qurilma bo'lishi mumkin.
--  Bitta qurilma faqat BITTA odamga tegishli: boshqa odam o'sha telefonda
--  kirib obuna bo'lsa, eski egasining obunasi o'chadi (push_obuna).
--
--  Yuborish server tomonda (web-push, VAPID). Kimga yuborish — 0047
--  bildirishnoma_menga bilan bir xil qoida, lekin berilgan profil uchun
--  (bildirishnoma_profilga). Obunalar ro'yxatini faqat admin/direktor
--  oladi (push_oluvchilar) — e'lon yaratgan odam nomidan, service_role'siz.
-- ============================================================

create table if not exists push_obunalar (
  id         bigserial primary key,
  profile_id uuid not null references profiles (id) on delete cascade default auth.uid(),
  endpoint   text not null unique check (endpoint ~ '^https://'),
  p256dh     text not null,
  auth       text not null,
  qurilma    text check (qurilma is null or length(qurilma) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists push_obunalar_profile_idx on push_obunalar (profile_id);

comment on table push_obunalar is 'Web Push obunalari: har qurilma uchun bitta (0055). Yozish faqat push_obuna/push_ochir orqali.';

alter table push_obunalar enable row level security;
alter table push_obunalar force row level security;

-- Har kim faqat o'z obunalarini ko'radi; yozish — funksiyalar orqali
drop policy if exists push_obunalar_oz on push_obunalar;
create policy push_obunalar_oz on push_obunalar for select to authenticated
  using (profile_id = auth.uid());

-- ------------------------------------------------------------
-- Obuna bo'lish / bekor qilish (o'zi uchun)
-- ------------------------------------------------------------
create or replace function push_obuna(p_endpoint text, p_p256dh text, p_auth text, p_qurilma text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Kirish kerak.'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then
    raise exception 'Noto''g''ri obuna.';
  end if;
  insert into push_obunalar (profile_id, endpoint, p256dh, auth, qurilma)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_qurilma, 200))
  on conflict (endpoint) do update
    set profile_id = excluded.profile_id, p256dh = excluded.p256dh,
        auth = excluded.auth, qurilma = excluded.qurilma, created_at = now();
end;
$$;

-- O'z qurilmasini o'chirish (chiqishda yoki "o'chirish" tugmasida)
create or replace function push_ochir(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_obunalar where endpoint = p_endpoint and profile_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- Bildirishnoma berilgan profilga tegishlimi (0047 qoidasi, auth.uid() o'rniga p_profile)
-- ------------------------------------------------------------
create or replace function bildirishnoma_profilga(p_profile uuid, p_kimga text[], p_filtr jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_guruh   text := nullif(p_filtr ->> 'guruh', '');
  v_fan     text := nullif(p_filtr ->> 'fan', '');
  v_qarzdor boolean := coalesce((p_filtr ->> 'qarzdor')::boolean, false);
  v_rol     user_role;
  v_student text;
  v_teacher text;
begin
  select rol into v_rol from profiles where id = p_profile and holat = 'faol';
  if v_rol is null then return false; end if;

  if 'xodim' = any (p_kimga) and v_rol in ('admin', 'direktor', 'qabulxona') then return true; end if;

  if 'ustoz' = any (p_kimga) then
    select id into v_teacher from teachers where profile_id = p_profile;
    if v_teacher is not null
       and (v_guruh is null or exists (select 1 from groups g where g.id = v_guruh and g.teacher_id = v_teacher))
       and (v_fan is null or exists (select 1 from groups g where g.subject_id = v_fan and g.teacher_id = v_teacher and g.holat = 'faol'))
    then return true; end if;
  end if;

  if 'oquvchi' = any (p_kimga) then
    select id into v_student from students where profile_id = p_profile;
  end if;
  if v_student is null and 'ota_ona' = any (p_kimga) and v_rol = 'ota_ona' then
    select oquvchi_id into v_student from profiles where id = p_profile;
  end if;
  if v_student is null then return false; end if;

  return exists (select 1 from students s where s.id = v_student and s.holat <> 'ketgan')
     and (v_guruh is null or exists (
           select 1 from enrollments e where e.student_id = v_student and e.group_id = v_guruh and e.holat <> 'tugagan'))
     and (v_fan is null or exists (
           select 1 from enrollments e join groups g on g.id = e.group_id
           where e.student_id = v_student and g.subject_id = v_fan and e.holat <> 'tugagan'))
     and (not v_qarzdor or coalesce((select qarz from v_student_balance where student_id = v_student), 0) > 0);
end;
$$;

-- ------------------------------------------------------------
-- Bildirishnoma kimlarga push qilinadi — faqat admin/direktor chaqiradi
-- ------------------------------------------------------------
create or replace function push_oluvchilar(p_bildirishnoma bigint)
returns table (endpoint text, p256dh text, auth text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_b bildirishnomalar;
begin
  if not app_is_admin() then raise exception 'Faqat admin yoki direktor.'; end if;
  select * into v_b from bildirishnomalar where id = p_bildirishnoma;
  if v_b.id is null or v_b.holat <> 'faol' then return; end if;
  return query
    select o.endpoint, o.p256dh, o.auth
    from push_obunalar o
    where bildirishnoma_profilga(o.profile_id, v_b.kimga, v_b.filtr);
end;
$$;

-- Yuborishda qurilma "yo'q" (404/410) desa — eskirgan obunani o'chirish
create or replace function push_eskirgan(p_endpoint text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_admin() then raise exception 'Faqat admin yoki direktor.'; end if;
  delete from push_obunalar where endpoint = p_endpoint;
end;
$$;

revoke execute on function push_obuna(text, text, text, text) from public, anon;
revoke execute on function push_ochir(text) from public, anon;
revoke execute on function bildirishnoma_profilga(uuid, text[], jsonb) from public, anon, authenticated;
revoke execute on function push_oluvchilar(bigint) from public, anon;
revoke execute on function push_eskirgan(text) from public, anon;
grant execute on function push_obuna(text, text, text, text) to authenticated;
grant execute on function push_ochir(text) to authenticated;
grant execute on function push_oluvchilar(bigint) to authenticated;
grant execute on function push_eskirgan(text) to authenticated;
