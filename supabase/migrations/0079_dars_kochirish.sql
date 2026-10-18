-- ============================================================
--  0079 — Darsni boshqa kunga ko'chirish (Jamshid, 17–18.10)
-- ============================================================
--  Oyda kamida 12 dars majburiy: dam kuniga yoki boshqa sababga ko'ra
--  o'tmaydigan dars boshqa kunga ko'chiriladi ("o'tib beriladi").
--    * eski kun — lessons.kochirildi_ga = yangi sana (dars o'tmaydi,
--      davomat va woblar yopiq, jurnalda "ko'chirildi");
--    * yangi kun — lessons.kochirilgan_dan = eski sana (oddiy dars kabi:
--      bugungi darslarda chiqadi, davomat, woblar, maosh, limit).
--  Kim: guruh ustozi (bugungi va keyingi darslar) yoki admin (istalgan).
--  Maosh oyi tasdiqlangan bo'lsa — yopiq.
--  guruh_dars_kuni(guruh, sana) — ko'chirishni hisobga olgan dars kuni;
--  bugungi darslar, woblar limiti, maosh (N) va nazorat shunga o'tadi.
-- ============================================================

alter table lessons add column if not exists kochirildi_ga   date;
alter table lessons add column if not exists kochirilgan_dan date;
alter table lessons add column if not exists kochirish_sabab text check (kochirish_sabab is null or length(kochirish_sabab) <= 300);

comment on column lessons.kochirildi_ga   is 'Bu dars shu sanaga ko''chirilgan — bu kuni dars yo''q (0079).';
comment on column lessons.kochirilgan_dan is 'Bu dars shu sanadan ko''chirib kelingan (0079).';

create or replace function guruh_dars_kuni(p_group text, p_sana date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lessons l where l.group_id = p_group and l.sana = p_sana and l.kochirilgan_dan is not null)
      or (exists (select 1 from groups g where g.id = p_group and guruh_dars_kunimi(g.kunlar, p_sana))
          and not exists (select 1 from lessons l where l.group_id = p_group and l.sana = p_sana and l.kochirildi_ga is not null))
$$;
revoke execute on function guruh_dars_kuni(text, date) from public, anon;
grant execute on function guruh_dars_kuni(text, date) to authenticated, service_role;

/* Ko'chirilgan (o'tmaydigan) kunga davomat yoki woblar yozilmasin */
create or replace function lessons_kochirilgan_qulf() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.kochirildi_ga is not null and new.otkazildi then
    raise exception 'Bu dars %ga ko''chirilgan — davomat o''sha kuni qilinadi.', to_char(new.kochirildi_ga, 'DD.MM');
  end if;
  return new;
end;
$$;
drop trigger if exists lessons_kochirilgan_qulf on lessons;
create trigger lessons_kochirilgan_qulf before insert or update of otkazildi, kochirildi_ga on lessons
  for each row execute function lessons_kochirilgan_qulf();

create or replace function woblar_kochirilgan_qulf() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.lesson_id is not null and exists (select 1 from lessons where id = new.lesson_id and kochirildi_ga is not null) then
    raise exception 'Bu dars boshqa kunga ko''chirilgan — woblar o''sha kuni beriladi.';
  end if;
  return new;
end;
$$;
drop trigger if exists woblr_kochirilgan_qulf on woblr;
create trigger woblr_kochirilgan_qulf before insert on woblr
  for each row execute function woblar_kochirilgan_qulf();
drop trigger if exists probniy_woblar_kochirilgan_qulf on probniy_woblar;
create trigger probniy_woblar_kochirilgan_qulf before insert on probniy_woblar
  for each row execute function woblar_kochirilgan_qulf();


/*
 * Ko'chirish. p_yangi bo'sh — ko'chirishni bekor qilish (yangi kun darsi
 * hali o'tmagan bo'lsa). Qaytaradi — yangi kun darsining id si.
 */
create or replace function dars_kochir(p_group text, p_eski date, p_yangi date, p_sabab text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_g     groups%rowtype;
  v_eski  lessons%rowtype;
  v_id    uuid;
  v_bugun date := bugun_toshkent();
begin
  select * into v_g from groups where id = p_group;
  if not found then
    raise exception 'Guruh topilmadi.';
  end if;
  if auth.uid() is not null and not app_is_admin() then
    if v_g.teacher_id is distinct from app_teacher_id() then
      raise exception 'Darsni faqat guruh ustozi yoki admin ko''chiradi.';
    end if;
    if p_eski < v_bugun or (p_yangi is not null and p_yangi < v_bugun) then
      raise exception 'O''tgan kunlarni faqat admin o''zgartiradi.';
    end if;
  end if;
  if maosh_oy_qulfmi(to_char(p_eski, 'YYYY-MM'))
     or (p_yangi is not null and maosh_oy_qulfmi(to_char(p_yangi, 'YYYY-MM'))) then
    raise exception 'Bu oy maoshi tasdiqlangan — darsni ko''chirib bo''lmaydi.';
  end if;

  select * into v_eski from lessons where group_id = p_group and sana = p_eski;

  -- Bekor qilish
  if p_yangi is null then
    if v_eski.kochirildi_ga is null then
      return null;
    end if;
    if exists (select 1 from lessons where group_id = p_group and sana = v_eski.kochirildi_ga and otkazildi) then
      raise exception 'Yangi kundagi dars allaqachon o''tilgan — bekor qilib bo''lmaydi.';
    end if;
    delete from lessons where group_id = p_group and sana = v_eski.kochirildi_ga and kochirilgan_dan = p_eski;
    update lessons set kochirildi_ga = null, kochirish_sabab = null where id = v_eski.id;
    -- Bo'sh qolgan eski yozuv (davomati yo'q) — tozalanadi
    delete from lessons l where l.id = v_eski.id and not l.otkazildi and l.zamena_teacher_id is null
      and l.mavzu is null and not exists (select 1 from attendance a where a.lesson_id = l.id);
    return null;
  end if;

  -- Eski kun: jadval kuni (dam kuni bo'lsa ham) yoki ochilgan dars; hali o'tilmagan
  if v_eski.id is null and not (extract(isodow from p_eski)::smallint = any (v_g.kunlar)) then
    raise exception 'Eski sana guruhning dars kuni emas.';
  end if;
  if v_eski.otkazildi then
    raise exception 'Bu dars allaqachon o''tilgan — ko''chirib bo''lmaydi.';
  end if;
  if v_eski.kochirildi_ga is not null then
    raise exception 'Bu dars allaqachon %ga ko''chirilgan.', to_char(v_eski.kochirildi_ga, 'DD.MM');
  end if;
  if v_eski.kochirilgan_dan is not null then
    raise exception 'Bu dars o''zi ko''chirib kelingan — avval uni bekor qiling.';
  end if;

  -- Yangi kun: guruhda o'sha kuni dars bo'lmasin, dam kuni bo'lmasin
  if p_yangi = p_eski then
    raise exception 'Yangi sana boshqa kun bo''lsin.';
  end if;
  if guruh_dars_kuni(p_group, p_yangi) or exists (select 1 from lessons where group_id = p_group and sana = p_yangi) then
    raise exception 'Bu kuni guruhda allaqachon dars bor.';
  end if;
  if exists (select 1 from dam_kunlar where sana = p_yangi) then
    raise exception 'Yangi sana dam olish kuni.';
  end if;

  if v_eski.id is null then
    insert into lessons (group_id, sana, kochirildi_ga, kochirish_sabab)
    values (p_group, p_eski, p_yangi, nullif(trim(p_sabab), ''));
  else
    -- Zamena yangi kunga o'tadi (pastda), eski kunda qolmasin
    update lessons set kochirildi_ga = p_yangi, kochirish_sabab = nullif(trim(p_sabab), ''),
                       zamena_teacher_id = null, zamena_sabab = null
    where id = v_eski.id;
  end if;

  insert into lessons (group_id, sana, kochirilgan_dan, kochirish_sabab, zamena_teacher_id, zamena_sabab)
  values (p_group, p_yangi, p_eski, nullif(trim(p_sabab), ''), v_eski.zamena_teacher_id, v_eski.zamena_sabab)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function dars_kochir(text, date, date, text) from public, anon;
grant execute on function dars_kochir(text, date, date, text) to authenticated, service_role;

drop trigger if exists lessons_kochirish_audit on lessons;
create trigger lessons_kochirish_audit after update of kochirildi_ga on lessons
  for each row execute function audit_trigger();


/* Bugungi darslar: ko'chirib kelingan dars chiqadi, ko'chirilgani chiqmaydi */
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
  g.kunlar,
  l.zamena_teacher_id,
  (select t.ism from teachers t where t.id = l.zamena_teacher_id) as zamena_ism,
  l.kochirilgan_dan
from groups g
left join lessons l on l.group_id = g.id and l.sana = bugun_toshkent()
where g.holat = 'faol'
  and guruh_dars_kuni(g.id, bugun_toshkent());

alter view v_bugungi_darslar set (security_invoker = on);


/* Woblar limiti, maosh (N), nazorat — guruh_dars_kunimi o'rniga guruh_dars_kuni */
do $$
declare
  v_nom text;
  v_def text;
begin
  foreach v_nom in array array['ustoz_guruh_woblar_limiti', 'maosh_qatorlari', 'nazorat_yig'] loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_nom;
    if v_def is null or v_def not like '%guruh_dars_kunimi(g.kunlar, %' then
      raise exception '% kutilgan ko''rinishda emas', v_nom;
    end if;
    execute replace(v_def, 'guruh_dars_kunimi(g.kunlar, ', 'guruh_dars_kuni(g.id, ');
  end loop;
end $$;
