-- ============================================================
-- 0127 — Ustoz ma'lumotlarida pasport, JSHSHIR va pasport nusxasi kiritilmaydi (Jamshid, 16.11.2026)
--   Formadan olib tashlandi; to'ldirilganlikning 8-bandi endi faqat yashash manzili.
--   Ustunlar va bazadagi mavjud qiymatlar o'zgartirilmaydi.
-- ============================================================

create or replace view v_ustoz_toldirish
with (security_invoker = on) as
select t.id as teacher_id,
       x.qolgan,
       round(100.0 * (8 - cardinality(x.qolgan)) / 8)::int as foiz,
       (select array_agg(m) from unnest(x.qolgan) m where m in ('rasm', 'fanlar', 'tugilgan_sana', 'talim')) as majburiy_qolgan,
       p.holat, p.saytda
from teachers t
join teacher_profil p on p.teacher_id = t.id
left join teacher_shaxsiy s on s.teacher_id = t.id
cross join lateral (
  select array_remove(array[
    case when p.rasm_yol is null then 'rasm' end,
    case when coalesce(trim(p.tavsif), '') = '' then 'tavsif' end,
    case when cardinality(p.fanlar) = 0 then 'fanlar' end,
    case when p.dars_boshlagan_yil is null then 'tajriba' end,
    case when s.tugilgan_sana is null then 'tugilgan_sana' end,
    case when not exists (select 1 from teacher_talim e where e.teacher_id = t.id) then 'talim' end,
    case when not exists (select 1 from teacher_mehnat m where m.teacher_id = t.id) then 'mehnat' end,
    case when coalesce(trim(s.manzil), '') = '' then 'manzil' end
  ], null) as qolgan
) x
where t.holat = 'faol';
grant select on v_ustoz_toldirish to authenticated;
