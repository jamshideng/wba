-- ============================================================
--  0095 — Bildirishnoma: "Telegram botga ulaning" (Jamshid, 24.10)
-- ============================================================
--  filtr {"telegram_yoq": true} — @WBAlcBot ga ulanganlarga chiqmaydi
--    (telegram_ulanish: o'quvchi — student_id, ustoz — teacher_id,
--     xodim/ota-ona — profile_id bo'yicha; faqat 'faol').
--  Sayt va ilovada bir xil ko'rinadi (Jamshid: "saytda ham, ilovada ham").
-- ============================================================

create or replace function app_telegram_ulanganmi() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from telegram_ulanish t
    where t.holat = 'faol'
      and (t.profile_id = auth.uid()
           or (t.kim = 'oquvchi' and t.student_id = app_student_id())
           or (t.kim = 'ustoz' and t.teacher_id = app_teacher_id()))
  )
$$;
revoke execute on function app_telegram_ulanganmi() from public, anon;
grant execute on function app_telegram_ulanganmi() to authenticated;

create or replace function bildirishnoma_menga(p_kimga text[], p_filtr jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_guruh   text := nullif(p_filtr ->> 'guruh', '');
  v_fan     text := nullif(p_filtr ->> 'fan', '');
  v_oquvchi text := nullif(p_filtr ->> 'oquvchi', '');
  v_ustozf  text := nullif(p_filtr ->> 'ustoz', '');
  v_profil  text := nullif(p_filtr ->> 'profil', '');
  v_rolf    text := nullif(p_filtr ->> 'rol', '');
  v_qarzdor boolean := coalesce((p_filtr ->> 'qarzdor')::boolean, false);
  v_student text;
  v_teacher text;
begin
  if auth.uid() is null then return false; end if;

  -- 0095: "botga ulaning" kabi xabar — Telegram botga allaqachon ulanganlarga chiqmaydi
  if coalesce((p_filtr ->> 'telegram_yoq')::boolean, false) and app_telegram_ulanganmi() then return false; end if;

  -- 0077: bitta odamga yoki managerlarga
  if v_profil is not null then return auth.uid()::text = v_profil; end if;
  if v_rolf = 'manager' then return app_is_manager(); end if;

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
