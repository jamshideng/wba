-- ============================================================
--  0096 — Hisobot oqimi: guruh almashtirish "ketdi" ham, "yangi" ham emas
--         (Jamshid, 24.10 — Holidxo'ja Nuretdinov G21 → G29)
-- ============================================================
--  Hisobotlar › O'quvchilar › "Oqim" da tugagan_fan va yangi_fan har bir
--  yozilishni sanardi: bir fan ichida guruh almashtirgan bola eski oyda
--  "ketdi · 1 fan", yangi oyda "yangi · 1 fan" bo'lib chiqardi.
--  Endi: shu fanning boshqa guruhida keyingi kuni davom etgan (yoki
--  oldingi kuni tugagan) yozilish sanalmaydi. guruh_almashtir (0074):
--  eski.tugadi = sana − 1, yangi.boshlandi = sana.
--  hisobot_oquvchilar_ichki joyida yamaladi (0049 dagi nusxa saqlanadi).
-- ============================================================

do $$
declare
  v_def text := pg_get_functiondef('hisobot_oquvchilar_ichki(int)'::regprocedure);
  v_yangi_eski  text := '(select count(*) from enrollments e where e.boshlandi between d.boshi and d.oxiri)';
  v_tugagan_eski text := '(select count(*) from enrollments e where e.tugadi between d.boshi and d.oxiri)';
  v_yangi  text := '(select count(*) from enrollments e where e.boshlandi between d.boshi and d.oxiri
         and not exists (select 1 from enrollments o join groups go on go.id = o.group_id join groups ge on ge.id = e.group_id
                         where o.student_id = e.student_id and o.id <> e.id and go.subject_id = ge.subject_id
                           and o.tugadi between e.boshlandi - 1 and e.boshlandi))';
  v_tugagan text := '(select count(*) from enrollments e where e.tugadi between d.boshi and d.oxiri
         and not exists (select 1 from enrollments o join groups go on go.id = o.group_id join groups ge on ge.id = e.group_id
                         where o.student_id = e.student_id and o.id <> e.id and go.subject_id = ge.subject_id
                           and o.boshlandi between e.tugadi and e.tugadi + 1))';
begin
  if v_def like '%o.tugadi between e.boshlandi - 1%' then
    return;  -- qayta yurgizilsa
  end if;
  if position(v_yangi_eski in v_def) = 0 or position(v_tugagan_eski in v_def) = 0 then
    raise exception 'hisobot_oquvchilar_ichki kutilgan ko''rinishda emas';
  end if;
  execute replace(replace(v_def, v_yangi_eski, v_yangi), v_tugagan_eski, v_tugagan);
end $$;
