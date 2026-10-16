-- ============================================================
--  0070 — WOBLAR REYTINGI O'QUVCHIGA YOPIQ (Jamshid, 16.10)
--
--  O'quvchi va ustoz reytingdagi qatorlar sonidan markazda nechta bola
--  borligini bilib olardi. Endi:
--    • o'quvchi / ota-ona — TOP 10 + o'zining qatori (o'rni + ball);
--    • ustoz — markaz va fan bo'yicha TOP 10; o'z guruhi — to'liq;
--    • admin / direktor / xodim — avvalgidek hammasi.
--  Cheklov bazada: sahifani chetlab RPC'ni to'g'ridan chaqirsa ham
--  ro'yxat qaytmaydi.
-- ============================================================

create or replace function woblr_leaderboard(
  p_group text default null,
  p_davr  text default null,
  p_fan   text default null
) returns table (orin bigint, student_id text, fish text, ball bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_oquvchi text := app_student_id();
  v_ustoz   text := app_teacher_id();
  -- Xodim bo'lmagan hamma uchun top 10. Faqat ustoz O'Z guruhini to'liq ko'radi
  -- (o'z o'quvchilarini baribir biladi) — markaz/fan bo'yicha esa yo'q.
  v_yopiq   boolean := auth.uid() is not null and not app_is_staff()
                       and (app_teacher_id() is null or p_group is null);
begin
  if auth.uid() is not null and not app_is_staff() then
    if p_group is not null and not (
      (v_ustoz is not null and app_teaches_group(p_group))
      or exists (
        select 1 from enrollments e
        where e.group_id = p_group and e.student_id = v_oquvchi and e.holat <> 'tugagan'
      )
    ) then
      raise exception 'Bu guruh reytingini ko''rish huquqingiz yo''q.';
    end if;

    if p_fan is not null and not exists (
      select 1 from groups g
      where g.subject_id = p_fan
        and (
          (v_ustoz is not null and g.teacher_id = v_ustoz)
          or exists (
            select 1 from enrollments e
            where e.group_id = g.id and e.student_id = v_oquvchi and e.holat <> 'tugagan'
          )
        )
    ) then
      raise exception 'Bu fan reytingini ko''rish huquqingiz yo''q.';
    end if;
  end if;

  return query
  with jamlanma as (
    select s.id as student_id, s.fish,
           (coalesce((select sum(w.ball) from woblr w where w.student_id = s.id), 0)
            - coalesce((select sum(r.ball) from woblr_redemptions r
                        where r.student_id = s.id and r.holat <> 'bekor'), 0))::bigint as ball
    from students s
    where s.holat = 'faol'
      and exists (select 1 from woblr w where w.student_id = s.id)
      and (
        p_group is null
        or exists (
          select 1 from enrollments e
          where e.student_id = s.id and e.group_id = p_group and e.holat <> 'tugagan'
        )
      )
      and (
        p_fan is null
        or exists (
          select 1 from enrollments e
          join groups g on g.id = e.group_id
          where e.student_id = s.id and g.subject_id = p_fan and e.holat <> 'tugagan'
        )
      )
  )
  , tartib as (
    select row_number() over (order by j.ball desc, j.fish) as orin, j.student_id, j.fish, j.ball
    from jamlanma j
  )
  select t.orin, t.student_id, t.fish, t.ball
  from tartib t
  where not v_yopiq or t.orin <= 10 or t.student_id = v_oquvchi
  order by t.orin;
end;
$$;

comment on function woblr_leaderboard is
  'Reyting: HOZIRGI woblar balansi. Markaz, fan (p_fan) yoki guruh (p_group). Xodim bo''lmaganga top 10 (+ o''quvchiga o''z qatori); ustozga o''z guruhi to''liq (0070).';
