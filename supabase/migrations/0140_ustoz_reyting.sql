-- ============================================================
--  0140 — Ustoz reytingi (Jamshid, 22.11)
-- ============================================================
--  Faqat rahbariyat (admin, direktor, manager) ko'radi. Snapshot —
--  reyting_hisobla o'quvchi reytingidan keyin shu davr uchun hisoblaydi.
--  Darslar: ustoz guruhining shu davrdagi o'tilgan darslari, ZAMENA
--  darslari kirmaydi (na guruh ustoziga, na o'rinbosarga).
--
--  Omillar (0–100):
--    · test      (faqat oylik) — guruhlari bo'yicha o'rtacha: har guruhda
--                o'quvchilar test natijasi o'rtachasi (kelmagan = 0).
--                Guruhda shu oy test o'tkazilmagan — guruh 0 va intizomga 1 hodisa.
--    · ushlash   = 100 × (1 − ketishlar / o'quvchilar). Ketish: davrda guruhdan
--                ketgan, kamida min_qatnashgan_dars darsga kelgan o'quvchi.
--                Ustozga bog'liq bo'lmagan sabab = koeffitsient (0,25), bog'liq
--                yoki sababsiz = 1. Guruh almashtirish ketish emas.
--                boshlanish_sana dan oldingi ketishlar kirmaydi.
--    · kechikish — har dars: max(0, 100 − daqiqa × K), davr o'rtachasi.
--                Pul jarimasiga (0100) tegilmaydi.
--    · intizom   = max(0, 100 − hodisalar × N). Hodisalar:
--                  nazorat hodisalari (ustoz_kechikdi, davomat_qilinmadi,
--                  oquvchi_3_kelmadi kirmaydi — ular boshqa omilda yoki ustoz
--                  aybi emas; manager yopgani va ogohlantirishga aylangani kirmaydi),
--                  ogohlantirishlar (bekor qilinmagan),
--                  davomat dars kunidan keyin to'liq bo'lgan / to'liq bo'lmagan dars,
--                  oylikda: test o'tkazilmagan guruh, natija muddatdan keyin
--                  (keyingi oyning test_muddati_kun sanasigacha) kiritilmagan guruh.
--    · davomat   — guruhlari darslaridagi keldi / belgilar.
-- ============================================================

create table if not exists ustoz_reyting (
  davr_id          bigint not null references reyting_davrlar (id) on delete cascade,
  teacher_id       text not null references teachers (id) on delete cascade,
  darslar          int not null,
  guruhlar         int not null,
  test             numeric(5, 1),
  oquvchilar       int not null,
  ketish           numeric(6, 2) not null,
  ushlash          numeric(5, 1) not null,
  kechikish_daqiqa int not null,
  kechikish        numeric(5, 1) not null,
  hodisalar        int not null,
  intizom          numeric(5, 1) not null,
  davomat          numeric(5, 1) not null,
  umumiy           numeric(5, 1) not null,
  orin             int,
  tafsilot         jsonb not null default '{}'::jsonb,
  primary key (davr_id, teacher_id)
);

comment on table ustoz_reyting is 'Ustoz reytingi snapshot (0140). Faqat rahbariyat ko''radi.';

alter table ustoz_reyting enable row level security;
alter table ustoz_reyting force row level security;

drop policy if exists ustoz_reyting_rahbariyat on ustoz_reyting;
create policy ustoz_reyting_rahbariyat on ustoz_reyting for select to authenticated
  using (coalesce(app_rol() in ('admin', 'direktor', 'manager'), false));

create or replace function ustoz_reyting_hisobla(p_davr bigint) returns int
language plpgsql security definer set search_path = public as $$
declare
  d      reyting_davrlar%rowtype;
  s      jsonb;
  oylik  boolean;
  w      jsonb;
  k_kech numeric;
  n_int  numeric;
  koef   numeric;
  v_minq int;
  v_bosh date;
  v_muddat date;
  v_soni int;
begin
  select * into d from reyting_davrlar where id = p_davr;
  if not found then raise exception 'Reyting davri topilmadi.'; end if;
  s := d.sozlama;
  oylik := d.tur = 'oylik';
  w := case when oylik then s -> 'ustoz_oylik' else s -> 'ustoz_haftalik' end;
  k_kech := (s ->> 'kechikish_k')::numeric;
  n_int  := (s ->> 'intizom_n')::numeric;
  koef   := (s ->> 'bogliq_emas_koef')::numeric;
  v_minq := (s ->> 'min_qatnashgan_dars')::int;
  v_bosh := greatest(d.dan, coalesce((s ->> 'boshlanish_sana')::date, d.dan));
  v_muddat := d.gacha + (s ->> 'test_muddati_kun')::int;

  delete from ustoz_reyting where davr_id = p_davr;

  insert into ustoz_reyting (davr_id, teacher_id, darslar, guruhlar, test, oquvchilar, ketish, ushlash,
                             kechikish_daqiqa, kechikish, hodisalar, intizom, davomat, umumiy, tafsilot)
  with dars as (
    select l.id, l.group_id, l.sana, l.davomat_vaqti, g.teacher_id,
           row_number() over (partition by g.teacher_id, l.sana order by g.boshlanish, g.id) as kun_tartib
    from lessons l
    join groups g on g.id = l.group_id
    where l.sana between d.dan and d.gacha
      and l.otkazildi
      and l.zamena_teacher_id is null
      and g.teacher_id is not null
  ),
  guruh as (
    select distinct teacher_id, group_id from dars
  ),
  -- Kechikish: shu kunning shu guruhiga; guruhi yozilmagan bo'lsa — kunning birinchi darsiga
  dars_kech as (
    select x.*, coalesce((select sum(k.daqiqa) from ustoz_kechikish k
                           where k.teacher_id = x.teacher_id and k.sana = x.sana
                             and (k.group_id = x.group_id or (k.group_id is null and x.kun_tartib = 1))), 0) as daqiqa
    from dars x
  ),
  kech as (
    select teacher_id, count(*)::int as darslar, sum(daqiqa)::int as daqiqa,
           round(avg(greatest(0, 100 - daqiqa * k_kech)), 1) as ball,
           (count(*) filter (where davomat_vaqti is null
                               or (davomat_vaqti at time zone 'Asia/Tashkent')::date > sana))::int as davomat_kech
    from dars_kech group by teacher_id
  ),
  dav as (
    select x.teacher_id,
           count(a.id) as belgi,
           count(a.id) filter (where a.holat = 'keldi') as keldi
    from dars x left join attendance a on a.lesson_id = x.id
    group by x.teacher_id
  ),
  -- Oylik test: har guruh bo'yicha o'quvchilar natijasi o'rtachasi
  test_guruh as (
    select gr.teacher_id, gr.group_id,
           exists (select 1 from oylik_testlar t where t.group_id = gr.group_id and t.davr = to_char(d.dan, 'YYYY-MM')) as bor,
           (select avg(coalesce(r.test, 0)) from oquvchi_reyting r where r.davr_id = p_davr and r.group_id = gr.group_id) as ortacha,
           exists (select 1 from oquvchi_reyting r
                    where r.davr_id = p_davr and r.group_id = gr.group_id
                      and not exists (
                        select 1 from oylik_test_natijalar n
                        join oylik_testlar t on t.id = n.test_id
                        where t.group_id = gr.group_id and t.davr = to_char(d.dan, 'YYYY-MM')
                          and n.student_id = r.student_id
                          and (n.kiritilgan_vaqt at time zone 'Asia/Tashkent')::date <= v_muddat)) as kech
    from guruh gr
    where oylik
  ),
  test as (
    select teacher_id,
           round(avg(case when bor then coalesce(ortacha, 0) else 0 end), 1) as ball,
           (count(*) filter (where not bor))::int as yoq,
           (count(*) filter (where bor and kech))::int as kech
    from test_guruh group by teacher_id
  ),
  -- Ushlab qolish
  oquv as (
    select gr.teacher_id, count(distinct (e.student_id, e.group_id))::int as soni
    from guruh gr
    join enrollments e on e.group_id = gr.group_id
    where e.boshlandi <= d.gacha and (e.tugadi is null or e.tugadi >= d.dan)
    group by gr.teacher_id
  ),
  ketgan as (
    select gr.teacher_id, e.student_id, e.group_id, e.ketish_sababi,
           case when rx.ustozga_bogliq is false then koef else 1 end as vazn
    from guruh gr
    join enrollments e on e.group_id = gr.group_id
    join groups ge on ge.id = e.group_id
    left join royxatlar rx on rx.tur = 'ketish_sabab' and rx.kalit = e.ketish_sababi
    where e.holat = 'tugagan'
      and e.tugadi between v_bosh and d.gacha
      -- guruh almashtirish: shu fanning boshqa guruhida keyingi kuni davom etgan
      and not exists (select 1 from enrollments o join groups go on go.id = o.group_id
                       where o.student_id = e.student_id and o.id <> e.id and go.subject_id = ge.subject_id
                         and o.boshlandi between e.tugadi and e.tugadi + 1)
      and (select count(*) from attendance a join lessons l on l.id = a.lesson_id
            where a.student_id = e.student_id and l.group_id = e.group_id and a.holat = 'keldi') >= v_minq
  ),
  ketish as (
    select teacher_id, sum(vazn) as soni,
           jsonb_agg(jsonb_build_object('student_id', student_id, 'group_id', group_id,
                                        'sabab', ketish_sababi, 'vazn', vazn)) as royxat
    from ketgan group by teacher_id
  ),
  -- Intizom hodisalari
  naz as (
    select h.teacher_id, count(*)::int as soni
    from nazorat_hodisalar h
    where h.sana between d.dan and d.gacha
      and h.teacher_id is not null
      and h.turi not in ('ustoz_kechikdi', 'davomat_qilinmadi', 'oquvchi_3_kelmadi')
      and h.holat <> 'yopildi'
      and not exists (select 1 from ogohlantirishlar o where o.hodisa_id = h.id)
    group by h.teacher_id
  ),
  ogoh as (
    select o.teacher_id, count(*)::int as soni
    from ogohlantirishlar o
    where not o.bekor and o.teacher_id is not null
      and (o.created_at at time zone 'Asia/Tashkent')::date between d.dan and d.gacha
    group by o.teacher_id
  ),
  jam as (
    select k.teacher_id, k.darslar,
           (select count(*)::int from guruh gr where gr.teacher_id = k.teacher_id) as guruhlar,
           t.ball as test,
           coalesce(q.soni, 0) as oquvchilar,
           coalesce(kt.soni, 0) as ketish,
           k.daqiqa, k.ball as kechikish,
           coalesce(nz.soni, 0) as naz, coalesce(og.soni, 0) as ogoh, k.davomat_kech,
           coalesce(t.yoq, 0) as test_yoq, coalesce(t.kech, 0) as test_kech,
           case when dv.belgi > 0 then round(100.0 * dv.keldi / dv.belgi, 1) else 0 end as davomat,
           coalesce(kt.royxat, '[]'::jsonb) as ketganlar
    from kech k
    left join test t on t.teacher_id = k.teacher_id
    left join oquv q on q.teacher_id = k.teacher_id
    left join ketish kt on kt.teacher_id = k.teacher_id
    left join naz nz on nz.teacher_id = k.teacher_id
    left join ogoh og on og.teacher_id = k.teacher_id
    left join dav dv on dv.teacher_id = k.teacher_id
  ),
  ball as (
    select j.*,
           case when j.oquvchilar > 0 then round(greatest(0, 100 * (1 - j.ketish / j.oquvchilar)), 1) else 100 end as ushlash,
           j.naz + j.ogoh + j.davomat_kech + j.test_yoq + j.test_kech as hodisa
    from jam j
  )
  select p_davr, b.teacher_id, b.darslar, b.guruhlar, b.test, b.oquvchilar, b.ketish, b.ushlash,
         b.daqiqa, b.kechikish, b.hodisa,
         greatest(0, 100 - b.hodisa * n_int),
         b.davomat,
         round(
           (coalesce(b.test, 0) * coalesce((w ->> 'test')::numeric, 0)
            + b.ushlash * coalesce((w ->> 'ushlash')::numeric, 0)
            + b.kechikish * coalesce((w ->> 'kechikish')::numeric, 0)
            + greatest(0, 100 - b.hodisa * n_int) * coalesce((w ->> 'intizom')::numeric, 0)
            + b.davomat * coalesce((w ->> 'davomat')::numeric, 0)) / 100, 1),
         jsonb_build_object('nazorat', b.naz, 'ogohlantirish', b.ogoh, 'davomat_kech', b.davomat_kech,
                            'test_yoq', b.test_yoq, 'test_kech', b.test_kech, 'ketganlar', b.ketganlar)
  from ball b;
  get diagnostics v_soni = row_count;

  update ustoz_reyting r set orin = x.orin
  from (select teacher_id, rank() over (order by umumiy desc, darslar desc) as orin
          from ustoz_reyting where davr_id = p_davr) x
  where r.davr_id = p_davr and r.teacher_id = x.teacher_id;

  return v_soni;
end;
$$;

revoke execute on function ustoz_reyting_hisobla(bigint) from public, anon, authenticated;
grant  execute on function ustoz_reyting_hisobla(bigint) to service_role;

/* reyting_hisobla — endi ustoz reytingi ham (o'quvchi reytingidan keyin: test o'rtachasi undan) */
create or replace function reyting_hisobla(p_tur text, p_sana date default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_bugun date := bugun_toshkent();
  v_sana  date;
  ch      record;
  v_id    bigint;
begin
  if auth.uid() is not null and coalesce(app_rol() not in ('admin', 'direktor', 'manager'), true) then
    raise exception 'Reytingni faqat rahbariyat hisoblaydi.';
  end if;
  v_sana := coalesce(p_sana, case when p_tur = 'oylik' then (v_bugun - interval '1 month')::date else v_bugun end);
  select * into ch from reyting_davr_chegarasi(p_tur, v_sana);
  if ch.gacha > v_bugun then
    raise exception 'Davr hali tugamagan (% gacha).', to_char(ch.gacha, 'DD/MM/YYYY');
  end if;

  insert into reyting_davrlar (tur, dan, gacha, sozlama, hisobladi)
  values (p_tur, ch.dan, ch.gacha, reyting_sozlama(), auth.uid())
  on conflict (tur, dan) do update
    set sozlama = excluded.sozlama, hisoblangan = now(), hisobladi = excluded.hisobladi
  returning id into v_id;

  perform oquvchi_reyting_hisobla(v_id);
  perform ustoz_reyting_hisobla(v_id);
  return v_id;
end;
$$;

/* Rahbariyat uchun ro'yxat — ustoz ismi bilan */
create or replace function reyting_ustozlar(p_davr bigint)
returns table (orin int, teacher_id text, ism text, umumiy numeric, test numeric, ushlash numeric,
               kechikish numeric, intizom numeric, davomat numeric, darslar int, guruhlar int,
               oquvchilar int, ketish numeric, kechikish_daqiqa int, hodisalar int, tafsilot jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is not null and coalesce(app_rol() not in ('admin', 'direktor', 'manager'), true) then
    raise exception 'Ustozlar reytingini faqat rahbariyat ko''radi.';
  end if;
  return query
  select r.orin, r.teacher_id, t.ism, r.umumiy, r.test, r.ushlash, r.kechikish, r.intizom, r.davomat,
         r.darslar, r.guruhlar, r.oquvchilar, r.ketish, r.kechikish_daqiqa, r.hodisalar, r.tafsilot
  from ustoz_reyting r
  join teachers t on t.id = r.teacher_id
  where r.davr_id = p_davr
  order by r.orin, t.ism;
end;
$$;

revoke execute on function reyting_ustozlar(bigint) from public, anon;
grant  execute on function reyting_ustozlar(bigint) to authenticated, service_role;

/* Bitta ustozning tarixi (rahbariyat) */
create or replace function reyting_ustoz_tarixi(p_teacher text)
returns table (davr_id bigint, tur text, dan date, gacha date, orin int, jami int, umumiy numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is not null and coalesce(app_rol() not in ('admin', 'direktor', 'manager'), true) then
    raise exception 'Ustozlar reytingini faqat rahbariyat ko''radi.';
  end if;
  return query
  select d.id, d.tur, d.dan, d.gacha, r.orin,
         (select count(*)::int from ustoz_reyting x where x.davr_id = d.id), r.umumiy
  from ustoz_reyting r join reyting_davrlar d on d.id = r.davr_id
  where r.teacher_id = p_teacher
  order by d.dan desc, d.tur;
end;
$$;

revoke execute on function reyting_ustoz_tarixi(text) from public, anon;
grant  execute on function reyting_ustoz_tarixi(text) to authenticated, service_role;
