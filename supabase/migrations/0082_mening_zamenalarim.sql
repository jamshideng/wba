-- ============================================================
--  0082 — "Kelgusi zamenalarim" (Jamshid, 18.10)
-- ============================================================
--  O'rinbosar ustoz guruhni faqat zamena kuni ko'radi (0075), lekin
--  zamena qo'yilishi bilan uni oldindan bilishi kerak: sana, guruh,
--  kimning o'rniga. Faqat ro'yxat — jurnal baribir o'sha kuni ochiladi.
-- ============================================================

create or replace function mening_zamenalarim()
returns table (sana date, group_id text, guruh text, boshlanish time, tugash time, kimning_orniga text, sabab text)
language sql stable security definer set search_path = public as $$
  select l.sana, g.id, g.nom, g.boshlanish, g.tugash, t.ism, l.zamena_sabab
  from lessons l
  join groups g on g.id = l.group_id
  left join teachers t on t.id = g.teacher_id
  where app_teacher_id() is not null
    and l.zamena_teacher_id = app_teacher_id()
    and l.sana >= bugun_toshkent()
    and l.kochirildi_ga is null
  order by l.sana, g.boshlanish
$$;
revoke execute on function mening_zamenalarim() from public, anon;
grant execute on function mening_zamenalarim() to authenticated;
