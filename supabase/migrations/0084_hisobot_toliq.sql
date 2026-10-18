-- ============================================================
--  0084 — Kunlik hisobot to'liq saytdan + "Ertangi kun maslahati"
--         + Sheets integratsiyasini muzlatish bayrog'i (Jamshid, 18.10)
-- ============================================================
--  19.10 dan ish saytda. Apps Script Sheets'dan yuboradigan ikki xabar
--  ([SHEETS] kunlik hisobot va "Ertangi kun uchun maslahat") endi
--  bazadan chiqadi — bo'limlari o'sha-o'sha:
--    kunlik_qoshimcha(kun): tushum turlari (naqd/terminal/click), oylik
--      reja, yozdirilganlar (yangi probniylar), probniy darsga kirganlar,
--      rasmiy o'quvchilar (fan bo'yicha / bola), bugun qo'shilganlar,
--      chiqib ketganlar (sabab, qarz).
--    ertangi_maslahat(kun): ertangi va kechikkan vazifalar (izohdagi
--      va'dalar o'rniga — saytda vazifa muddat bilan yoziladi),
--      ertaga tug'ilgan kunlar, doimiyga o'tmagan probniylar,
--      ertaga darsi bor qarzdorlar.
--  Ichki — faqat service_role (cron) chaqiradi.
--
--  Sheets integratsiyasi (sinxron, Apps Script hisobotlari, eski
--  varaqlarga yozish) O'CHIRILMAYDI — muzlatiladi: settings
--  'sheets.muzlatilgan'. Bitta tugma bilan qaytariladi (Sozlamalar).
-- ============================================================

insert into settings (kalit, qiymat, tavsif)
values ('sheets.muzlatilgan', 'false'::jsonb,
        'true — Sheets integratsiyasi muzlatilgan: sinxron yurmaydi, Apps Script hisobotlari ketmaydi, eski varaqlar himoyada. Sozlamalardan qaytariladi.')
on conflict (kalit) do nothing;

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
    'terminal', coalesce((select sum(summa) from t where usul = 'karta'), 0),
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


create or replace function ertangi_maslahat(p_kun date)
returns jsonb
language sql stable security definer set search_path = public as $$
  with e as (select p_kun + 1 as k)
  select jsonb_build_object(
    'ertaga', (select k from e),
    'vazifalar', coalesce((
      select jsonb_agg(jsonb_build_object('nom', v.nom,
               'vaqt', to_char(v.muddat at time zone 'Asia/Tashkent', 'DD.MM HH24:MI'),
               'kim', coalesce(l.ism, st.fish), 'tel', coalesce(l.telefon, st.shaxsiy_tel, st.ota_tel, st.ona_tel),
               'otgan', (v.muddat at time zone 'Asia/Tashkent')::date <= p_kun)
             order by v.muddat)
      from crm_vazifalar v
      cross join e
      left join leads l on l.id = v.lead_id
      left join students st on st.id = v.student_id
      where v.holat in ('yangi', 'jarayonda')
        and (v.muddat at time zone 'Asia/Tashkent')::date <= e.k), '[]'::jsonb),
    'tugilgan', coalesce((
      select jsonb_agg(jsonb_build_object('ism', x.ism, 'kim', x.kim) order by x.ism)
      from (
        select st.fish as ism, 'o‘quvchi' as kim, st.tugilgan_sana as ts from students st where st.holat = 'faol'
        union all
        select l.ism, 'probniy', l.tugilgan_sana from leads l where l.holat in ('yangi', 'qongiroq', 'keldi')
      ) x, e
      where x.ts is not null and to_char(x.ts, 'MM-DD') = to_char(e.k, 'MM-DD')), '[]'::jsonb),
    'tugilgan_yoq', (select count(*) from students where holat = 'faol' and tugilgan_sana is null),
    'faol_soni', (select count(*) from students where holat = 'faol'),
    'probniylar', coalesce((
      select jsonb_agg(jsonb_build_object('ism', l.ism, 'tel', l.telefon, 'fan', coalesce(s.nom, '—'),
               'kun', p_kun - (l.created_at at time zone 'Asia/Tashkent')::date,
               'kelgan', exists (select 1 from probniy_davomat pd where pd.lead_id = l.id and pd.holat in ('keldi', 'kechikdi')))
             order by l.created_at)
      from leads l left join groups g on g.id = l.group_id left join subjects s on s.id = coalesce(g.subject_id, l.subject_id)
      where l.holat in ('yangi', 'qongiroq', 'keldi') and l.student_id is null), '[]'::jsonb),
    'qarzdorlar', coalesce((
      select jsonb_agg(jsonb_build_object('guruh', x.nom, 'vaqt', x.boshlanish, 'oquvchilar', x.royxat) order by x.boshlanish, x.nom)
      from (
        select g.nom, g.boshlanish,
               jsonb_agg(jsonb_build_object('fish', st.fish, 'qarz', b.qarz) order by b.qarz desc) as royxat
        from groups g
        cross join e
        join enrollments en on en.group_id = g.id and en.holat = 'faol'
        join v_enrollment_balance b on b.enrollment_id = en.id and b.qarz > 0
        join students st on st.id = en.student_id
        where g.holat = 'faol' and guruh_dars_kuni(g.id, e.k)
        group by g.id, g.nom, g.boshlanish
      ) x), '[]'::jsonb)
  )
$$;
revoke execute on function ertangi_maslahat(date) from public, anon, authenticated;
grant execute on function ertangi_maslahat(date) to service_role;


/* Bayroq — sayt, sinxron skripti va Apps Script o'qiydi */
create or replace function sheets_muzlatilganmi() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (qiymat #>> '{}')::boolean from settings
                   where kalit = 'sheets.muzlatilgan' and jsonb_typeof(qiymat) = 'boolean'), false)
$$;
revoke execute on function sheets_muzlatilganmi() from public, anon;
grant execute on function sheets_muzlatilganmi() to authenticated, service_role;

create or replace function sheets_muzlat(p_muzlat boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Sheets integratsiyasini faqat admin, manager yoki direktor muzlatadi.';
  end if;
  update settings set qiymat = to_jsonb(coalesce(p_muzlat, false)), updated_at = now()
  where kalit = 'sheets.muzlatilgan';
  insert into audit_log (profile_id, amal, jadval, obyekt_id, eski, yangi)
  values (auth.uid(), case when p_muzlat then 'SHEETS_MUZLATILDI' else 'SHEETS_QAYTARILDI' end, 'settings', 'sheets.muzlatilgan',
          null, jsonb_build_object('muzlatilgan', p_muzlat));
  return coalesce(p_muzlat, false);
end;
$$;
revoke execute on function sheets_muzlat(boolean) from public, anon;
grant execute on function sheets_muzlat(boolean) to authenticated, service_role;
