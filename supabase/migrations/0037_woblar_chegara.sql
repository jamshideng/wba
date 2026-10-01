-- ============================================================
--  World Bridge Academy
--  0037_woblar_chegara.sql · Sozlamalardagi qiymatlar ishlaydi
--
--  Jamshid (01.10): ustoz maoshi, ko'p fan / birga kelish chegirmasi va
--  bir darsdagi eng ko'p woblarni u o'zi Sozlamalarda belgilaydi.
--
--  1. woblr.max_ball_dars — endi haqiqatan tekshiriladi: o'quvchiga bir
--     darsda berilgan woblar yig'indisi shu qiymatdan oshmaydi.
--     Bo'sh (null) — chegara yo'q. Server (auth.uid() bo'sh) cheklanmaydi.
--  2. Tavsiflar aniqroq — Sozlamalar sahifasida nima yozilishi ko'rinsin.
--     Maosh va chegirma qiymatlari hozircha faqat saqlanadi; ularni
--     ishlatadigan hisob (maosh, avtomatik chegirma) keyingi bosqichda.
-- ============================================================

update settings set tavsif = 'Bir darsda bitta o''quvchiga beriladigan eng ko''p woblar (masalan 5). Bo''sh — chegara yo''q'
 where kalit = 'woblr.max_ball_dars';
update settings set tavsif = 'Ustoz maoshi qoidasi: foiz (masalan {"turi":"foiz","qiymat":40}), oquvchi_soni yoki fiks. Hozircha faqat saqlanadi'
 where kalit = 'maosh.qoida';
update settings set tavsif = '2 va undan ortiq fanga yozilganda har fan uchun chegirma, so''m (masalan 50000). Hozircha faqat saqlanadi'
 where kalit = 'chegirma.kop_fan';
update settings set tavsif = 'Aka-uka / do''st bilan kelganda chegirma, so''m (masalan 50000). Hozircha faqat saqlanadi'
 where kalit = 'chegirma.birga_kelish';


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
begin
  if auth.uid() is not null and not (app_teaches_group(p_group) or app_is_admin()) then
    raise exception 'Bu guruhda woblar berish huquqingiz yo''q.';
  end if;

  if p_ball is null or p_ball = 0 or p_ball < -10 or p_ball > 10 then
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

  -- Sozlamalardagi chegara (jsonb raqam). Oshsa — butun amal bekor bo'ladi.
  select case when jsonb_typeof(qiymat) = 'number' then (qiymat #>> '{}')::numeric end
    into v_max
    from settings where kalit = 'woblr.max_ball_dars';
  if auth.uid() is not null and v_max is not null and v_jami > v_max then
    raise exception 'Bir darsda eng ko''pi % woblar (Sozlamalar). Bu o''quvchida bugun allaqachon %.', v_max, v_jami - p_ball;
  end if;

  return v_jami;
end;
$$;
