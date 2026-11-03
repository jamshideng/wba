-- ============================================================
--  0117 — Ota-ona: sinov darsidagi farzand ham (Jamshid, 03.11)
-- ============================================================
--  Ota-ona hisobi kamida bitta farzand bilan ochiladi; farzand
--  o'quvchi (students) yoki sinov darsidagi bola (leads) bo'lishi mumkin.
--  1. leads.ota_ona_id + tekshiruv (faqat ota-ona profili).
--  2. Ota-ona sinovdagi farzandini ko'radi: ota_ona_lidlarim(),
--     ota_ona_lid_kabinet() — probniy_kabinet_lid (0102) bilan bir xil ma'lumot.
--  3. Admin: ota_ona_lid_biriktir / ota_ona_lid_uzish (admin, manager, direktor).
--  4. Lid guruhga yozilib o'quvchi bo'lganda (student_id) — bog'lanish
--     o'quvchiga o'tadi (students.ota_ona_id).
-- ============================================================

alter table leads add column if not exists ota_ona_id uuid references profiles (id) on delete set null;
create index if not exists leads_ota_ona_idx on leads (ota_ona_id);
comment on column leads.ota_ona_id is
  'Sinov darsidagi bolaning ota-onasi (0117). O''quvchiga aylanganda students.ota_ona_id ga o''tadi.';

create or replace function leads_ota_ona_tekshir() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ota_ona_id is not null and new.ota_ona_id is distinct from old.ota_ona_id
     and not exists (select 1 from profiles where id = new.ota_ona_id and rol = 'ota_ona') then
    raise exception 'Faqat ota-ona hisobini biriktirish mumkin.';
  end if;
  return new;
end;
$$;
drop trigger if exists leads_ota_ona_tekshir on leads;
create trigger leads_ota_ona_tekshir before update of ota_ona_id on leads
  for each row execute function leads_ota_ona_tekshir();

-- Lid o'quvchiga aylandi — ota-ona o'quvchiga o'tadi (o'quvchida boshqa ota-ona bo'lmasa)
create or replace function leads_ota_ona_otkaz() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.student_id is not null and new.ota_ona_id is not null
     and (old.student_id is distinct from new.student_id or old.ota_ona_id is distinct from new.ota_ona_id) then
    update students set ota_ona_id = new.ota_ona_id where id = new.student_id and ota_ona_id is null;
  end if;
  return new;
end;
$$;
drop trigger if exists leads_ota_ona_otkaz on leads;
create trigger leads_ota_ona_otkaz after update of student_id, ota_ona_id on leads
  for each row execute function leads_ota_ona_otkaz();

-- ------------------------------------------------------------
-- Ota-ona tomoni
-- ------------------------------------------------------------
create or replace function app_farzand_lidmi(p_lead uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_lead is not null and auth.uid() is not null
     and exists (select 1 from leads where id = p_lead and ota_ona_id = auth.uid())
$$;
revoke execute on function app_farzand_lidmi(uuid) from public, anon;
grant  execute on function app_farzand_lidmi(uuid) to authenticated, service_role;

/* Sinovdagi farzandlar (hali o'quvchi bo'lmagan) — ota-ona menyusi uchun minimal ma'lumot */
create or replace function ota_ona_lidlarim()
returns table (id uuid, ism text, holat lead_status)
language sql stable security definer set search_path = public as $$
  select l.id, l.ism, l.holat
    from leads l
   where l.ota_ona_id = auth.uid() and l.student_id is null and l.holat not in ('xato', 'rad')
   order by l.ism
$$;
revoke execute on function ota_ona_lidlarim() from public, anon;
grant  execute on function ota_ona_lidlarim() to authenticated;

create or replace function ota_ona_lid_kabinet(p_lead uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (app_farzand_lidmi(p_lead) or app_is_staff()) then
    raise exception 'Bu bola sizning farzandingiz emas.';
  end if;
  return probniy_kabinet_lid(p_lead);
end;
$$;
revoke execute on function ota_ona_lid_kabinet(uuid) from public, anon;
grant  execute on function ota_ona_lid_kabinet(uuid) to authenticated;

-- ------------------------------------------------------------
-- Admin: biriktirish / uzish
-- ------------------------------------------------------------
create or replace function ota_ona_lid_biriktir(p_ota_ona uuid, p_lead uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_l leads;
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Ota-ona biriktirish huquqingiz yo''q.';
  end if;
  if not exists (select 1 from profiles where id = p_ota_ona and rol = 'ota_ona') then
    raise exception 'Ota-ona hisobi topilmadi.';
  end if;
  select * into v_l from leads where id = p_lead;
  if v_l.id is null or v_l.holat in ('xato', 'rad') then
    raise exception 'Sinov darsidagi bola topilmadi.';
  end if;
  -- Allaqachon o'quvchi bo'lgan — o'quvchining o'ziga biriktiriladi
  if v_l.student_id is not null then
    perform ota_ona_biriktir(p_ota_ona, v_l.student_id);
    return;
  end if;
  if v_l.ota_ona_id = p_ota_ona then return; end if;
  if v_l.ota_ona_id is not null then
    raise exception 'Bu bolaga boshqa ota-ona biriktirilgan — avval uni uzing.';
  end if;
  update leads set ota_ona_id = p_ota_ona where id = p_lead;
end;
$$;
revoke execute on function ota_ona_lid_biriktir(uuid, uuid) from public, anon;
grant  execute on function ota_ona_lid_biriktir(uuid, uuid) to authenticated, service_role;

create or replace function ota_ona_lid_uzish(p_lead uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Ota-onani uzish huquqingiz yo''q.';
  end if;
  update leads set ota_ona_id = null where id = p_lead;
end;
$$;
revoke execute on function ota_ona_lid_uzish(uuid) from public, anon;
grant  execute on function ota_ona_lid_uzish(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- Ota-ona farzandsiz qolmaydi (Jamshid, 03.11): oxirgi farzandni uzib bo'lmaydi
-- ------------------------------------------------------------
create or replace function ota_ona_farzand_soni(p_ota_ona uuid) returns int
language sql stable security definer set search_path = public as $$
  select (select count(*) from students where ota_ona_id = p_ota_ona)::int
       + (select count(*) from leads where ota_ona_id = p_ota_ona and student_id is null)::int
$$;
revoke execute on function ota_ona_farzand_soni(uuid) from public, anon;
grant  execute on function ota_ona_farzand_soni(uuid) to authenticated, service_role;

create or replace function ota_ona_uzish(p_student text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ota uuid;
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Ota-onani uzish huquqingiz yo''q.';
  end if;
  select ota_ona_id into v_ota from students where id = p_student;
  if v_ota is not null and ota_ona_farzand_soni(v_ota) <= 1 then
    raise exception 'Bu ota-onaning oxirgi farzandi — uzib bo''lmaydi. Avval boshqa farzand biriktiring.';
  end if;
  update students set ota_ona_id = null where id = p_student;
  update profiles set oquvchi_id = null where oquvchi_id = p_student and rol = 'ota_ona';
  -- Bot ulanishi shu farzand bo'yicha uziladi (ulanish yozuvi — biznes ma'lumoti emas)
  delete from telegram_ulanish where kim = 'ota_ona' and student_id = p_student;
end;
$$;

create or replace function ota_ona_lid_uzish(p_lead uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ota uuid;
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Ota-onani uzish huquqingiz yo''q.';
  end if;
  select ota_ona_id into v_ota from leads where id = p_lead;
  if v_ota is not null and ota_ona_farzand_soni(v_ota) <= 1 then
    raise exception 'Bu ota-onaning oxirgi farzandi — uzib bo''lmaydi. Avval boshqa farzand biriktiring.';
  end if;
  update leads set ota_ona_id = null where id = p_lead;
end;
$$;
