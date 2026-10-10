-- ============================================================
--  0061 — Woblar reytingi = hozirgi balans; admin berilganni ham bekor qiladi
-- ============================================================
--  1. woblr_leaderboard: endi "davrda olgan" emas, HOZIRGI balans
--     (olgan − bekor qilinmagan Market buyurtmalari, v_woblr_balance bilan bir xil).
--     p_davr imzo uchun qoldirildi, e'tiborga olinmaydi.
--  2. market_bekor: admin/direktor "berildi" buyurtmani ham bekor qila oladi
--     (xato berilgan bo'lsa) — woblar o'quvchiga, mahsulot omborga qaytadi.
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
  select row_number() over (order by j.ball desc, j.fish), j.student_id, j.fish, j.ball
  from jamlanma j
  order by j.ball desc, j.fish;
end;
$$;

comment on function woblr_leaderboard is
  'Reyting: HOZIRGI woblar balansi (olgan − Market sarfi). Markaz, fan (p_fan) yoki guruh (p_group). p_davr e''tiborga olinmaydi.';


create or replace function market_bekor(p_kod text, p_sabab text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_b woblr_redemptions;
begin
  select * into v_b from woblr_redemptions where kod = upper(trim(p_kod)) for update;
  if v_b.id is null or v_b.holat = 'bekor' then
    raise exception 'Kod topilmadi yoki buyurtma allaqachon bekor qilingan.';
  end if;
  -- Berilganini faqat admin/direktor qaytaradi
  if v_b.holat = 'berildi' and auth.uid() is not null and not app_is_admin() then
    raise exception 'Berilgan buyurtmani faqat admin bekor qila oladi.';
  end if;
  -- Xodim istalganini, o'quvchi faqat o'zinikini bekor qiladi
  if auth.uid() is not null and not app_is_staff() and v_b.student_id is distinct from app_student_id() then
    raise exception 'Bu buyurtmani bekor qila olmaysiz.';
  end if;

  update woblr_redemptions
     set holat = 'bekor', bekor_sabab = nullif(trim(p_sabab), ''), bekor_qildi = auth.uid()
   where id = v_b.id;

  update woblr_rewards
     set qolgan_soni = qolgan_soni + v_b.soni, updated_at = now()
   where id = v_b.reward_id and not cheksiz;
end;
$$;
