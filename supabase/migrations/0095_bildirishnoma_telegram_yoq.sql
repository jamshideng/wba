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

/* Joriy bildirishnoma_menga ga (0077 + 0078 tuzatishi bilan) bitta tekshiruv qo'shiladi —
   0078 dagi kabi matnni almashtirib, oldingi o'zgarishlar saqlanadi. */
do $$
declare
  v_def text := pg_get_functiondef('bildirishnoma_menga(text[], jsonb)'::regprocedure);
  v_bosh text := 'if auth.uid() is null then return false; end if;';
begin
  if v_def like '%telegram_yoq%' then
    return;  -- qayta yurgizilsa
  end if;
  if position(v_bosh in v_def) = 0 then
    raise exception 'bildirishnoma_menga kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_bosh, v_bosh || E'
  -- 0095: botga ulanganlarga chiqmaydi
  if coalesce((p_filtr ->> ''telegram_yoq'')::boolean, false) and app_telegram_ulanganmi() then return false; end if;');
end $$;
