-- ============================================================
--  0120 — Arxivdagi o'quvchiga tuzatish, tuzatishni tahrirlash,
--         arxivdan qaytarish ustasi (Jamshid, 07.11)
-- ============================================================
--  1) Tuzatish yopilgan (tugagan) yozilishga ham — faqat bola o'qigan
--     oylarga (boshlandi..tugadi). Tahrirlash: summa va sabab, hisob qayta
--     yoziladi, eski qiymat audit_log da.
--  2) oquvchi_qaytar: bitta amalda — faol + (ixtiyoriy) guruhga yangi
--     yozilish tanlangan kundan, chegirmasi bilan. Eski yozilish yopiq
--     qoladi, eski davomat o'z sanalarida.
-- ============================================================

create or replace function tuzatish_qosh(
  p_enrollment uuid,
  p_davr       text,
  p_summa      numeric,
  p_sabab      text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  e    enrollments%rowtype;
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Tuzatishni faqat admin yoki direktor kiritadi.';
  end if;
  if p_davr is null or p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy noto''g''ri (masalan 2026-10).';
  end if;
  if p_summa is null or p_summa <= 0 then
    raise exception 'Ayiriladigan summa 0 dan katta bo''lsin.';
  end if;
  if coalesce(trim(p_sabab), '') = '' then
    raise exception 'Sababini yozing (masalan: kasal, 3 dars).';
  end if;
  select * into e from enrollments where id = p_enrollment;
  if not found then
    raise exception 'Yozilish topilmadi.';
  end if;
  if p_davr < to_char(e.boshlandi, 'YYYY-MM') or (e.tugadi is not null and p_davr > to_char(e.tugadi, 'YYYY-MM')) then
    raise exception 'Bu oyda bola shu guruhda o''qimagan (% — %).',
      to_char(e.boshlandi, 'DD.MM.YYYY'), coalesce(to_char(e.tugadi, 'DD.MM.YYYY'), 'hozir');
  end if;

  insert into tuzatishlar (enrollment_id, davr, summa, sabab, kiritdi)
  values (p_enrollment, p_davr, p_summa, trim(p_sabab), auth.uid())
  returning id into v_id;

  perform tuzatish_hisobla(p_enrollment, p_davr);
  return v_id;
end;
$$;
revoke execute on function tuzatish_qosh(uuid, text, numeric, text) from public, anon;
grant  execute on function tuzatish_qosh(uuid, text, numeric, text) to authenticated, service_role;

create or replace function tuzatish_tahrir(p_id bigint, p_summa numeric, p_sabab text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t tuzatishlar;
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Tuzatishni faqat admin yoki direktor tahrirlaydi.';
  end if;
  if p_summa is null or p_summa <= 0 then
    raise exception 'Ayiriladigan summa 0 dan katta bo''lsin.';
  end if;
  if coalesce(trim(p_sabab), '') = '' then
    raise exception 'Sababini yozing.';
  end if;
  update tuzatishlar set summa = p_summa, sabab = trim(p_sabab)
   where id = p_id and not bekor
  returning * into v_t;
  if v_t.id is null then
    raise exception 'Tuzatish topilmadi yoki bekor qilingan.';
  end if;
  perform tuzatish_hisobla(v_t.enrollment_id, v_t.davr);
end;
$$;
revoke execute on function tuzatish_tahrir(bigint, numeric, text) from public, anon;
grant  execute on function tuzatish_tahrir(bigint, numeric, text) to authenticated, service_role;


/* Arxivdan qaytarish ustasi: p_group bo'sh — faqat faol (guruhsiz) */
create or replace function oquvchi_qaytar(
  p_student  text,
  p_group    text default null,
  p_sana     date default null,
  p_chegirma jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sana date := coalesce(p_sana, bugun_toshkent());
  v_oxir date;
  v_id   uuid;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Arxivdan qaytarish huquqingiz yo''q.';
  end if;
  if not exists (select 1 from students where id = p_student and holat = 'ketgan') then
    raise exception 'O''quvchi arxivda emas.';
  end if;

  if p_group is not null then
    if not exists (select 1 from groups where id = p_group and holat = 'faol') then
      raise exception 'Guruh topilmadi yoki yopilgan.';
    end if;
    select max(tugadi) into v_oxir from enrollments where student_id = p_student and group_id = p_group;
    if v_oxir is not null and v_sana <= v_oxir then
      raise exception 'Bu guruhdan % da chiqqan — qaytish kuni undan keyin bo''lsin.', to_char(v_oxir, 'DD.MM.YYYY');
    end if;
  end if;

  update students set holat = 'faol', arxiv_sana = null, arxiv_sabab = null, ketish_sababi = null
   where id = p_student;

  if p_group is not null then
    v_id := guruhga_biriktir(p_student, p_group, v_sana, coalesce(p_chegirma, '{}'::jsonb));
  end if;
  return v_id;
end;
$$;
revoke execute on function oquvchi_qaytar(text, text, date, jsonb) from public, anon;
grant  execute on function oquvchi_qaytar(text, text, date, jsonb) to authenticated, service_role;
