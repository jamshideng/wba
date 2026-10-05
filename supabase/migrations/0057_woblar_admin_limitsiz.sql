-- ============================================================
--  0057 — Admin/direktor uchun woblar chegarasi yo'q
--
--  Jamshid (05.10): admin xohlagancha woblar bera olsin. Ustozga esa
--  qoida o'zgarmaydi: bir martada −10..+10 va Sozlamalardagi
--  woblr.max_ball_dars (bir darsdagi yig'indi).
--
--  1. Jadvaldagi CHECK (−10..+10) endi faqat "0 emas" + aql chegarasi
--     (±100 000, xato bilan ortiqcha nol yozilmasin). ±10 qoidasi
--     BEFORE trigger'ga ko'chdi — u kim yozayotganini biladi.
--  2. woblar_ber (jurnal): ±10 va max_ball_dars — admin/direktorga emas.
--  Server (auth.uid() bo'sh — ko'chirish, cron) avvalgidek cheklanmaydi.
-- ============================================================

alter table woblr drop constraint if exists woblr_ball_check;
alter table woblr add constraint woblr_ball_check check (ball <> 0 and ball between -100000 and 100000);

create or replace function woblr_ustoz_chegara() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_admin() and (new.ball < -10 or new.ball > 10) then
    raise exception 'Woblar −10 dan +10 gacha bo''lsin, 0 emas.';
  end if;
  return new;
end;
$$;
revoke execute on function woblr_ustoz_chegara() from public, anon, authenticated;

drop trigger if exists woblr_ustoz_chegara on woblr;
create trigger woblr_ustoz_chegara before insert or update of ball on woblr
  for each row execute function woblr_ustoz_chegara();

create or replace function woblar_ber(
  p_group   text,
  p_student text,
  p_ball    int
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_dars   uuid;
  v_ustoz  text;
  v_bugun  date := bugun_toshkent();
  v_jami   int;
  v_max    numeric;
  v_admin  boolean := app_is_admin();
begin
  if auth.uid() is not null and not (app_teaches_group(p_group) or v_admin) then
    raise exception 'Bu guruhda woblar berish huquqingiz yo''q.';
  end if;

  if p_ball is null or p_ball = 0 then
    raise exception 'Woblar 0 bo''lmasin.';
  end if;
  if not v_admin and (p_ball < -10 or p_ball > 10) then
    raise exception 'Woblar −10 dan +10 gacha bo''lsin, 0 emas.';
  end if;

  if not exists (
    select 1 from enrollments e
    where e.student_id = p_student and e.group_id = p_group and e.holat <> 'tugagan'
  ) then
    raise exception 'O''quvchi bu guruhda emas.';
  end if;

  select teacher_id into v_ustoz from groups where id = p_group;
  select id into v_dars from lessons where group_id = p_group and sana = v_bugun;

  if v_dars is null then
    if not exists (select 1 from groups where id = p_group and guruh_dars_kunimi(kunlar, v_bugun)) then
      raise exception 'Bugun bu guruhning dars kuni emas — woblarni "Woblar" bo''limidan bering.';
    end if;
    insert into lessons (group_id, sana)
    values (p_group, v_bugun)
    on conflict (group_id, sana) do nothing;
    select id into v_dars from lessons where group_id = p_group and sana = v_bugun;
  end if;

  insert into woblr (student_id, lesson_id, teacher_id, bergan_profile, ball, sabab)
  values (p_student, v_dars, v_ustoz, auth.uid(), p_ball, 'faollik');

  select coalesce(sum(ball), 0)::int into v_jami
  from woblr where lesson_id = v_dars and student_id = p_student;

  -- Sozlamalardagi chegara — faqat ustozga. Oshsa — butun amal bekor bo'ladi.
  select case when jsonb_typeof(qiymat) = 'number' then (qiymat #>> '{}')::numeric end
    into v_max
    from settings where kalit = 'woblr.max_ball_dars';
  if auth.uid() is not null and not v_admin and v_max is not null and v_jami > v_max then
    raise exception 'Bir darsda eng ko''pi % woblar (Sozlamalar). Bu o''quvchida bugun allaqachon %.', v_max, v_jami - p_ball;
  end if;

  return v_jami;
end;
$$;
