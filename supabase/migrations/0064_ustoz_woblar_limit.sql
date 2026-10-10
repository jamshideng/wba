-- ============================================================
--  0064 — Ustozning OYLIK woblar limiti (guruh bo'yicha)
-- ============================================================
--  Jamshid (10.10):
--    guruh limiti = Σ (oydagi dars kuni × o'sha kuni guruhdagi o'quvchi) × stavka
--                   stavka = settings 'woblr.oylik_stavka' (3 — bitta darsda bitta bolaga)
--    masalan 12 dars × 5 o'quvchi × 3 = 180 woblar/oy. Oy boshidan butun oy ochiq.
--    ustoz jami limiti = o'z guruhlari yig'indisi.
--    Ustoz xohlasa bir kunda, xohlasa bo'lib-bo'lib beradi — eski ±10 va
--    "bir darsda eng ko'pi" chegaralari OLIB TASHLANADI.
--    Minus (jarima) limitga qaytadi: sarf = shu oyda shu guruhda ustoz bergan
--    woblarning SOF yig'indisi.
--    Admin/direktor — limitsiz (avvalgidek).
--
--  woblr.group_id — woblar qaysi guruh hisobidan. Darsdan (davomat) berilsa —
--  dars guruhi; "Woblar" bo'limidan berilsa — formadagi guruh yoki o'quvchining
--  shu ustozdagi guruhi avtomatik topiladi.
-- ============================================================

insert into settings (kalit, qiymat, tavsif)
values ('woblr.oylik_stavka', '3'::jsonb, 'Ustoz oylik woblar limiti: bitta darsda bitta o''quvchiga (limit = darslar × o''quvchilar × stavka)')
on conflict (kalit) do nothing;

alter table woblr add column if not exists group_id text references groups (id) on delete set null;
create index if not exists woblr_group_idx on woblr (group_id, created_at);

-- Eski yozuvlar: avval darsdan, keyin o'quvchining shu ustozdagi guruhidan
update woblr w set group_id = l.group_id
from lessons l where w.group_id is null and l.id = w.lesson_id;

update woblr w set group_id = (
  select e.group_id from enrollments e join groups g on g.id = e.group_id
  where e.student_id = w.student_id and g.teacher_id = w.teacher_id
  order by (e.holat = 'tugagan'), e.boshlandi desc limit 1
)
where w.group_id is null and w.teacher_id is not null;


/* Bitta guruhning oylik limiti (stavka bilan). Oy — 'YYYY-MM'. */
create or replace function guruh_woblar_limiti(p_group text, p_davr text)
returns int
language sql stable security definer set search_path = public as $$
  with oy as (
    select to_date(p_davr || '-01', 'YYYY-MM-DD') as bosh
  ),
  kun as (
    select k::date as sana
    from oy, groups g,
         generate_series(oy.bosh, (oy.bosh + interval '1 month' - interval '1 day'), interval '1 day') k
    where g.id = p_group and guruh_dars_kunimi(g.kunlar, k::date)
  )
  select (coalesce((
    select count(*) from kun
    join enrollments e on e.group_id = p_group
     and e.boshlandi <= kun.sana and (e.tugadi is null or e.tugadi >= kun.sana)
  ), 0) * coalesce((
    select (qiymat #>> '{}')::numeric from settings
    where kalit = 'woblr.oylik_stavka' and jsonb_typeof(qiymat) = 'number'
  ), 3))::int
$$;

/* Shu oyda shu guruhda guruh ustozining O'ZI bergan woblar (sof: minus qaytadi) */
create or replace function guruh_woblar_sarfi(p_group text, p_davr text)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(w.ball), 0)::int
  from woblr w
  join groups g   on g.id = w.group_id
  join teachers t on t.id = g.teacher_id
  where w.group_id = p_group
    and w.bergan_profile = t.profile_id   -- admin shu guruhga bergani ustoz limitidan ketmaydi
    and to_char(w.created_at at time zone 'Asia/Tashkent', 'YYYY-MM') = p_davr
$$;

revoke execute on function guruh_woblar_limiti(text, text) from public, anon;
revoke execute on function guruh_woblar_sarfi(text, text) from public, anon;
grant execute on function guruh_woblar_limiti(text, text) to authenticated, service_role;
grant execute on function guruh_woblar_sarfi(text, text) to authenticated, service_role;


/*
 * Ustoz limiti: { stavka, davr, jami: {limit, berilgan, qoldi}, guruhlar: [...] }.
 * p_ustoz bo'sh — joriy foydalanuvchining o'zi. Boshqa ustozni faqat xodim ko'radi.
 */
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

  with g as (
    select g.id, g.nom,
           guruh_woblar_limiti(g.id, v_davr) as limit_,
           guruh_woblar_sarfi(g.id, v_davr) as berilgan
    from groups g
    where g.teacher_id = v_ustoz and g.holat = 'faol'
  )
  select jsonb_build_object(
    'davr', v_davr,
    'stavka', coalesce((select (qiymat #>> '{}')::numeric from settings
                        where kalit = 'woblr.oylik_stavka' and jsonb_typeof(qiymat) = 'number'), 3),
    'jami', jsonb_build_object(
      'limit',    coalesce(sum(limit_), 0),
      'berilgan', coalesce(sum(berilgan), 0),
      'qoldi',    coalesce(sum(limit_ - berilgan), 0)
    ),
    'guruhlar', coalesce(jsonb_agg(jsonb_build_object(
      'group_id', id, 'nom', nom, 'limit', limit_, 'berilgan', berilgan, 'qoldi', limit_ - berilgan
    ) order by nom), '[]'::jsonb)
  ) into v_r
  from g;
  return v_r;
end;
$$;

revoke execute on function ustoz_woblar_limiti(text, text) from public, anon;
grant execute on function ustoz_woblar_limiti(text, text) to authenticated, service_role;


/*
 * Har yozuvda: guruhni aniqlaydi va ustozga oylik limitni tekshiradi.
 * Eski ±10 trigger (woblr_ustoz_chegara, 0057) o'rniga.
 */
drop trigger if exists woblr_ustoz_chegara on woblr;

create or replace function woblr_guruh_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_davr  text;
  v_limit int;
  v_sarf  int;
begin
  -- 1) Guruh: darsdan → bo'lmasa o'quvchining shu ustozdagi faol guruhi
  if new.group_id is null and new.lesson_id is not null then
    select group_id into new.group_id from lessons where id = new.lesson_id;
  end if;
  if new.group_id is null and new.teacher_id is not null then
    select e.group_id into new.group_id
    from enrollments e join groups g on g.id = e.group_id
    where e.student_id = new.student_id and g.teacher_id = new.teacher_id and e.holat <> 'tugagan'
    order by g.nom limit 1;
  end if;

  -- 2) Limit — faqat ustoz (sessiya bilan, admin emas) va faqat yangi yozuvda
  if tg_op = 'INSERT' and auth.uid() is not null and not app_is_admin() then
    if new.group_id is null or not exists (
      select 1 from enrollments e join groups g on g.id = e.group_id
      where e.group_id = new.group_id and e.student_id = new.student_id and e.holat <> 'tugagan'
        and g.teacher_id = app_teacher_id()
    ) then
      raise exception 'O''quvchi sizning guruhingizda topilmadi.';
    end if;
    if new.ball > 0 then
      v_davr := to_char(bugun_toshkent(), 'YYYY-MM');
      -- Bir guruhga bir vaqtda ikki berish limitni aylanib o'tmasin
      perform pg_advisory_xact_lock(hashtext('woblr-limit:' || new.group_id || ':' || v_davr));
      v_limit := guruh_woblar_limiti(new.group_id, v_davr);
      v_sarf  := guruh_woblar_sarfi(new.group_id, v_davr);
      if v_sarf + new.ball > v_limit then
        raise exception 'Oylik limit: bu guruh uchun % woblar qoldi (limit %, berilgan %).',
          greatest(v_limit - v_sarf, 0), v_limit, v_sarf;
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function woblr_guruh_limit() from public, anon, authenticated;

drop trigger if exists woblr_guruh_limit on woblr;
create trigger woblr_guruh_limit before insert or update of ball, group_id on woblr
  for each row execute function woblr_guruh_limit();


/* Davomatdan berish: ±10 va "bir darsda eng ko'pi" olib tashlandi — limitni trigger tekshiradi */
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
  v_admin  boolean := app_is_admin();
begin
  if auth.uid() is not null and not (app_teaches_group(p_group) or v_admin) then
    raise exception 'Bu guruhda woblar berish huquqingiz yo''q.';
  end if;

  if p_ball is null or p_ball = 0 then
    raise exception 'Woblar 0 bo''lmasin.';
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

  insert into woblr (student_id, lesson_id, teacher_id, bergan_profile, ball, sabab, group_id)
  values (p_student, v_dars, v_ustoz, auth.uid(), p_ball, 'faollik', p_group);

  select coalesce(sum(ball), 0)::int into v_jami
  from woblr where lesson_id = v_dars and student_id = p_student;

  return v_jami;
end;
$$;
