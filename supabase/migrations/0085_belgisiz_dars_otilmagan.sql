-- 0085 — Belgisiz dars "o'tilmagan" bo'lib qoladi.
-- Muammo: jurnalda katak bosilib, belgi qayta olib tashlansa, lessons.otkazildi = true
-- qolib ketardi. Natijada dars "belgilangan" ko'rinardi va ko'chirish ro'yxatidan tushardi.
-- Yechim: davomat_belgila oxirida belgi ham, mavzu ham, woblar ham qolmasa — otkazildi = false.

create or replace function davomat_belgila(
  p_group    text,
  p_sana     date,
  p_belgilar jsonb
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_dars   uuid;
  v_kunlar smallint[];
  v_soni   int := 0;
  v_ochir  int := 0;
begin
  if auth.uid() is not null and not (app_teaches_group(p_group) or app_is_admin()) then
    raise exception 'Bu guruhga davomat qo''yish huquqingiz yo''q.';
  end if;

  if p_sana > bugun_toshkent() then
    raise exception 'Kelasi kunga davomat qo''yib bo''lmaydi.';
  end if;

  if auth.uid() is not null and not app_is_admin() and p_sana < bugun_toshkent() then
    raise exception 'O''tgan kun davomatini faqat admin tuzatadi.';
  end if;

  select kunlar into v_kunlar from groups where id = p_group;
  if v_kunlar is null then
    raise exception 'Guruh topilmadi.';
  end if;

  select id into v_dars from lessons where group_id = p_group and sana = p_sana;

  if v_dars is null and not guruh_dars_kunimi(v_kunlar, p_sana) then
    raise exception 'Bu kun guruhning dars kuni emas.';
  end if;

  if v_dars is null then
    insert into lessons (group_id, sana, otkazildi)
    values (p_group, p_sana, true)
    on conflict (group_id, sana) do update set otkazildi = true
    returning id into v_dars;
  else
    update lessons set otkazildi = true where id = v_dars and not otkazildi;
  end if;

  -- null → belgini olib tashlash
  delete from attendance a
  using jsonb_each(coalesce(p_belgilar, '{}'::jsonb)) kv
  where a.lesson_id = v_dars
    and a.student_id = kv.key
    and jsonb_typeof(kv.value) = 'null';
  get diagnostics v_ochir = row_count;

  insert into attendance (lesson_id, student_id, holat, belgiladi)
  select v_dars, kv.key, (kv.value #>> '{}')::attendance_status, auth.uid()
  from jsonb_each(coalesce(p_belgilar, '{}'::jsonb)) kv
  where jsonb_typeof(kv.value) = 'string'
    and exists (
      select 1 from enrollments e
      where e.student_id = kv.key and e.group_id = p_group and e.holat <> 'tugagan'
    )
  on conflict (lesson_id, student_id) do update
    set holat = excluded.holat, belgiladi = excluded.belgiladi, updated_at = now();
  get diagnostics v_soni = row_count;

  -- 0085: belgi qolmadi (va mavzu/woblar yo'q) — dars o'tilmagan hisoblanadi
  update lessons l set otkazildi = false
  where l.id = v_dars and l.otkazildi and l.mavzu is null
    and not exists (select 1 from attendance a where a.lesson_id = l.id)
    and not exists (select 1 from woblr w where w.lesson_id = l.id);

  return v_soni + v_ochir;
end;
$$;

comment on function davomat_belgila is
  'Jurnal katagi: {student_id: holat | null}. Woblarga tegmaydi. Ustoz — faqat bugun, admin — o''tgan kunlar ham (Q5).';

revoke execute on function davomat_belgila(text, date, jsonb) from public, anon;
grant  execute on function davomat_belgila(text, date, jsonb) to authenticated, service_role;

-- Bor yozuvlar: sayt davri (02.10 dan), maoshi tasdiqlanmagan oylar
update lessons l set otkazildi = false
where l.otkazildi and l.sana >= date '2026-10-02'
  and l.mavzu is null
  and not maosh_oy_qulfmi(to_char(l.sana, 'YYYY-MM'))
  and not exists (select 1 from attendance a where a.lesson_id = l.id)
  and not exists (select 1 from woblr w where w.lesson_id = l.id);
