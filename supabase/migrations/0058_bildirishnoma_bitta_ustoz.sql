-- ============================================================
--  0058 — Bildirishnoma BITTA ustozga: filtr {"ustoz":"U04"}
--
--  0056 dagi "bitta o'quvchi" kabi: shunday filtrda xabar faqat o'sha
--  ustozga boradi (saytda ham, telefonga push ham). Xodim, boshqa ustoz,
--  o'quvchi va ota-onaga — YO'Q. Qolgan qoida 0056 bilan bir xil.
-- ============================================================

create or replace function bildirishnoma_menga(p_kimga text[], p_filtr jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_guruh   text := nullif(p_filtr ->> 'guruh', '');
  v_fan     text := nullif(p_filtr ->> 'fan', '');
  v_oquvchi text := nullif(p_filtr ->> 'oquvchi', '');
  v_ustozf  text := nullif(p_filtr ->> 'ustoz', '');
  v_qarzdor boolean := coalesce((p_filtr ->> 'qarzdor')::boolean, false);
  v_student text;
  v_teacher text;
begin
  if auth.uid() is null then return false; end if;

  -- Xodim (bitta o'quvchiga mo'ljallangan xabar xodimga chiqmaydi)
  if v_oquvchi is null and v_ustozf is null and 'xodim' = any (p_kimga) and app_is_staff() then return true; end if;

  -- Ustoz
  if v_oquvchi is null and 'ustoz' = any (p_kimga) then
    v_teacher := app_teacher_id();
    if v_teacher is not null
       and (v_guruh is null or exists (select 1 from groups g where g.id = v_guruh and g.teacher_id = v_teacher))
       and (v_ustozf is null or v_teacher = v_ustozf)
       and (v_fan is null or exists (select 1 from groups g where g.subject_id = v_fan and g.teacher_id = v_teacher and g.holat = 'faol'))
    then return true; end if;
  end if;

  -- Bitta ustozga mo'ljallangan xabar o'quvchi/ota-onaga chiqmaydi
  if v_ustozf is not null then return false; end if;

  -- O'quvchi yoki ota-ona — bitta o'quvchi bo'yicha filtr
  if 'oquvchi' = any (p_kimga) then v_student := app_student_id(); end if;
  if v_student is null and 'ota_ona' = any (p_kimga) then
    select oquvchi_id into v_student from profiles where id = auth.uid() and rol = 'ota_ona';
  end if;
  if v_student is null then return false; end if;
  if v_oquvchi is not null and v_student <> v_oquvchi then return false; end if;

  return exists (select 1 from students s where s.id = v_student and s.holat <> 'ketgan')
     and (v_guruh is null or exists (
           select 1 from enrollments e where e.student_id = v_student and e.group_id = v_guruh and e.holat <> 'tugagan'))
     and (v_fan is null or exists (
           select 1 from enrollments e join groups g on g.id = e.group_id
           where e.student_id = v_student and g.subject_id = v_fan and e.holat <> 'tugagan'))
     and (not v_qarzdor or coalesce((select qarz from v_student_balance where student_id = v_student), 0) > 0);
end;
$$;

create or replace function bildirishnoma_profilga(p_profile uuid, p_kimga text[], p_filtr jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_guruh   text := nullif(p_filtr ->> 'guruh', '');
  v_fan     text := nullif(p_filtr ->> 'fan', '');
  v_oquvchi text := nullif(p_filtr ->> 'oquvchi', '');
  v_ustozf  text := nullif(p_filtr ->> 'ustoz', '');
  v_qarzdor boolean := coalesce((p_filtr ->> 'qarzdor')::boolean, false);
  v_rol     user_role;
  v_student text;
  v_teacher text;
begin
  select rol into v_rol from profiles where id = p_profile and holat = 'faol';
  if v_rol is null then return false; end if;

  if v_oquvchi is null and v_ustozf is null and 'xodim' = any (p_kimga) and v_rol in ('admin', 'direktor', 'qabulxona') then return true; end if;

  if v_oquvchi is null and 'ustoz' = any (p_kimga) then
    select id into v_teacher from teachers where profile_id = p_profile;
    if v_teacher is not null
       and (v_guruh is null or exists (select 1 from groups g where g.id = v_guruh and g.teacher_id = v_teacher))
       and (v_ustozf is null or v_teacher = v_ustozf)
       and (v_fan is null or exists (select 1 from groups g where g.subject_id = v_fan and g.teacher_id = v_teacher and g.holat = 'faol'))
    then return true; end if;
  end if;

  -- Bitta ustozga mo'ljallangan xabar o'quvchi/ota-onaga chiqmaydi
  if v_ustozf is not null then return false; end if;

  if 'oquvchi' = any (p_kimga) then
    select id into v_student from students where profile_id = p_profile;
  end if;
  if v_student is null and 'ota_ona' = any (p_kimga) and v_rol = 'ota_ona' then
    select oquvchi_id into v_student from profiles where id = p_profile;
  end if;
  if v_student is null then return false; end if;
  if v_oquvchi is not null and v_student <> v_oquvchi then return false; end if;

  return exists (select 1 from students s where s.id = v_student and s.holat <> 'ketgan')
     and (v_guruh is null or exists (
           select 1 from enrollments e where e.student_id = v_student and e.group_id = v_guruh and e.holat <> 'tugagan'))
     and (v_fan is null or exists (
           select 1 from enrollments e join groups g on g.id = e.group_id
           where e.student_id = v_student and g.subject_id = v_fan and e.holat <> 'tugagan'))
     and (not v_qarzdor or coalesce((select qarz from v_student_balance where student_id = v_student), 0) > 0);
end;
$$;

revoke execute on function bildirishnoma_menga(text[], jsonb) from public, anon;
grant execute on function bildirishnoma_menga(text[], jsonb) to authenticated;
revoke execute on function bildirishnoma_profilga(uuid, text[], jsonb) from public, anon, authenticated;

comment on column bildirishnomalar.filtr is '{} · {"guruh":"G05"} · {"fan":"ingliz-tili"} · {"qarzdor":true} · {"oquvchi":"S016"} (0056) · {"ustoz":"U04"} (0058) — oxirgi ikkisi faqat bildirishnomada';
