-- ============================================================
--  0086 — Guruh limiti tugasa, woblar ustozning JAMI limitidan
-- ============================================================
--  Jamshid (20.10): guruh limiti 0 ga tushsa minusga kirmaydi —
--  keyingi woblar ustozning jami (barcha guruhlar) limitidan ketaveradi.
--    · tekshiruv: beruvchining jami qoldig'i >= berilayotgan woblar
--    · guruh "qoldi" 0 dan pastga tushmaydi; ortig'i "jamidan" maydonida
--    · lock guruh emas, ustoz bo'yicha (ikki guruhdan bir vaqtda berish
--      jami limitni aylanib o'tmasin)
--  Admin/direktor/manager — limitsiz (avvalgidek).
-- ============================================================


/* Ustozning shu oydagi guruhlari (o'zi + zamena qilgani) — limit va sarf bilan */
create or replace function ustoz_woblar_guruhlari(p_ustoz text, p_davr text)
returns table (group_id text, nom text, zamena boolean, limit_ int, berilgan int)
language sql stable security definer set search_path = public as $$
  select g.id, g.nom, g.teacher_id <> p_ustoz,
         ustoz_guruh_woblar_limiti(g.id, p_davr, p_ustoz),
         ustoz_guruh_woblar_sarfi(g.id, p_davr, p_ustoz)
  from groups g
  where g.holat = 'faol'
    and (g.teacher_id = p_ustoz or exists (
      select 1 from lessons l
      where l.group_id = g.id and l.zamena_teacher_id = p_ustoz
        and to_char(l.sana, 'YYYY-MM') = p_davr
    ))
$$;

revoke execute on function ustoz_woblar_guruhlari(text, text) from public, anon, authenticated;
grant execute on function ustoz_woblar_guruhlari(text, text) to service_role;


/* Ustoz limiti: guruh qoldi >= 0, ortig'i 'jamidan'; jami qoldi — umumiy hovuz */
create or replace function ustoz_woblar_limiti(p_ustoz text default null, p_davr text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_ustoz text := coalesce(p_ustoz, app_teacher_id());
  v_davr  text := coalesce(p_davr, to_char(bugun_toshkent(), 'YYYY-MM'));
  v_r     jsonb;
begin
  if v_ustoz is null then return null; end if;
  if auth.uid() is not null and v_ustoz is distinct from app_teacher_id() and not app_is_staff() then
    raise exception 'Bu ustozning limitini ko''ra olmaysiz.';
  end if;

  select jsonb_build_object(
    'davr', v_davr,
    'stavka', coalesce((select (qiymat #>> '{}')::numeric from settings
                        where kalit = 'woblr.oylik_stavka' and jsonb_typeof(qiymat) = 'number'), 3),
    'jami', jsonb_build_object(
      'limit',    coalesce(sum(g.limit_), 0),
      'berilgan', coalesce(sum(g.berilgan), 0),
      'qoldi',    coalesce(sum(g.limit_ - g.berilgan), 0)
    ),
    'guruhlar', coalesce(jsonb_agg(jsonb_build_object(
      'group_id', g.group_id, 'nom', g.nom, 'limit', g.limit_, 'berilgan', g.berilgan,
      'qoldi',   greatest(g.limit_ - g.berilgan, 0),
      'jamidan', greatest(g.berilgan - g.limit_, 0),
      'zamena',  g.zamena
    ) order by g.nom), '[]'::jsonb)
  ) into v_r
  from ustoz_woblar_guruhlari(v_ustoz, v_davr) g;
  return v_r;
end;
$$;


/* Jami limit tekshiruvi — woblr trigger va probniy uchun bitta joyda */
create or replace function ustoz_woblar_limit_tekshir(p_ustoz text, p_ball int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_davr  text := to_char(bugun_toshkent(), 'YYYY-MM');
  v_qoldi int;
begin
  perform pg_advisory_xact_lock(hashtext('woblr-limit:' || p_ustoz || ':' || v_davr));
  select coalesce(sum(limit_ - berilgan), 0)::int into v_qoldi
  from ustoz_woblar_guruhlari(p_ustoz, v_davr);
  if p_ball > v_qoldi then
    raise exception 'Oylik limit: jami % woblar qoldi (barcha guruhlar).', greatest(v_qoldi, 0);
  end if;
end;
$$;

revoke execute on function ustoz_woblar_limit_tekshir(text, int) from public, anon, authenticated;


/* Limit triggeri (0075 dan): guruh tekshiruvi o'rniga jami */
create or replace function woblr_guruh_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is null and new.lesson_id is not null then
    select group_id into new.group_id from lessons where id = new.lesson_id;
  end if;
  if new.group_id is null and new.teacher_id is not null then
    select e.group_id into new.group_id
    from enrollments e join groups g on g.id = e.group_id
    where e.student_id = new.student_id and g.teacher_id = new.teacher_id and e.holat <> 'tugagan'
    order by g.nom limit 1;
  end if;

  if coalesce(current_setting('wba.woblr_kochir', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' and auth.uid() is not null and not app_is_admin() then
    if new.group_id is null or not app_teaches_group(new.group_id) or not exists (
      select 1 from enrollments e
      where e.group_id = new.group_id and e.student_id = new.student_id and e.holat <> 'tugagan'
    ) then
      raise exception 'O''quvchi sizning guruhingizda topilmadi.';
    end if;
    if new.ball > 0 then
      perform ustoz_woblar_limit_tekshir(app_teacher_id(), new.ball);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function woblr_guruh_limit() from public, anon, authenticated;


/* Probniyga woblar (0075 dan): limit — jami */
create or replace function probniy_woblar_ber(p_group text, p_lead uuid, p_ball int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_dars  uuid;
  v_ustoz text;
  v_bugun date := bugun_toshkent();
  v_jami  int;
begin
  if auth.uid() is not null and not (app_teaches_group(p_group) or app_is_admin()) then
    raise exception 'Bu guruhda woblar berish huquqingiz yo''q.';
  end if;
  if p_ball is null or p_ball = 0 then
    raise exception 'Woblar 0 bo''lmasin.';
  end if;
  if not exists (
    select 1 from leads
    where id = p_lead and group_id = p_group and student_id is null
      and holat in ('yangi', 'qongiroq', 'keldi')
  ) then
    raise exception 'Probniy bu guruhda emas.';
  end if;

  select id into v_dars from lessons where group_id = p_group and sana = v_bugun;
  if v_dars is null then
    if not exists (select 1 from groups where id = p_group and guruh_dars_kunimi(kunlar, v_bugun)) then
      raise exception 'Bugun bu guruhning dars kuni emas.';
    end if;
    insert into lessons (group_id, sana) values (p_group, v_bugun)
    on conflict (group_id, sana) do nothing;
    select id into v_dars from lessons where group_id = p_group and sana = v_bugun;
  end if;

  v_ustoz := case when app_teacher_id() is not null and app_teaches_group(p_group)
                  then app_teacher_id() else dars_ustozi(p_group, v_bugun) end;

  if auth.uid() is not null and not app_is_admin() and p_ball > 0 then
    perform ustoz_woblar_limit_tekshir(v_ustoz, p_ball);
  end if;

  insert into probniy_woblar (lead_id, lesson_id, group_id, teacher_id, bergan_profile, ball)
  values (p_lead, v_dars, p_group, v_ustoz, auth.uid(), p_ball);

  select coalesce(sum(ball), 0)::int into v_jami
  from probniy_woblar where lesson_id = v_dars and lead_id = p_lead;
  return v_jami;
end;
$$;

revoke execute on function probniy_woblar_ber(text, uuid, int) from public, anon;
grant execute on function probniy_woblar_ber(text, uuid, int) to authenticated, service_role;
