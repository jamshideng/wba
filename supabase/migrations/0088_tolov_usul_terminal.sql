-- ============================================================
--  0088 — To'lov usullari: faqat Naqd, Click, Terminal (Jamshid, 24.10)
-- ============================================================
--  'karta' → 'terminal' deb qayta nomlanadi (prod'da karta to'lovi 0 ta).
--  'payme' enum'da qoladi (Postgres enum qiymatini o'chirib bo'lmaydi;
--  prod'da 1 ta eski to'lov) — formalarda endi tanlanmaydi, hisobotda
--  avvalgidek Click'ga qo'shiladi.
-- ============================================================

alter type payment_method rename value 'karta' to 'terminal';

-- kunlik_qoshimcha usulni matn sifatida solishtiradi — 'karta' → 'terminal'
create or replace function kunlik_qoshimcha(p_kun date)
returns jsonb
language sql stable security definer set search_path = public as $$
  with t as (
    select p.usul::text as usul, p.summa from payments p where not p.bekor and p.sana = p_kun
  ),
  davr as (select to_char(p_kun, 'YYYY-MM') as d),
  inv as (
    select i.enrollment_id, sum(i.summa) as summa
    from invoices i, davr where i.davr = davr.d and i.holat <> 'bekor' group by i.enrollment_id
  ),
  tol as (
    select p.enrollment_id, sum(p.summa) as summa
    from payments p, davr where p.davr = davr.d and not p.bekor and p.enrollment_id is not null group by p.enrollment_id
  ),
  faol as (
    select e.id, e.student_id from enrollments e
    where e.holat <> 'tugagan' and e.boshlandi <= p_kun and (e.tugadi is null or e.tugadi >= p_kun)
  )
  select jsonb_build_object(
    'naqd',     coalesce((select sum(summa) from t where usul = 'naqd'), 0),
    'terminal', coalesce((select sum(summa) from t where usul = 'terminal'), 0),
    'click',    coalesce((select sum(summa) from t where usul in ('click', 'payme')), 0),
    'soni',     (select count(*) from t),
    'reja',     coalesce((select sum(summa) from inv where summa > 0), 0),
    'reja_soni', (select count(*) from inv where summa > 0),
    'tushdi',   coalesce((select sum(summa) from tol), 0),
    'toliq',    (select count(*) from inv left join tol using (enrollment_id) where inv.summa > 0 and coalesce(tol.summa, 0) >= inv.summa),
    'yozdirilgan', coalesce((
      select jsonb_agg(jsonb_build_object('ism', l.ism, 'tel', l.telefon, 'fan', coalesce(s.nom, '—')) order by l.created_at)
      from leads l left join groups g on g.id = l.group_id left join subjects s on s.id = coalesce(g.subject_id, l.subject_id)
      where (l.created_at at time zone 'Asia/Tashkent')::date = p_kun), '[]'::jsonb),
    'probniy_kirgan', coalesce((
      select jsonb_agg(jsonb_build_object('ism', x.ism, 'tel', x.telefon, 'fan', x.fan) order by x.ism)
      from (
        select distinct l.ism, l.telefon, coalesce(s.nom, '—') as fan
        from probniy_davomat pd join lessons ls on ls.id = pd.lesson_id
        join leads l on l.id = pd.lead_id
        left join groups g on g.id = ls.group_id left join subjects s on s.id = g.subject_id
        where ls.sana = p_kun and pd.holat in ('keldi', 'kechikdi')
        union
        select l.ism, l.telefon, coalesce(s.nom, '—')
        from leads l join students st on st.id = l.student_id
        left join groups g on g.id = l.group_id left join subjects s on s.id = g.subject_id
        where l.holat = 'yozildi' and (l.updated_at at time zone 'Asia/Tashkent')::date = p_kun
      ) x), '[]'::jsonb),
    'rasmiy',      (select count(*) from faol),
    'rasmiy_bola', (select count(distinct student_id) from faol),
    'qoshilgan', coalesce((
      select jsonb_agg(jsonb_build_object('fish', st.fish, 'fan', coalesce(s.nom, '—')) order by st.fish)
      from enrollments e join students st on st.id = e.student_id
      join groups g on g.id = e.group_id left join subjects s on s.id = g.subject_id
      where e.boshlandi = p_kun and (e.created_at at time zone 'Asia/Tashkent')::date = p_kun), '[]'::jsonb),
    'ketgan', coalesce((
      select jsonb_agg(jsonb_build_object('fish', st.fish, 'sabab', st.ketish_sababi, 'izoh', st.arxiv_sabab,
               'qarz', coalesce(b.qarz, 0),
               'fan', (select string_agg(distinct coalesce(s.nom, '—'), ', ')
                       from enrollments e join groups g on g.id = e.group_id left join subjects s on s.id = g.subject_id
                       where e.student_id = st.id and e.tugadi between p_kun - 1 and p_kun)) order by st.fish)
      from students st left join v_student_balance b on b.student_id = st.id
      where st.holat = 'ketgan' and st.arxiv_sana = p_kun
        and coalesce(st.arxiv_sabab, '') not like 'Birlashtirildi%'), '[]'::jsonb)
  )
$$;
revoke execute on function kunlik_qoshimcha(date) from public, anon, authenticated;
grant execute on function kunlik_qoshimcha(date) to service_role;
