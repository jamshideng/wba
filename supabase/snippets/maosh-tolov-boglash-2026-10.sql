-- Oktabrda qo'lda kiritilgan maosh xarajatlarini to'lovlarga bog'lash (bir martalik).
-- Jamshid tasdig'i: 01.11. Xarajatlar o'zgarmaydi, faqat maosh_tolovlar yoziladi.
-- №10 Marhabo opa — sobiq xodim, oluvchisi yo'q, bog'lanmaydi.
-- Avval tekshiruv: ism topilmasa yoki xarajat mos kelmasa, hammasi qaytadi.
begin;

create temp table bog (xid bigint, davr text, turi text, tur text, kim text) on commit drop;

insert into bog values
  (11, '2026-09', 'maosh', 'ustoz', 'Luiza%'),
  (14, '2026-09', 'maosh', 'ustoz', 'Abu Tolib%'),
  (18, '2026-09', 'maosh', 'ustoz', 'Madina%'),
  (31, '2026-09', 'maosh', 'ustoz', 'Madina%'),
  (24, '2026-09', 'maosh', 'ustoz', 'Diana%'),
  (38, '2026-09', 'maosh', 'ustoz', 'Diana%'),
  (26, '2026-09', 'maosh', 'ustoz', 'Shox%'),
  (29, '2026-09', 'maosh', 'ustoz', 'Jamshid%'),
  (47, '2026-09', 'maosh', 'ustoz', 'Jamshid%'),
  (33, '2026-09', 'maosh', 'ustoz', 'Komila%'),
  (35, '2026-09', 'maosh', 'ustoz', 'Komila%'),
  (27, '2026-10', 'avans', 'ustoz', 'Sanobar%'),
  (41, '2026-10', 'avans', 'ustoz', 'Sanobar%'),
  (19, '2026-09', 'maosh', 'xodim', 'Jamshid%'),
  (7,  '2026-10', 'maosh', 'xodim', 'Muhammadamin%'),
  (12, '2026-10', 'maosh', 'xodim', 'Muhammadamin%'),
  (32, '2026-10', 'maosh', 'xodim', 'Muhammadamin%'),
  (34, '2026-10', 'maosh', 'xodim', 'Muhammadamin%'),
  (44, '2026-10', 'maosh', 'xodim', 'Muhammadamin%'),
  (46, '2026-10', 'maosh', 'xodim', 'Muhammadamin%'),
  (51, '2026-09', 'maosh', 'boshqa', 'Munisa%'),
  (53, '2026-10', 'maosh', 'boshqa', 'Munisa%'),
  (52, '2026-10', 'maosh', 'boshqa', 'Profex%');

do $$
declare n int;
begin
  select count(*) into n from bog b join xarajatlar x on x.id = b.xid and not x.bekor and x.toifa = 'maosh';
  if n <> 23 then raise exception 'Xarajatlar mos emas: % / 23', n; end if;

  if exists (select 1 from bog b where b.tur = 'ustoz' and (select count(*) from teachers t where t.ism ilike b.kim) <> 1) then
    raise exception 'Ustoz ismi bir ma''noli emas';
  end if;
  if exists (select 1 from bog b where b.tur = 'xodim'
             and (select count(*) from profiles p where p.ism ilike b.kim and p.rol in ('admin', 'manager', 'qabulxona')) <> 1) then
    raise exception 'Xodim ismi bir ma''noli emas';
  end if;
  if exists (select 1 from bog b where b.tur = 'boshqa' and (select count(*) from boshqa_xodimlar o where o.ism ilike b.kim) <> 1) then
    raise exception 'Boshqa xodim ismi bir ma''noli emas';
  end if;
end $$;

insert into maosh_tolovlar (davr, turi, teacher_id, profile_id, boshqa_xodim_id, summa, sana, xarajat_id)
select b.davr, b.turi,
       (select t.id from teachers t where b.tur = 'ustoz' and t.ism ilike b.kim),
       (select p.id from profiles p where b.tur = 'xodim' and p.ism ilike b.kim and p.rol in ('admin', 'manager', 'qabulxona')),
       (select o.id from boshqa_xodimlar o where b.tur = 'boshqa' and o.ism ilike b.kim),
       x.summa, x.sana, b.xid
from bog b join xarajatlar x on x.id = b.xid;

commit;
