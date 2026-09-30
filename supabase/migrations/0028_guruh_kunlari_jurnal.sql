-- ============================================================
--  World Bridge Academy
--  0028_guruh_kunlari_jurnal.sql · haftaning 7 kuni, davomat jurnali, woblar
--
--  1. GURUH KUNLARI — toq/juft emas, haftaning aniq kunlari.
--     groups.kunlar = ISO hafta kunlari (1 = dushanba … 7 = yakshanba).
--     Admin guruh ochganda 7 kundan tanlaydi (masalan Du, Ch, Sha).
--     Eski kun_turi o'chirilmaydi — ko'zgu, ko'chirish skripti va eski
--     kod uni o'qiydi. Trigger ikkalasini moslab turadi:
--       kunlar berilsa → kun_turi undan (aniq mos kelmasa 'har_kuni')
--       faqat kun_turi berilsa (ko'chirish skripti) → kunlar undan
--
--  2. Dars kunini hisoblaydigan hamma joy kunlar'ga o'tadi:
--     v_bugungi_darslar, keyingi_darslar, tushum_hisobot,
--     generate_lessons. Yangi guruh_dars_kunimi(kunlar, sana).
--     (dars_kunimi(day_type, date) qoladi — nomi boshqa, chalkashmaydi.)
--
--  3. davomat_belgila() — JURNAL KATAGI. Bir kun, bir yoki bir necha
--     o'quvchi. Woblarga TEGMAYDI (davomat_saqla darsning woblarini
--     o'chirib qayta yozardi — jurnalda har katak alohida saqlanadi).
--     Qiymat null → belgi olib tashlanadi.
--     Huquq davomat_saqla (Q5) bilan bir xil: ustoz — faqat o'z guruhi
--     va faqat BUGUN; admin/direktor — o'tgan kunlar ham; kelajak — hech kim.
--     Kun guruhning dars kuni bo'lishi (yoki o'sha kunga dars ochilgan
--     bo'lishi) shart — ustozga faqat dars kunlari ochiladi.
--
--  4. woblar_ber() — jurnaldagi "Berish" tugmasi. Bugungi darsga
--     bog'lanadi (dars bo'lmasa ochiladi, "o'tkazildi" deb belgilanmaydi).
--     Qaytaradi: o'quvchining shu darsdagi jami woblari.
--
--  5. davomat_saqla — p_ballar bo'sh bo'lsa darsning woblari O'CHIRILMAYDI.
--     Aks holda jurnalda berilgan woblarni eski forma yutib yuborardi.
-- ============================================================


-- ------------------------------------------------------------
-- 1. groups.kunlar
-- ------------------------------------------------------------

alter table groups add column if not exists kunlar smallint[];

update groups set kunlar = case kun_turi
    when 'toq'       then '{1,3,5}'::smallint[]
    when 'juft'      then '{2,4,6}'::smallint[]
    when 'dam_olish' then '{6,7}'::smallint[]
    else                  '{1,2,3,4,5,6}'::smallint[]
  end
where kunlar is null;

create or replace function guruh_kunlari_mosla() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Faqat kun_turi berilgan yoki o'zgargan (eski yozuvchilar) — kunlar undan
  if new.kunlar is null
     or (tg_op = 'UPDATE' and new.kun_turi is distinct from old.kun_turi
         and new.kunlar is not distinct from old.kunlar) then
    new.kunlar := case new.kun_turi
        when 'toq'       then '{1,3,5}'::smallint[]
        when 'juft'      then '{2,4,6}'::smallint[]
        when 'dam_olish' then '{6,7}'::smallint[]
        else                  '{1,2,3,4,5,6}'::smallint[]
      end;
  end if;

  -- Tartiblangan, takrorsiz
  select array_agg(distinct k order by k) into new.kunlar from unnest(new.kunlar) k;

  -- kun_turi — eski o'quvchilar uchun eng yaqin nom
  new.kun_turi := case new.kunlar
      when '{1,3,5}'::smallint[]       then 'toq'::day_type
      when '{2,4,6}'::smallint[]       then 'juft'::day_type
      when '{6,7}'::smallint[]         then 'dam_olish'::day_type
      else                                  'har_kuni'::day_type
    end;
  return new;
end;
$$;

drop trigger if exists groups_kunlar_mosla on groups;
create trigger groups_kunlar_mosla
  before insert or update of kunlar, kun_turi on groups
  for each row execute function guruh_kunlari_mosla();

alter table groups alter column kunlar set not null;
alter table groups drop constraint if exists groups_kunlar_check;
alter table groups add constraint groups_kunlar_check
  check (cardinality(kunlar) between 1 and 7 and kunlar <@ '{1,2,3,4,5,6,7}'::smallint[]);

comment on column groups.kunlar is
  'Dars kunlari: ISO hafta kuni (1 = dushanba … 7 = yakshanba). kun_turi shundan avtomatik (trigger).';
comment on column groups.kun_turi is
  'ESKI. kunlar dan trigger bilan yoziladi — faqat ko''zgu va eski kod uchun. Yangi kod kunlar ni o''qisin.';


-- ------------------------------------------------------------
-- 2. Dars kuni — kunlar bo'yicha
-- ------------------------------------------------------------

create or replace function guruh_dars_kunimi(p_kunlar smallint[], p_sana date) returns boolean
language sql immutable as $$
  select extract(isodow from p_sana)::smallint = any (p_kunlar)
$$;

-- Eski ustunlar tartibi saqlanadi, kunlar oxiriga qo'shiladi
create or replace view v_bugungi_darslar as
select
  g.id                                as group_id,
  g.nom,
  g.teacher_id,
  g.boshlanish,
  g.tugash,
  g.kun_turi,
  bugun_toshkent()                    as sana,
  l.id                                as lesson_id,
  coalesce(l.otkazildi, false)        as belgilangan,
  (select count(*) from enrollments e
     where e.group_id = g.id and e.holat <> 'tugagan') as oquvchilar,
  g.kunlar
from groups g
left join lessons l on l.group_id = g.id and l.sana = bugun_toshkent()
where g.holat = 'faol'
  and guruh_dars_kunimi(g.kunlar, bugun_toshkent());

alter view v_bugungi_darslar set (security_invoker = on);


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
    and guruh_dars_kunimi(g.kunlar, k.kun::date)
    and not (k.kun::date = bugun_toshkent()
             and g.tugash <= (now() at time zone 'Asia/Tashkent')::time)
  order by k.kun, g.boshlanish
  limit least(greatest(coalesce(p_soni, 8), 1), 50)
$$;


create or replace function generate_lessons(
  p_group text,
  p_from  date,
  p_to    date
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_kunlar smallint[];
  v_count  int;
begin
  select kunlar into v_kunlar from groups where id = p_group and holat = 'faol';
  if v_kunlar is null then
    return 0;
  end if;

  with kunlar as (
    select d::date as sana
    from generate_series(p_from, p_to, interval '1 day') d
    where guruh_dars_kunimi(v_kunlar, d::date)
  ), yangi as (
    insert into lessons (group_id, sana)
    select p_group, sana from kunlar
    on conflict (group_id, sana) do nothing
    returning 1
  )
  select count(*) into v_count from yangi;

  return v_count;
end;
$$;


create or replace function tushum_hisobot(p_dan date, p_gacha date)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with t as (
    select p.sana, p.summa, p.usul, p.student_id, p.tasdiqlangan,
           coalesce(tc.ism, '—') as ustoz,
           coalesce(s.nom, '—')  as yonalish
    from payments p
    left join enrollments e on e.id = p.enrollment_id
    left join groups g      on g.id = e.group_id
    left join teachers tc   on tc.id = g.teacher_id
    left join subjects s    on s.id = g.subject_id
    where not p.bekor and p.sana between p_dan and p_gacha
  ),
  d as (
    select a.holat::text as holat
    from attendance a join lessons l on l.id = a.lesson_id
    where l.sana between p_dan and p_gacha
  ),
  kutilgan as (
    select g.id as group_id, g.nom, coalesce(tc.ism, '—') as ustoz, k.sana::date as sana
    from groups g
    left join teachers tc on tc.id = g.teacher_id
    cross join generate_series(p_dan::timestamp, least(p_gacha, bugun_toshkent())::timestamp, interval '1 day') k(sana)
    where g.holat = 'faol'
      and guruh_dars_kunimi(g.kunlar, k.sana::date)
      and exists (
        select 1 from enrollments e
        where e.group_id = g.id and e.boshlandi <= k.sana::date
          and (e.tugadi is null or e.tugadi >= k.sana::date)
      )
  ),
  qilinmagan as (
    select k.* from kutilgan k
    where not exists (
      select 1 from lessons l
      where l.group_id = k.group_id and l.sana = k.sana
        and (l.otkazildi or exists (select 1 from attendance a where a.lesson_id = l.id))
    )
  ),
  pr as (
    select holat::text as holat
    from leads
    where (created_at at time zone 'Asia/Tashkent')::date between p_dan and p_gacha
  )
  select jsonb_build_object(
    'tushum',          (select coalesce(sum(summa), 0) from t),
    'soni',            (select count(*) from t),
    'odam',            (select count(distinct student_id) from t),
    'tasdiqlanmagan',  (select coalesce(sum(summa), 0) from t where not tasdiqlangan),
    'usul', coalesce((
      select jsonb_agg(x order by x.summa desc)
      from (select coalesce(usul::text, 'aniqlanmagan') as nom, sum(summa) as summa, count(*) as soni
            from t group by 1) x), '[]'::jsonb),
    'ustoz', coalesce((
      select jsonb_agg(x order by x.summa desc)
      from (select ustoz as nom, sum(summa) as summa, count(*) as soni from t group by 1) x), '[]'::jsonb),
    'yonalish', coalesce((
      select jsonb_agg(x order by x.summa desc)
      from (select yonalish as nom, sum(summa) as summa, count(*) as soni from t group by 1) x), '[]'::jsonb),
    'kunlar', coalesce((
      select jsonb_agg(x order by x.sana)
      from (select sana, sum(summa) as summa, count(*) as soni from t group by sana) x), '[]'::jsonb),
    'davomat', jsonb_build_object(
      'belgilar', (select count(*) from d),
      'kelgan',   (select count(*) from d where holat in ('keldi', 'kechikdi')),
      'kelmadi',  (select count(*) from d where holat = 'kelmadi'),
      'sababli',  (select count(*) from d where holat = 'sababli')
    ),
    'darslar', jsonb_build_object(
      'kutilgan',   (select count(*) from kutilgan),
      'qilinmagan', (select count(*) from qilinmagan)
    ),
    'qilinmagan', coalesce((
      select jsonb_agg(x)
      from (select ustoz, nom, sana from qilinmagan order by ustoz, sana limit 80) x), '[]'::jsonb),
    'probniy', jsonb_build_object(
      'jami',       (select count(*) from pr),
      'kutilmoqda', (select count(*) from pr where holat in ('yangi', 'qongiroq', 'keldi')),
      'yozildi',    (select count(*) from pr where holat = 'yozildi'),
      'kelmadi',    (select count(*) from pr where holat = 'kelmadi'),
      'rad',        (select count(*) from pr where holat = 'rad')
    )
  )
$$;


-- ------------------------------------------------------------
-- 3. davomat_belgila — jurnal katagi
-- ------------------------------------------------------------

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

  return v_soni + v_ochir;
end;
$$;

comment on function davomat_belgila is
  'Jurnal katagi: {student_id: holat | null}. Woblarga tegmaydi. Ustoz — faqat bugun, admin — o''tgan kunlar ham (Q5).';

revoke execute on function davomat_belgila(text, date, jsonb) from public, anon;
grant  execute on function davomat_belgila(text, date, jsonb) to authenticated, service_role;


-- ------------------------------------------------------------
-- 4. woblar_ber — jurnaldagi "Berish"
-- ------------------------------------------------------------

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

  return v_jami;
end;
$$;

comment on function woblar_ber is
  'Jurnaldan woblar: bugungi darsga yoziladi (dars bo''lmasa ochiladi). Qaytaradi — o''quvchining shu darsdagi jami woblari.';

revoke execute on function woblar_ber(text, text, int) from public, anon;
grant  execute on function woblar_ber(text, text, int) to authenticated, service_role;


-- ------------------------------------------------------------
-- 5. davomat_saqla — bo'sh p_ballar woblarni o'chirmaydi
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

  -- Ball berilgan bo'lsagina darsning woblari YAKUNIY qiymat bilan almashadi
  if coalesce(p_ballar, '{}'::jsonb) <> '{}'::jsonb then
    delete from woblr where lesson_id = v_dars;

    insert into woblr (student_id, lesson_id, teacher_id, bergan_profile, ball, sabab)
    select kv.key, v_dars, v_ustoz, auth.uid(), (kv.value #>> '{}')::int, 'faollik'
    from jsonb_each(p_ballar) kv
    where coalesce((kv.value #>> '{}')::int, 0) <> 0
      and exists (
        select 1 from enrollments e
        where e.student_id = kv.key and e.group_id = p_group and e.holat <> 'tugagan'
      );
    get diagnostics v_ball = row_count;
  end if;

  return jsonb_build_object('dars_id', v_dars, 'davomat', v_davomat, 'ball', v_ball);
end;
$$;
