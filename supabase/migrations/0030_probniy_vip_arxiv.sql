-- ============================================================
--  World Bridge Academy
--  0030_probniy_vip_arxiv.sql · Sheets'dagi uchta imkoniyat saytga
--
--  1. PROBNIY DAVOMATDA (docs/HISOB-KITOB.md §7, Y_Probniy.js).
--     Probniy bola guruh jurnalida yozilgan kunidan "· probniy" bo'lib
--     ko'rinadi, ustoz/admin belgilaydi — pul hisoblanmaydi. To'lov qilib
--     doimiy bo'lganda (probniy_doimiy) belgilar o'quvchining attendance'iga
--     ko'chadi: DAVOMAT — probniy kunidan, PUL — doimiy kundan.
--     probniy_davomat alohida jadval: probniy hali students'da yo'q.
--     Ustoz leads'ni ko'rmaydi (RLS) — jurnal uchun jurnal_probniylar()
--     faqat ism va sanani beradi, telefon chiqmaydi.
--
--  2. VIP (Sheets "Tanlov" = VIP): yozilish to'lamaydi, lekin faol
--     o'quvchi hisobida. enrollments.vip + vip_dan (qaysi oydan).
--     VIP oylarda hisob-faktura 0: butun narx chegirma ustuniga yoziladi,
--     VIP olinsa oy narxi (summa + chegirma + tuzatish) saqlangani uchun
--     qayta hisoblanadi. Hisob bitta joyda: yozilish_qayta_hisobla().
--
--  3. ARXIV: o'quvchi (holat 'ketgan' + arxiv sanasi/sababi, qarzi qoladi,
--     shu ID bilan qaytariladi), guruh ('yopilgan'), ustoz ('bloklangan').
--     oquvchi_arxivla() hamma faol yozilishni o'sha kuni yopadi.
--
--  4. TO'LOV HOLATI: yozilish_oylari() — har oy uchun to'lashi kerak,
--     shu oy uchun to'langan, holat (To'lanmagan/Qisman/To'liq/Ortiqcha),
--     keyingi oy summasi va oldindan to'langan (kelajak oylar uchun).
-- ============================================================


-- ------------------------------------------------------------
-- 1. Probniy davomati
-- ------------------------------------------------------------

create table if not exists probniy_davomat (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references lessons (id) on delete cascade,
  lead_id    uuid not null references leads (id) on delete cascade,
  holat      attendance_status not null,
  belgiladi  uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, lead_id)
);

create index if not exists probniy_davomat_lead_idx on probniy_davomat (lead_id);

alter table probniy_davomat enable row level security;
alter table probniy_davomat force row level security;

drop policy if exists probniy_davomat_staff on probniy_davomat;
create policy probniy_davomat_staff on probniy_davomat for select to authenticated
  using (app_is_staff());

comment on table probniy_davomat is
  'Probniy bolaning davomati (pulsiz). Yozish faqat probniy_belgila() orqali; doimiy bo''lganda attendance''ga ko''chadi.';


/* Jurnal uchun: guruhdagi probniylar — faqat ism va qachondan. Ustoz o'z
   guruhini, xodim hammasini ko'radi. Kelmadi/rad — ko'rinmaydi. */
create or replace function jurnal_probniylar(p_group text, p_dan date, p_gacha date)
returns table (lead_id uuid, ism text, dan date, belgilar jsonb)
language sql stable security definer set search_path = public as $$
  select l.id, l.ism,
         (l.created_at at time zone 'Asia/Tashkent')::date,
         coalesce((
           select jsonb_object_agg(ls.sana::text, pd.holat)
           from probniy_davomat pd
           join lessons ls on ls.id = pd.lesson_id
           where pd.lead_id = l.id and ls.sana between p_dan and p_gacha
         ), '{}'::jsonb)
  from leads l
  where l.group_id = p_group
    and l.student_id is null
    and l.holat in ('yangi', 'qongiroq', 'keldi')
    and (l.created_at at time zone 'Asia/Tashkent')::date <= p_gacha
    and (app_is_staff() or app_teaches_group(p_group) or auth.uid() is null)
  order by l.ism
$$;

revoke execute on function jurnal_probniylar(text, date, date) from public, anon;
grant  execute on function jurnal_probniylar(text, date, date) to authenticated, service_role;


/* Probniy katagi — huquq davomat_belgila bilan bir xil (Q5). */
create or replace function probniy_belgila(
  p_group text,
  p_sana  date,
  p_lead  uuid,
  p_holat attendance_status
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dars   uuid;
  v_kunlar smallint[];
begin
  if auth.uid() is not null and not (app_teaches_group(p_group) or app_is_admin()) then
    raise exception 'Bu guruhga davomat qo''yish huquqingiz yo''q.';
  end if;
  if p_sana > bugun_toshkent() then
    raise exception 'Kelasi kunga davomat qo''yib bo''lmaydi.';
  end if;
  if auth.uid() is not null and not app_is_admin() and p_sana < bugun_toshkent() then
    raise exception 'O''tgan kun davomatini faqat admin tuzatadi.';
  end if;
  if not exists (
    select 1 from leads
    where id = p_lead and group_id = p_group and student_id is null
      and holat in ('yangi', 'qongiroq', 'keldi')
  ) then
    raise exception 'Probniy bu guruhda emas.';
  end if;

  select kunlar into v_kunlar from groups where id = p_group;
  select id into v_dars from lessons where group_id = p_group and sana = p_sana;
  if v_dars is null and not guruh_dars_kunimi(v_kunlar, p_sana) then
    raise exception 'Bu kun guruhning dars kuni emas.';
  end if;
  if v_dars is null then
    insert into lessons (group_id, sana, otkazildi) values (p_group, p_sana, true)
    on conflict (group_id, sana) do update set otkazildi = true
    returning id into v_dars;
  end if;

  if p_holat is null then
    delete from probniy_davomat where lesson_id = v_dars and lead_id = p_lead;
  else
    insert into probniy_davomat (lesson_id, lead_id, holat, belgiladi)
    values (v_dars, p_lead, p_holat, auth.uid())
    on conflict (lesson_id, lead_id) do update
      set holat = excluded.holat, belgiladi = excluded.belgiladi, updated_at = now();
    -- Darsga kelgan probniy "keldi" holatiga o'tadi (probniylar ro'yxatida ko'rinadi)
    if p_holat in ('keldi', 'kechikdi') then
      update leads set holat = 'keldi' where id = p_lead and holat in ('yangi', 'qongiroq');
    end if;
  end if;
end;
$$;

revoke execute on function probniy_belgila(text, date, uuid, attendance_status) from public, anon;
grant  execute on function probniy_belgila(text, date, uuid, attendance_status) to authenticated, service_role;


/* Doimiy qilish — belgilar ham o'quvchiga ko'chadi (0010 + davomat) */
create or replace function probniy_doimiy(p_lead uuid, p_boshlandi date default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_lead leads%rowtype;
  v_id   text;
begin
  if not app_is_staff() then
    raise exception 'Probniyni o''quvchi qilish huquqingiz yo''q.';
  end if;

  select * into v_lead from leads where id = p_lead for update;
  if not found then
    raise exception 'Probniy topilmadi.';
  end if;
  if v_lead.student_id is not null then
    raise exception 'Bu probniy allaqachon o''quvchi qilingan (%).', v_lead.student_id;
  end if;
  if v_lead.group_id is null then
    raise exception 'Guruh tanlanmagan — avval guruhni belgilang.';
  end if;

  v_id := oquvchi_qosh(jsonb_build_object(
    'fish',          v_lead.ism,
    'shaxsiy_tel',   v_lead.telefon,
    'tugilgan_sana', v_lead.tugilgan_sana,
    'group_id',      v_lead.group_id,
    'boshlandi',     coalesce(p_boshlandi, bugun_toshkent()),
    'izoh',          nullif(concat_ws(' · ', 'Probniydan', v_lead.izoh), 'Probniydan')
  ));

  -- Probniy kunlaridagi davomat o'quvchining tarixiga (pul emas — faqat davomat)
  insert into attendance (lesson_id, student_id, holat, belgiladi)
  select pd.lesson_id, v_id, pd.holat, pd.belgiladi
  from probniy_davomat pd
  where pd.lead_id = p_lead
  on conflict (lesson_id, student_id) do nothing;

  update leads set holat = 'yozildi', student_id = v_id where id = p_lead;
  return v_id;
end;
$$;


-- ------------------------------------------------------------
-- 2. VIP
-- ------------------------------------------------------------

alter table enrollments add column if not exists vip     boolean not null default false;
alter table enrollments add column if not exists vip_dan text check (vip_dan is null or vip_dan ~ '^\d{4}-(0[1-9]|1[0-2])$');

comment on column enrollments.vip is 'VIP — to''lamaydi, lekin faol o''quvchi hisobida (Sheets "Tanlov" = VIP).';
comment on column enrollments.vip_dan is 'Qaysi oydan VIP. Bo''sh — boshidan.';

create or replace function vip_oymi(p_enrollment uuid, p_davr text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select e.vip and p_davr >= coalesce(e.vip_dan, '0000-01')
                   from enrollments e where e.id = p_enrollment), false)
$$;

/* Yangi hisob-faktura: VIP oy — 0 (narx chegirma ustunida saqlanadi).
   Tuzatish triggeridan (0029) OLDIN ishlashi uchun nomi alifboda oldin. */
create or replace function invoice_vip_qoy() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if vip_oymi(new.enrollment_id, new.davr) then
    new.chegirma := new.chegirma + new.summa;
    new.summa    := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_a_vip on invoices;
create trigger invoices_a_vip before insert on invoices
  for each row execute function invoice_vip_qoy();

/* Bitta yozilishning hamma oylarini qayta hisoblash: narx saqlanadi,
   VIP → chegirma (to'liq) → tuzatish tartibida ayiriladi. */
create or replace function yozilish_qayta_hisobla(p_enrollment uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_soni int;
begin
  with e as (
    select * from enrollments where id = p_enrollment
  ),
  narxlar as (
    select i.id, i.davr, (i.summa + i.chegirma + i.tuzatish) as narx,
           vip_oymi(p_enrollment, i.davr) as vip,
           chegirma_oyda(oy_raqami(e.boshlandi, i.davr),
                         e.chegirma_summa, e.chegirma_oy,
                         e.chegirma2_summa, e.chegirma2_oy) as cheg_xom
    from invoices i, e
    where i.enrollment_id = e.id and i.holat <> 'bekor'
  ),
  yangi as (
    select n.id, n.narx,
           case when n.vip then n.narx else least(n.cheg_xom, n.narx) end as cheg,
           case when n.vip then 0
                else least(tuzatish_jami(p_enrollment, n.davr), n.narx - least(n.cheg_xom, n.narx)) end as tuz
    from narxlar n
  )
  update invoices i
     set chegirma = y.cheg,
         tuzatish = y.tuz,
         summa    = y.narx - y.cheg - y.tuz
    from yangi y
   where i.id = y.id
     and (i.chegirma is distinct from y.cheg or i.tuzatish is distinct from y.tuz);

  get diagnostics v_soni = row_count;
  return v_soni;
end;
$$;

revoke execute on function yozilish_qayta_hisobla(uuid) from public, anon, authenticated;
grant  execute on function yozilish_qayta_hisobla(uuid) to service_role;

/* tuzatish_hisobla (0029) VIP oyga tuzatish qo'ymasin — umumiy hisobga yo'naltiriladi */
create or replace function tuzatish_hisobla(p_enrollment uuid, p_davr text) returns void
language sql security definer set search_path = public as $$
  select yozilish_qayta_hisobla(p_enrollment);
$$;

create or replace function vip_ozgartir(p_enrollment uuid, p_vip boolean, p_dan text default null)
returns int
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'VIP ni faqat admin yoki direktor belgilaydi.';
  end if;
  if p_dan is not null and p_dan !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy noto''g''ri (masalan 2026-10).';
  end if;
  update enrollments
     set vip = p_vip, vip_dan = case when p_vip then p_dan else null end
   where id = p_enrollment;
  if not found then
    raise exception 'Yozilish topilmadi.';
  end if;
  return yozilish_qayta_hisobla(p_enrollment);
end;
$$;

revoke execute on function vip_ozgartir(uuid, boolean, text) from public, anon;
grant  execute on function vip_ozgartir(uuid, boolean, text) to authenticated, service_role;

/* chegirma_ozgartir (0014/0029) — endi umumiy hisob bilan (VIP ham hisobda) */
create or replace function chegirma_ozgartir(p_enrollment uuid, p jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_c1 numeric := coalesce(nullif(p ->> 'chegirma_summa', '')::numeric, 0);
  v_c2 numeric := coalesce(nullif(p ->> 'chegirma2_summa', '')::numeric, 0);
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Chegirmani o''zgartirish huquqingiz yo''q.';
  end if;
  if v_c1 < 0 or v_c2 < 0 then
    raise exception 'Chegirma manfiy bo''lmaydi.';
  end if;

  update enrollments set
    chegirma_summa  = v_c1,
    chegirma_oy     = case when v_c1 > 0 then nullif(p ->> 'chegirma_oy', '')::int else 0 end,
    chegirma2_summa = v_c2,
    chegirma2_oy    = case when v_c2 > 0 then nullif(p ->> 'chegirma2_oy', '')::int else 0 end,
    chegirma_sabab  = coalesce(nullif(p ->> 'chegirma_sabab', ''), chegirma_sabab)
  where id = p_enrollment;

  if not found then
    raise exception 'Yozilish topilmadi.';
  end if;

  return yozilish_qayta_hisobla(p_enrollment);
end;
$$;


-- ------------------------------------------------------------
-- 3. Arxiv
-- ------------------------------------------------------------

alter table students add column if not exists arxiv_sana  date;
alter table students add column if not exists arxiv_sabab text;
alter table groups   add column if not exists yopilgan_sana date;
alter table teachers add column if not exists arxiv_sana  date;

comment on column students.arxiv_sana is 'Arxivga o''tgan kun (holat = ketgan). Qarzi saqlanadi, shu ID bilan qaytariladi.';

create or replace function oquvchi_arxivla(p_student text, p_sana date default null, p_sabab text default null)
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

  for v_e in select id from enrollments where student_id = p_student and holat <> 'tugagan' loop
    update enrollments set tugadi = greatest(v_sana, boshlandi), holat = 'tugagan' where id = v_e.id;
    delete from invoices where enrollment_id = v_e.id and davr > to_char(v_sana, 'YYYY-MM');
    v_soni := v_soni + 1;
  end loop;

  update students
     set holat = 'ketgan', arxiv_sana = v_sana, arxiv_sabab = nullif(trim(p_sabab), '')
   where id = p_student;
  return v_soni;
end;
$$;

create or replace function oquvchi_arxivdan(p_student text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Arxivdan qaytarish huquqingiz yo''q.';
  end if;
  update students set holat = 'faol', arxiv_sana = null, arxiv_sabab = null
   where id = p_student and holat = 'ketgan';
  if not found then
    raise exception 'O''quvchi arxivda emas.';
  end if;
end;
$$;

revoke execute on function oquvchi_arxivla(text, date, text) from public, anon;
grant  execute on function oquvchi_arxivla(text, date, text) to authenticated, service_role;
revoke execute on function oquvchi_arxivdan(text) from public, anon;
grant  execute on function oquvchi_arxivdan(text) to authenticated, service_role;

/* Arxivdagi o'quvchilar va qarzi (v_qarzdorlar faqat faollarni ko'rsatadi) */
create or replace view v_arxiv_oquvchilar
with (security_invoker = on) as
select s.id as student_id, s.fish, s.arxiv_sana, s.arxiv_sabab,
       coalesce(b.qarz, 0) as qarz,
       (select string_agg(g.nom, ' + ' order by e.tugadi desc)
          from enrollments e join groups g on g.id = e.group_id
         where e.student_id = s.id) as guruhlar
from students s
left join v_student_balance b on b.student_id = s.id
where s.holat = 'ketgan';


-- ------------------------------------------------------------
-- 4. To'lov holati — oyma-oy
-- ------------------------------------------------------------

/* Har yozilish × oy: to'lashi kerak, shu oy uchun to'langan va holat.
   "Oldindan" — kelajak oylar uchun qilingan to'lovlar. security invoker:
   pulni faqat xodim (va o'quvchi o'zinikini) ko'radi. */
create or replace function yozilish_oylari(p_student text)
returns table (
  enrollment_id uuid, davr text, narx numeric, chegirma numeric, tuzatish numeric,
  kerak numeric, tolangan numeric, holat text
)
language sql stable security invoker set search_path = public as $$
  with oylar as (
    select i.enrollment_id, i.davr, i.summa + i.chegirma + i.tuzatish as narx,
           i.chegirma, i.tuzatish, i.summa as kerak
    from invoices i join enrollments e on e.id = i.enrollment_id
    where e.student_id = p_student and i.holat <> 'bekor'
    union all
    -- hisob-fakturasi hali yo'q oy uchun to'lov (oldindan to'lov)
    select p.enrollment_id, p.davr, 0, 0, 0, 0
    from payments p
    where p.student_id = p_student and not p.bekor and p.enrollment_id is not null
      and not exists (select 1 from invoices i where i.enrollment_id = p.enrollment_id and i.davr = p.davr)
    group by p.enrollment_id, p.davr
  )
  select o.enrollment_id, o.davr, o.narx, o.chegirma, o.tuzatish, o.kerak,
         coalesce(t.summa, 0),
         case
           when o.kerak = 0 and o.narx > 0 and coalesce(t.summa, 0) = 0 then 'Bepul'
           when o.kerak = 0 and coalesce(t.summa, 0) = 0 then 'Hisob yo''q'
           when o.kerak = 0                                then 'Oldindan'
           when coalesce(t.summa, 0) = 0                    then 'To''lanmagan'
           when t.summa < o.kerak                           then 'Qisman'
           when t.summa = o.kerak                           then 'To''liq'
           else                                                  'Ortiqcha'
         end
  from oylar o
  left join lateral (
    select sum(p.summa) as summa from payments p
    where p.enrollment_id = o.enrollment_id and p.davr = o.davr and not p.bekor
  ) t on true
  order by o.enrollment_id, o.davr desc
$$;

revoke execute on function yozilish_oylari(text) from public, anon;
grant  execute on function yozilish_oylari(text) to authenticated, service_role;

/* Keyingi oy qancha to'laydi: narx (guruhning joriy narxi) − o'sha oy
   chegirmasi − o'sha oyga yozilgan tuzatish; VIP — 0. */
create or replace function keyingi_oy_summasi(p_enrollment uuid, p_davr text default null)
returns numeric
language sql stable security invoker set search_path = public as $$
  with e as (
    select e.*, g.oylik_narx,
           coalesce(p_davr, to_char((date_trunc('month', bugun_toshkent()) + interval '1 month')::date, 'YYYY-MM')) as davr
    from enrollments e join groups g on g.id = e.group_id
    where e.id = p_enrollment and e.holat <> 'tugagan'
  )
  select case
           when vip_oymi(e.id, e.davr) then 0
           else greatest(
             e.oylik_narx
             - least(chegirma_oyda(oy_raqami(e.boshlandi, e.davr), e.chegirma_summa, e.chegirma_oy,
                                   e.chegirma2_summa, e.chegirma2_oy), e.oylik_narx)
             - tuzatish_jami(e.id, e.davr), 0)
         end
  from e
$$;

revoke execute on function keyingi_oy_summasi(uuid, text) from public, anon;
grant  execute on function keyingi_oy_summasi(uuid, text) to authenticated, service_role;

/* O'quvchining barcha faol yozilishlari uchun keyingi oy — bitta so'rovda */
create or replace function keyingi_oylar(p_student text)
returns table (enrollment_id uuid, summa numeric)
language sql stable security invoker set search_path = public as $$
  select e.id, keyingi_oy_summasi(e.id)
  from enrollments e
  where e.student_id = p_student and e.holat <> 'tugagan'
$$;

revoke execute on function keyingi_oylar(text) from public, anon;
grant  execute on function keyingi_oylar(text) to authenticated, service_role;
