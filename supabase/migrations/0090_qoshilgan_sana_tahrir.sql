-- ============================================================
--  0090 — Guruhga qo'shilgan sanani tahrirlash (Jamshid, 24.10)
-- ============================================================
--  Sheets'da "Qo'shilgan sana" katagini o'zgartirsa hisob o'zi qayta
--  hisoblanardi. Saytda enrollments.boshlandi biriktirishda bir marta
--  yoziladi va o'zgartirib bo'lmasdi. Endi xodim o'zgartiradi:
--    · yangi sanadan oldingi oylar hisob-fakturasi olib tashlanadi
--      (o'sha oyga to'lov bo'lsa — rad etiladi, avval to'lovni ko'chirish kerak);
--    · yangi sana oldinroq bo'lsa yetishmagan oylar yoziladi;
--    · chegirma oylari yangi sanadan qayta sanaladi;
--    · students.qoshilgan_sana = eng birinchi yozilish sanasi.
--  Davomat o'zgarmaydi (jurnal baribir faqat boshlandi..tugadi ni ko'rsatadi).
-- ============================================================

create or replace function qoshilgan_sana_ozgartir(p_enrollment uuid, p_sana date)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e         enrollments%rowtype;
  v_fan     text;
  v_davr    text := to_char(p_sana, 'YYYY-MM');
  v_olindi  int := 0;
  v_qoshildi int := 0;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Qo''shilgan sanani o''zgartirish huquqingiz yo''q.';
  end if;

  select * into e from enrollments where id = p_enrollment for update;
  if not found then
    raise exception 'Yozilish topilmadi.';
  end if;
  if p_sana is null then
    raise exception 'Sanani tanlang.';
  end if;
  if p_sana = e.boshlandi then
    return jsonb_build_object('olindi', 0, 'qoshildi', 0);
  end if;
  if p_sana > bugun_toshkent() then
    raise exception 'Kelasi sanani qo''yib bo''lmaydi.';
  end if;
  if e.tugadi is not null and p_sana > e.tugadi then
    raise exception 'Sana guruhdan chiqqan kundan (%) keyin bo''lmasin.', to_char(e.tugadi, 'DD.MM.YYYY');
  end if;

  -- Shu fan bo'yicha boshqa yozilish bilan ustma-ust tushmasin (guruh almashtirish zanjiri)
  select subject_id into v_fan from groups where id = e.group_id;
  if exists (
    select 1 from enrollments o join groups g on g.id = o.group_id
    where o.student_id = e.student_id and o.id <> e.id
      and (o.group_id = e.group_id or (v_fan is not null and g.subject_id = v_fan))
      and o.boshlandi <= coalesce(e.tugadi, 'infinity'::date)
      and coalesce(o.tugadi, 'infinity'::date) >= p_sana
      and o.boshlandi < e.boshlandi
  ) then
    raise exception 'Bu sanada o''quvchi shu fanning boshqa guruhida o''qigan — avval o''sha yozilishni tekshiring.';
  end if;

  -- Olib tashlanadigan oylarga to'lov bo'lsa — to'xtatamiz
  if exists (
    select 1 from payments
    where enrollment_id = e.id and not bekor and davr < v_davr
  ) then
    raise exception 'Yangi sanadan oldingi oylarga to''lov bor — avval to''lovning oyini o''zgartiring yoki bekor qiling.';
  end if;

  update enrollments set boshlandi = p_sana where id = e.id;

  delete from invoices where enrollment_id = e.id and davr < v_davr;
  get diagnostics v_olindi = row_count;

  v_qoshildi := yozilish_hisoblari(e.id);
  perform yozilish_qayta_hisobla(e.id);

  update students s
     set qoshilgan_sana = (select min(boshlandi) from enrollments where student_id = s.id)
   where s.id = e.student_id;

  return jsonb_build_object('olindi', v_olindi, 'qoshildi', v_qoshildi);
end;
$$;

revoke execute on function qoshilgan_sana_ozgartir(uuid, date) from public, anon;
grant  execute on function qoshilgan_sana_ozgartir(uuid, date) to authenticated, service_role;
