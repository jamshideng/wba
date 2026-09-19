-- ============================================================
--  World Bridge Academy
--  0018_panel_davomat_reyting.sql · ustoz va o'quvchi panellari
--
--  1. DAVOMAT FOIZI KELAJAKDAGI DARSLARNI SANAMASIN.
--     Bulutga Sheets jurnalidan kelajakdagi darslar ham "kelmadi"
--     bo'lib ko'chib qolgan (DIAGNOSTIKA K1). v_attendance_monthly
--     ularni ham maxrajga qo'shardi: 19.09 da 8 darsning 7 tasiga
--     kelgan o'quvchi 7/13 = 54% ko'rinardi (haqiqiy 88%).
--     Endi faqat bugungacha (Toshkent) bo'lgan darslar sanaladi.
--     Ma'lumotni tozalash — alohida ish (W1/J11); bu qoida undan
--     keyin ham to'g'ri: kelajakdagi dars hech qachon foizga kirmaydi.
--
--     "Dars o'tkazilmadi" (Q4) foizga kirmaydi: bunday darsga
--     davomat yozilmaydi (W1-3), view esa attendance'dan quriladi.
--
--  2. keyingi_darslar() — "Keyingi darslarim" guruh JADVALIDAN.
--     Avval lessons jadvalidan o'qilardi, u yerda esa faqat ko'chirilgan
--     (va o'tgan) darslar bor: tozalashdan keyin yoki oy oxirida ro'yxat
--     bo'shab qolardi. Endi kun turi (toq/juft/dam olish) va vaqtdan
--     hisoblanadi. SECURITY INVOKER — RLS o'zi cheklaydi: o'quvchi
--     faqat o'z yozilishlarini ko'radi.
--
--  3. woblr_leaderboard() — KIM QAYSI REYTINGNI KO'RADI (Q6).
--     TESHIK EDI: funksiya security definer, lekin huquq tekshirmasdi —
--     istalgan kirgan odam istalgan guruh reytingini (ism + ball) olardi.
--     Endi:
--       xodim, tizim   — hammasi
--       ustoz          — butun markaz, o'z guruhlari, o'zi dars beradigan fanlar
--       o'quvchi       — butun markaz, o'zi o'qiydigan fan(lar) va guruh(lar);
--                        boshqa fanni ko'ra olmaydi
--     Yangi parametr p_fan (subjects.id). Imzo o'zgargani uchun eski
--     funksiya o'chirib qayta yaratiladi (aks holda PostgREST ikki
--     variant orasida adashadi).
--
--  4. davomat_saqla — O'TGAN KUN FAQAT ADMINGA (Q5).
--     Ustoz davomatni faqat o'sha kuni belgilaydi; kun o'tib ketsa
--     faqat admin (direktor ham, 0006) tuzatadi. Sayt ekrani allaqachon
--     faqat bugunni ochadi — bu qoida API orqali chetlab o'tishni yopadi.
--     Server (auth.uid() bo'sh: soatlik Sheets yangilanishi, ko'chirish)
--     cheklanmaydi.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Oylik davomat — faqat bugungacha
-- ------------------------------------------------------------

-- create or replace view WITH (...) ni ko'rsatmasa, eski
-- security_invoker o'chib ketadi — shuning uchun aniq yoziladi.
create or replace view v_attendance_monthly
with (security_invoker = on) as
select
  a.student_id,
  to_char(l.sana, 'YYYY-MM')                              as davr,
  l.group_id,
  count(*)                                                as darslar,
  count(*) filter (where a.holat in ('keldi', 'kechikdi')) as kelgan,
  round(
    100.0 * count(*) filter (where a.holat in ('keldi', 'kechikdi'))
    / nullif(count(*), 0)
  )::int                                                  as foiz
from attendance a
join lessons l on l.id = a.lesson_id
where l.sana <= bugun_toshkent()
group by a.student_id, to_char(l.sana, 'YYYY-MM'), l.group_id;


-- ------------------------------------------------------------
-- 2. Keyingi darslar — guruh jadvalidan
-- ------------------------------------------------------------

create or replace function keyingi_darslar(p_student text, p_soni int default 8)
returns table (group_id text, nom text, sana date, boshlanish time, tugash time)
language sql stable security invoker set search_path = public as $$
  select g.id, g.nom, k.kun::date, g.boshlanish, g.tugash
  from enrollments e
  join groups g on g.id = e.group_id and g.holat = 'faol'
  cross join lateral generate_series(
    greatest(bugun_toshkent(), e.boshlandi)::timestamp,
    (bugun_toshkent() + 31)::timestamp,
    interval '1 day'
  ) as k(kun)
  where e.student_id = p_student
    and e.holat = 'faol'
    and (e.tugadi is null or k.kun::date <= e.tugadi)
    and dars_kunimi(g.kun_turi, k.kun::date)
    -- bugungi dars tugagan bo'lsa — endi "keyingi" emas
    and not (k.kun::date = bugun_toshkent()
             and g.tugash <= (now() at time zone 'Asia/Tashkent')::time)
  order by k.kun, g.boshlanish
  limit least(greatest(coalesce(p_soni, 8), 1), 50)
$$;

comment on function keyingi_darslar is
  'O''quvchining keyingi darslari guruh jadvalidan (kun turi + vaqt). RLS bilan: o''quvchi faqat o''zinikini ko''radi.';

revoke execute on function keyingi_darslar(text, int) from public, anon;
grant  execute on function keyingi_darslar(text, int) to authenticated, service_role;


-- ------------------------------------------------------------
-- 3. Woblar reytingi — markaz / fan / guruh, huquq bilan
-- ------------------------------------------------------------

drop function if exists woblr_leaderboard(text, text);

create function woblr_leaderboard(
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
  -- Odam nomidan kelsa va xodim bo'lmasa — nimani ko'ra olishi tekshiriladi.
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
    select w.student_id, s.fish, sum(w.ball)::bigint as ball
    from woblr w
    join students s on s.id = w.student_id and s.holat = 'faol'
    where (p_davr is null or to_char(w.created_at at time zone 'Asia/Tashkent', 'YYYY-MM') = p_davr)
      and (
        p_group is null
        or exists (
          select 1 from enrollments e
          where e.student_id = w.student_id and e.group_id = p_group and e.holat <> 'tugagan'
        )
      )
      and (
        p_fan is null
        or exists (
          select 1 from enrollments e
          join groups g on g.id = e.group_id
          where e.student_id = w.student_id and g.subject_id = p_fan and e.holat <> 'tugagan'
        )
      )
    group by w.student_id, s.fish
  )
  select row_number() over (order by j.ball desc, j.fish), j.student_id, j.fish, j.ball
  from jamlanma j
  order by j.ball desc, j.fish;
end;
$$;

comment on function woblr_leaderboard is
  'Reyting (Q6): markaz, fan (p_fan) yoki guruh (p_group). Faqat ism va ball — telefon, qarz, davomat chiqmaydi. O''quvchi boshqa fanni ko''rmaydi.';

revoke execute on function woblr_leaderboard(text, text, text) from public, anon;
grant  execute on function woblr_leaderboard(text, text, text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 4. davomat_saqla — o'tgan kun faqat adminga (0013 + Q5)
-- ------------------------------------------------------------

create or replace function davomat_saqla(
  p_group    text,
  p_sana     date,
  p_belgilar jsonb,
  p_ballar   jsonb default '{}'::jsonb,
  p_mavzu    text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dars    uuid;
  v_ustoz   text;
  v_davomat int := 0;
  v_ball    int := 0;
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

  insert into lessons (group_id, sana, mavzu, otkazildi)
  values (p_group, p_sana, p_mavzu, true)
  on conflict (group_id, sana) do update
    set otkazildi = true,
        mavzu = coalesce(excluded.mavzu, lessons.mavzu)
  returning id into v_dars;

  select teacher_id into v_ustoz from groups where id = p_group;

  insert into attendance (lesson_id, student_id, holat, belgiladi)
  select v_dars, kv.key, (kv.value #>> '{}')::attendance_status, auth.uid()
  from jsonb_each(coalesce(p_belgilar, '{}'::jsonb)) kv
  where exists (
    select 1 from enrollments e
    where e.student_id = kv.key and e.group_id = p_group and e.holat <> 'tugagan'
  )
  on conflict (lesson_id, student_id) do update
    set holat = excluded.holat, belgiladi = excluded.belgiladi, updated_at = now();
  get diagnostics v_davomat = row_count;

  -- Dars ichidagi ball YAKUNIY qiymat: qayta saqlansa ikkilanmaydi
  delete from woblr where lesson_id = v_dars;

  insert into woblr (student_id, lesson_id, teacher_id, bergan_profile, ball, sabab)
  select kv.key, v_dars, v_ustoz, auth.uid(), (kv.value #>> '{}')::int, 'faollik'
  from jsonb_each(coalesce(p_ballar, '{}'::jsonb)) kv
  where coalesce((kv.value #>> '{}')::int, 0) <> 0
    and exists (
      select 1 from enrollments e
      where e.student_id = kv.key and e.group_id = p_group and e.holat <> 'tugagan'
    );
  get diagnostics v_ball = row_count;

  return jsonb_build_object('dars_id', v_dars, 'davomat', v_davomat, 'ball', v_ball);
end;
$$;
