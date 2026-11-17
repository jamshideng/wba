-- ============================================================
-- 0132 — Guruhdan chiqarish: oxirgi faol fan bo'lsa o'quvchi ham arxivga
--        (Jamshid, 17.11)
--
-- 0124 da bu qoida faqat fan_arxivla da edi. guruhdan_chiqar o'quvchiga
-- tegmasdi, natijada faol fani yo'q, lekin "faol" o'quvchilar qoldi
-- (S015, S102 — 12.11 da chiqarilgan). Endi guruhdan_chiqar ham oxirgi
-- faol fanda o'quvchini arxivga o'tkazadi (sabab belgilanmagan).
-- Qaytaradi: 'fan' yoki 'oquvchi' (fan_arxivla kabi).
-- ============================================================

drop function if exists guruhdan_chiqar(uuid, date);

create function guruhdan_chiqar(p_enrollment uuid, p_sana date default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_sana date := coalesce(p_sana, bugun_toshkent());
  e      enrollments%rowtype;
begin
  if not app_is_staff() then
    raise exception 'Guruhdan chiqarish huquqingiz yo''q.';
  end if;

  update enrollments
     set tugadi = v_sana, holat = 'tugagan'
   where id = p_enrollment and holat <> 'tugagan'
  returning * into e;

  if not found then
    raise exception 'Yozilish topilmadi yoki allaqachon yopilgan.';
  end if;

  -- Chiqqan oydan keyingi hisob-fakturalar kerak emas
  delete from invoices
   where enrollment_id = p_enrollment
     and davr > to_char(v_sana, 'YYYY-MM');

  -- 0132: oxirgi faol fan — o'quvchi ham arxivga
  if not exists (select 1 from enrollments where student_id = e.student_id and holat <> 'tugagan')
     and exists (select 1 from students where id = e.student_id and holat <> 'ketgan') then
    update students
       set holat = 'ketgan', arxiv_sana = greatest(v_sana, e.boshlandi)
     where id = e.student_id;
    return 'oquvchi';
  end if;
  return 'fan';
end;
$$;
revoke execute on function guruhdan_chiqar(uuid, date) from public, anon;
grant  execute on function guruhdan_chiqar(uuid, date) to authenticated, service_role;

-- Avval chiqarilib, "faol" qolib ketganlar: oxirgi fan tugagan sana bilan arxivga
update students s
   set holat = 'ketgan',
       arxiv_sana = (select max(e.tugadi) from enrollments e where e.student_id = s.id)
 where s.holat = 'faol'
   and exists (select 1 from enrollments e where e.student_id = s.id)
   and not exists (select 1 from enrollments e where e.student_id = s.id and e.holat <> 'tugagan');
