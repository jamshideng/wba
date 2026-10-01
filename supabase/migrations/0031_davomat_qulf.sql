-- ============================================================
--  0031 — DAVOMAT QULFI (Q5, Jamshid 01.10)
--
--  Ustoz davomatni faqat O'SHA KUNI belgilaydi. Ertasi kuni u
--  o'zgartira olmaydi — tuzatish kerak bo'lsa adminga murojaat qiladi,
--  admin/direktor tuzatadi.
--
--  RPC'lar (davomat_belgila, davomat_saqla, probniy_belgila) buni
--  allaqachon tekshiradi. Lekin RLS ustozga attendance/lessons ga
--  TO'G'RIDAN yozishga ruxsat berardi (0003) — REST orqali o'tgan
--  kunni o'zgartirish mumkin edi. Endi ustoz siyosatlari ham faqat
--  bugungi darsga ruxsat beradi. Admin siyosatlariga tegilmaydi.
-- ============================================================

drop policy if exists attendance_teacher_insert on attendance;
create policy attendance_teacher_insert on attendance for insert to authenticated
  with check (exists (
    select 1 from lessons l
    where l.id = attendance.lesson_id
      and app_teaches_group(l.group_id)
      and l.sana = bugun_toshkent()
  ));

drop policy if exists attendance_teacher_update on attendance;
create policy attendance_teacher_update on attendance for update to authenticated
  using (exists (
    select 1 from lessons l
    where l.id = attendance.lesson_id
      and app_teaches_group(l.group_id)
      and l.sana = bugun_toshkent()
  ))
  with check (exists (
    select 1 from lessons l
    where l.id = attendance.lesson_id
      and app_teaches_group(l.group_id)
      and l.sana = bugun_toshkent()
  ));

drop policy if exists lessons_teacher_insert on lessons;
create policy lessons_teacher_insert on lessons for insert to authenticated
  with check (app_teaches_group(group_id) and sana = bugun_toshkent());

drop policy if exists lessons_teacher_update on lessons;
create policy lessons_teacher_update on lessons for update to authenticated
  using (app_teaches_group(group_id) and sana = bugun_toshkent())
  with check (app_teaches_group(group_id) and sana = bugun_toshkent());
