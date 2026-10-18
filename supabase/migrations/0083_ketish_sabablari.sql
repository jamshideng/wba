-- ============================================================
--  0083 — Ketish sabablari va tahlili (SoffCRM'dan, Jamshid 13.10)
-- ============================================================
--  Arxivga o'tkazishda sabab ro'yxatdan tanlanadi (7 ta):
--    narx · ustoz · vaqt · kochdi · natija · boshqa_markaz · boshqa
--  "boshqa" bo'lsa — izoh (arxiv_sabab) majburiy. Boshqalarida izoh ixtiyoriy.
--  Eski arxivdagilarga sabab keyin ham qo'yiladi (ketish_sababi_belgila).
--  Tahlil — ketish_tahlili(dan, gacha): sabablar, ustoz va fan kesimi,
--  koeffitsient, yo'qotilgan oylik daromad, o'rtacha o'qigan muddati.
--  Birlashtirilgan takroriy ID'lar (0080) tahlilga kirmaydi.
-- ============================================================

alter table students add column if not exists ketish_sababi text
  check (ketish_sababi is null or ketish_sababi in ('narx', 'ustoz', 'vaqt', 'kochdi', 'natija', 'boshqa_markaz', 'boshqa'));

comment on column students.ketish_sababi is
  'Ketish sababi (0083): narx, ustoz, vaqt, kochdi, natija, boshqa_markaz, boshqa. Izoh — arxiv_sabab.';

/* Arxivga — sabab turi bilan (eski 3 argumentli chaqiriq ham ishlaydi) */
drop function if exists oquvchi_arxivla(text, date, text);
create or replace function oquvchi_arxivla(p_student text, p_sana date default null, p_sabab text default null, p_turi text default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_sana date := coalesce(p_sana, bugun_toshkent());
  v_e    record;
  v_soni int := 0;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Arxivga o''tkazish huquqingiz yo''q.';
  end if;
  if not exists (select 1 from students where id = p_student and holat <> 'ketgan') then
    raise exception 'O''quvchi topilmadi yoki allaqachon arxivda.';
  end if;
  if p_turi = 'boshqa' and length(trim(coalesce(p_sabab, ''))) = 0 then
    raise exception '"Boshqa" tanlansa, sababini yozing.';
  end if;

  for v_e in select id from enrollments where student_id = p_student and holat <> 'tugagan' loop
    update enrollments set tugadi = greatest(v_sana, boshlandi), holat = 'tugagan' where id = v_e.id;
    delete from invoices where enrollment_id = v_e.id and davr > to_char(v_sana, 'YYYY-MM');
    v_soni := v_soni + 1;
  end loop;

  update students
     set holat = 'ketgan', arxiv_sana = v_sana, arxiv_sabab = nullif(trim(p_sabab), ''),
         ketish_sababi = nullif(p_turi, '')
   where id = p_student;
  return v_soni;
end;
$$;
revoke execute on function oquvchi_arxivla(text, date, text, text) from public, anon;
grant  execute on function oquvchi_arxivla(text, date, text, text) to authenticated, service_role;

/* Arxivdan qaytarilsa — sabab ham tozalanadi */
create or replace function oquvchi_arxivdan(p_student text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Arxivdan qaytarish huquqingiz yo''q.';
  end if;
  update students set holat = 'faol', arxiv_sana = null, arxiv_sabab = null, ketish_sababi = null
   where id = p_student and holat = 'ketgan';
  if not found then
    raise exception 'O''quvchi arxivda emas.';
  end if;
end;
$$;

/* Arxivdagi o'quvchiga sabab qo'yish / o'zgartirish */
create or replace function ketish_sababi_belgila(p_student text, p_turi text, p_izoh text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Huquqingiz yo''q.';
  end if;
  if p_turi is null or p_turi not in ('narx', 'ustoz', 'vaqt', 'kochdi', 'natija', 'boshqa_markaz', 'boshqa') then
    raise exception 'Sababni tanlang.';
  end if;
  if p_turi = 'boshqa' and length(trim(coalesce(p_izoh, ''))) = 0 then
    raise exception '"Boshqa" tanlansa, sababini yozing.';
  end if;
  update students
     set ketish_sababi = p_turi,
         arxiv_sabab = coalesce(nullif(trim(p_izoh), ''), arxiv_sabab)
   where id = p_student and holat = 'ketgan';
  if not found then
    raise exception 'O''quvchi arxivda emas.';
  end if;
end;
$$;
revoke execute on function ketish_sababi_belgila(text, text, text) from public, anon;
grant execute on function ketish_sababi_belgila(text, text, text) to authenticated, service_role;

/* Arxiv ro'yxati — sabab turi bilan */
create or replace view v_arxiv_oquvchilar
with (security_invoker = on) as
select s.id as student_id, s.fish, s.arxiv_sana, s.arxiv_sabab,
       coalesce(b.qarz, 0) as qarz,
       (select string_agg(g.nom, ' + ' order by e.tugadi desc)
          from enrollments e join groups g on g.id = e.group_id
         where e.student_id = s.id) as guruhlar,
       s.ketish_sababi
from students s
left join v_student_balance b on b.student_id = s.id
where s.holat = 'ketgan'
  and coalesce(s.arxiv_sabab, '') not like 'Birlashtirildi%';


/*
 * Tahlil: shu davrda arxivga o'tganlar.
 *   koeffitsient = ketganlar ÷ (davr boshida o'qiyotganlar + davrda kelganlar) × 100
 *   yo'qotilgan daromad = har bir yopilgan qatnashuvning oxirgi oylik fakturasi
 *   o'rtacha muddat = qo'shilgan kundan arxivgacha (oy)
 */
create or replace function ketish_tahlili(p_dan date, p_gacha date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_r jsonb;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Tahlil faqat xodimlarga ochiq.';
  end if;

  with ket as (
    select s.id, s.fish, s.qoshilgan_sana, s.arxiv_sana, coalesce(s.ketish_sababi, 'belgilanmagan') as sabab, s.arxiv_sabab
    from students s
    where s.holat = 'ketgan' and s.arxiv_sana between p_dan and p_gacha
      and coalesce(s.arxiv_sabab, '') not like 'Birlashtirildi%'
  ),
  yop as (   -- ketganlarning arxiv kuni (yoki 1 kun oldin) yopilgan qatnashuvlari
    select k.id as student_id, e.id as eid, g.teacher_id, g.subject_id,
           (select i.summa from invoices i where i.enrollment_id = e.id and i.holat <> 'bekor'
             order by i.davr desc limit 1) as oylik
    from ket k
    join enrollments e on e.student_id = k.id and e.tugadi between k.arxiv_sana - 1 and k.arxiv_sana
    join groups g on g.id = e.group_id
  ),
  bosh as (
    select count(*) as n from students s
    where s.qoshilgan_sana < p_dan and (s.holat <> 'ketgan' or s.arxiv_sana >= p_dan)
      and coalesce(s.arxiv_sabab, '') not like 'Birlashtirildi%'
  ),
  yangi as (
    select count(*) as n from students s
    where s.qoshilgan_sana between p_dan and p_gacha
      and coalesce(s.arxiv_sabab, '') not like 'Birlashtirildi%'
  )
  select jsonb_build_object(
    'jami', (select count(*) from ket),
    'boshida', (select n from bosh),
    'yangi', (select n from yangi),
    'koeffitsient', round(100.0 * (select count(*) from ket) / nullif((select n from bosh) + (select n from yangi), 0), 1),
    'yoqotilgan', coalesce((select sum(oylik) from yop), 0),
    'orta_oy', round((select avg((k.arxiv_sana - k.qoshilgan_sana) / 30.4) from ket k where k.qoshilgan_sana is not null), 1),
    'sabablar', coalesce((select jsonb_agg(jsonb_build_object('sabab', sabab, 'soni', n) order by n desc)
                          from (select sabab, count(*) n from ket group by sabab) x), '[]'::jsonb),
    'ustozlar', coalesce((select jsonb_agg(jsonb_build_object('ism', coalesce(t.ism, '—'), 'soni', n) order by n desc)
                          from (select teacher_id, count(distinct student_id) n from yop group by teacher_id) x
                          left join teachers t on t.id = x.teacher_id), '[]'::jsonb),
    'fanlar', coalesce((select jsonb_agg(jsonb_build_object('nom', coalesce(f.nom, '—'), 'soni', n) order by n desc)
                        from (select subject_id, count(distinct student_id) n from yop group by subject_id) x
                        left join subjects f on f.id = x.subject_id), '[]'::jsonb),
    'royxat', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'fish', k.fish, 'sana', k.arxiv_sana,
                                                            'sabab', k.sabab, 'izoh', k.arxiv_sabab) order by k.arxiv_sana desc)
                        from ket k), '[]'::jsonb)
  ) into v_r;
  return v_r;
end;
$$;
revoke execute on function ketish_tahlili(date, date) from public, anon;
grant execute on function ketish_tahlili(date, date) to authenticated, service_role;
