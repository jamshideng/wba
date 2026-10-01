-- ============================================================
--  0041 — "Faol o'quvchilar": bolalar soni va fan bo'yicha soni
--
--  2 fanga yozilgan bola saytda bitta o'quvchi (bitta login), lekin
--  hisobotda Sheets kabi ikkalasi ham ko'rinsin (Jamshid, 01.10):
--    oquvchilar   — haqiqiy bolalar (faol students)
--    fan_boyicha  — faol yozilishlar (1 bola × 2 fan = 2)
--  Ustun oxiriga qo'shiladi — eski o'quvchilar buzilmaydi.
-- ============================================================

create or replace view v_dashboard with (security_invoker = on) as
select
  (select count(*) from students where holat = 'faol')                            as oquvchilar,
  (select count(*) from groups   where holat = 'faol')                            as guruhlar,
  (select count(*) from teachers where holat = 'faol')                            as ustozlar,
  (select count(*) from v_qarzdorlar)                                             as qarzdorlar,
  (select coalesce(sum(qarz), 0) from v_qarzdorlar)                               as jami_qarz,
  (select coalesce(sum(summa), 0) from payments
     where not bekor and davr = to_char(current_date, 'YYYY-MM'))                 as joriy_oy_tushumi,
  (select count(*) from payments
     where not bekor and davr = to_char(current_date, 'YYYY-MM'))                 as joriy_oy_tolovlari,
  (select coalesce(sum(chegirma), 0) from invoices
     where holat <> 'bekor' and davr = to_char(current_date, 'YYYY-MM'))          as chegirma,
  (select count(*) from payments where not bekor and not tasdiqlangan)            as tasdiqlanmagan_soni,
  (select coalesce(sum(summa), 0) from payments
     where not bekor and not tasdiqlangan)                                        as tasdiqlanmagan_summa,
  (select count(*) from enrollments e join students s on s.id = e.student_id
     where e.holat = 'faol' and s.holat = 'faol')                                 as fan_boyicha;
