-- ============================================================
--  0087 — O'qituvchi bo'yicha tushum: OYLIK (davr bo'yicha)
-- ============================================================
--  Jamshid (20.10): Boshqaruv panelidagi "O'qituvchi bo'yicha tushum"
--  tanlangan oyni ko'rsatsin. Avval v_teacher_stats.tushum (butun
--  davr) chiqardi, sarlavhada esa oy nomi turardi.
--    · oy — to'lovning davri (yuqoridagi "… tushumi" kartasi bilan bir xil)
--    · ustoz — to'lov qaysi yozilishga (enrollment) tushgan bo'lsa, o'sha
--      guruhning ustozi: bola guruh almashtirsa, eski oy puli eski ustozda
--      qoladi; arxivdagilarning to'lovi ham o'z ustoziga tushadi
--  Bekor qilingan to'lov kirmaydi.
-- ============================================================

create or replace view v_teacher_monthly_income with (security_invoker = on) as
select
  t.id                       as teacher_id,
  t.ism,
  p.davr,
  sum(p.summa)               as tushum,
  count(*)                   as tolovlar
from payments p
join enrollments e on e.id = p.enrollment_id
join groups g      on g.id = e.group_id
join teachers t    on t.id = g.teacher_id
where not p.bekor
group by t.id, t.ism, p.davr;

comment on view v_teacher_monthly_income is
  'Ustoz × davr tushumi (to''lov davri, yozilish guruhining ustozi). 0087.';
