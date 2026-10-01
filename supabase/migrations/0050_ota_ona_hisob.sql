-- ============================================================
--  0050 — OTA-ONA QARZNI TO'G'RI KO'RADI (telefon diagnostikasi, 02.10)
--
--  0019 ota-onaga to'lovlarni (payments) ochgan, lekin hisob-fakturalarni
--  (invoices) emas. v_enrollment_balance security_invoker — ota-onada
--  hisoblangan = 0 bo'lib, qarz = −to'langan chiqardi: farzandi 1 100 000
--  qarzdor bo'lsa ham ota-ona "−1 100 000" (yashil) ko'rardi.
--  Endi ota-ona farzandining hisob-fakturalarini faqat O'QIYDI.
-- ============================================================

drop policy if exists invoices_parent_read on invoices;
create policy invoices_parent_read on invoices for select to authenticated
  using (exists (
    select 1 from enrollments e
    where e.id = invoices.enrollment_id and e.student_id = app_farzand_id()
  ));
