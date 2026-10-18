-- ============================================================
--  0080 — Birlashtirilgan (takroriy) ID'lar arxivda ko'rinmasin (Jamshid, 18.10)
-- ============================================================
--  oquvchi_birlashtir (0067) ikkinchi ID'ni o'chirmaydi — arxivga
--  "Birlashtirildi → S..." sababi bilan qo'yadi. Ular haqiqiy ketgan
--  o'quvchi emas, ma'lumoti asosiy ID'da. Qator saqlanadi (Sheets ID,
--  audit izi), faqat arxiv ro'yxatidan chiqariladi.
-- ============================================================

create or replace view v_arxiv_oquvchilar
with (security_invoker = on) as
select s.id as student_id, s.fish, s.arxiv_sana, s.arxiv_sabab,
       coalesce(b.qarz, 0) as qarz,
       (select string_agg(g.nom, ' + ' order by e.tugadi desc)
          from enrollments e join groups g on g.id = e.group_id
         where e.student_id = s.id) as guruhlar
from students s
left join v_student_balance b on b.student_id = s.id
where s.holat = 'ketgan'
  and coalesce(s.arxiv_sabab, '') not like 'Birlashtirildi%';
