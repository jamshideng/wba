-- ============================================================
--  0124 — Fan bo'yicha arxiv (Jamshid, 14.11)
-- ============================================================
--  Avval arxiv faqat butun o'quvchiga edi: 3 fan o'qigan bola bittasidan
--  ketsa, hammasi yopilardi. Endi har fan (yozilish) alohida arxivlanadi:
--    1) enrollments.ketish_sababi / ketish_izoh — sabab shu fanga yoziladi.
--    2) fan_arxivla: bitta fan yopiladi, qolganlari faol qoladi.
--       OXIRGI faol fan bo'lsa — o'quvchining o'zi ham shu sabab bilan arxivga.
--    3) v_arxiv_fanlar: o'quvchi faol, lekin shu fanni endi o'qimaydi.
--       Eski "Guruhdan chiqarish" yozuvlari ham chiqadi (sababi belgilanmagan).
--       Shu fanga qayta yozilsa yoki guruh almashtirilgan bo'lsa — chiqmaydi.
--    4) oquvchi_arxivla: butun o'quvchi arxivlanganda sabab fanlariga ham.
--  guruhdan_chiqar (sababsiz, xato kiritilganda) o'zgarmaydi.
-- ============================================================

alter table enrollments add column if not exists ketish_sababi text;
alter table enrollments add column if not exists ketish_izoh text;

comment on column enrollments.ketish_sababi is
  'Shu fandan ketish sababi (0124) — royxatlar.ketish_sabab kaliti. Null — belgilanmagan.';
comment on column enrollments.ketish_izoh is 'Fandan ketish izohi (0124).';

drop trigger if exists royxat_fan_ketish on enrollments;
create trigger royxat_fan_ketish before insert or update on enrollments
  for each row execute function royxat_qiymati_tekshir('ketish_sabab', 'ketish_sababi');


/* Butun o'quvchi arxivga — sabab yopilayotgan fanlariga ham yoziladi */
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
    update enrollments
       set tugadi = greatest(v_sana, boshlandi), holat = 'tugagan',
           ketish_sababi = nullif(p_turi, ''), ketish_izoh = nullif(trim(p_sabab), '')
     where id = v_e.id;
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


/*
 * Bitta fanni arxivga. Qaytaradi: 'fan' — faqat shu fan yopildi;
 * 'oquvchi' — bu oxirgi faol fan edi, o'quvchi ham arxivga o'tdi.
 */
create or replace function fan_arxivla(p_enrollment uuid, p_sana date default null, p_turi text default null, p_izoh text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_sana date := coalesce(p_sana, bugun_toshkent());
  e      enrollments%rowtype;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Arxivga o''tkazish huquqingiz yo''q.';
  end if;
  if coalesce(p_turi, '') = '' then
    raise exception 'Ketish sababini tanlang.';
  end if;
  if p_turi = 'boshqa' and length(trim(coalesce(p_izoh, ''))) = 0 then
    raise exception '"Boshqa" tanlansa, sababini yozing.';
  end if;

  select * into e from enrollments where id = p_enrollment and holat <> 'tugagan' for update;
  if not found then
    raise exception 'Yozilish topilmadi yoki allaqachon yopilgan.';
  end if;

  update enrollments
     set tugadi = greatest(v_sana, boshlandi), holat = 'tugagan',
         ketish_sababi = p_turi, ketish_izoh = nullif(trim(p_izoh), '')
   where id = p_enrollment;
  delete from invoices where enrollment_id = p_enrollment and davr > to_char(v_sana, 'YYYY-MM');

  if not exists (select 1 from enrollments where student_id = e.student_id and holat <> 'tugagan')
     and exists (select 1 from students where id = e.student_id and holat <> 'ketgan') then
    update students
       set holat = 'ketgan', arxiv_sana = greatest(v_sana, e.boshlandi),
           arxiv_sabab = nullif(trim(p_izoh), ''), ketish_sababi = p_turi
     where id = e.student_id;
    return 'oquvchi';
  end if;
  return 'fan';
end;
$$;
revoke execute on function fan_arxivla(uuid, date, text, text) from public, anon;
grant  execute on function fan_arxivla(uuid, date, text, text) to authenticated, service_role;


/* Yopilgan fanga sabab qo'yish / o'zgartirish */
create or replace function fan_ketish_sababi_belgila(p_enrollment uuid, p_turi text, p_izoh text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Sababni o''zgartirish huquqingiz yo''q.';
  end if;
  if coalesce(p_turi, '') = '' then
    raise exception 'Sababni tanlang.';
  end if;
  if p_turi = 'boshqa' and length(trim(coalesce(p_izoh, ''))) = 0
     and not exists (select 1 from enrollments where id = p_enrollment and coalesce(ketish_izoh, '') <> '') then
    raise exception '"Boshqa" tanlansa, sababini yozing.';
  end if;

  update enrollments
     set ketish_sababi = p_turi,
         ketish_izoh = coalesce(nullif(trim(p_izoh), ''), ketish_izoh)
   where id = p_enrollment and holat = 'tugagan';
  if not found then
    raise exception 'Fan arxivda emas.';
  end if;
end;
$$;
revoke execute on function fan_ketish_sababi_belgila(uuid, text, text) from public, anon;
grant  execute on function fan_ketish_sababi_belgila(uuid, text, text) to authenticated, service_role;


/*
 * Arxivdagi fanlar: o'quvchi o'zi arxivda EMAS, lekin shu fanni endi
 * o'qimaydi. Har (o'quvchi, fan) uchun eng oxirgi yopilgan yozilish;
 * shu fanda faol yozilishi bo'lsa (qaytgan / guruh almashgan) — chiqmaydi.
 */
create or replace view v_arxiv_fanlar
with (security_invoker = on) as
select e.id as enrollment_id, e.student_id, s.fish,
       e.group_id, g.nom as guruh, g.subject_id, f.nom as fan, g.teacher_id, t.ism as ustoz,
       e.boshlandi, e.tugadi, e.ketish_sababi, e.ketish_izoh,
       coalesce(b.qarz, 0) as qarz
from enrollments e
join students s on s.id = e.student_id
join groups g on g.id = e.group_id
left join subjects f on f.id = g.subject_id
left join teachers t on t.id = g.teacher_id
left join v_enrollment_balance b on b.enrollment_id = e.id
where e.holat = 'tugagan'
  and s.holat <> 'ketgan'
  and not exists (
    select 1
    from enrollments e2
    join groups g2 on g2.id = e2.group_id
    where e2.student_id = e.student_id
      and e2.id <> e.id
      and g2.subject_id is not distinct from g.subject_id
      and (e2.holat <> 'tugagan'
           or (coalesce(e2.tugadi, e2.boshlandi), e2.boshlandi, e2.id)
            > (coalesce(e.tugadi, e.boshlandi), e.boshlandi, e.id))
  );

grant select on v_arxiv_fanlar to authenticated, service_role;


/*
 * Ketish tahlili (0083 dan) + fandan ketishlar (0124).
 *   jami / koeffitsient — avvalgidek, faqat BUTUNLAY ketgan o'quvchilar.
 *   fan_jami — davrda bitta fanidan ketib, o'zi faol qolganlar (v_arxiv_fanlar).
 *   sabablar, ustozlar, fanlar, yo'qotilgan daromad — ikkalasi birga.
 *   royxat: 'fan' bo'sh — butunlay ketgan; to'la — shu fandan ketgan.
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
  fanket as (   -- bitta fandan ketgan, o'zi faol
    select a.enrollment_id as eid, a.student_id, a.fish, a.tugadi as sana, a.fan,
           coalesce(a.ketish_sababi, 'belgilanmagan') as sabab, a.ketish_izoh as izoh
    from v_arxiv_fanlar a
    where a.tugadi between p_dan and p_gacha
  ),
  yop as (   -- butunlay ketganlarning arxiv kunidagi fanlari + fandan ketishlar
    select k.id as student_id, e.id as eid
    from ket k
    join enrollments e on e.student_id = k.id and e.tugadi between k.arxiv_sana - 1 and k.arxiv_sana
    union
    select f.student_id, f.eid from fanket f
  ),
  yopg as (
    select y.student_id, g.teacher_id, g.subject_id,
           (select i.summa from invoices i where i.enrollment_id = y.eid and i.holat <> 'bekor'
             order by i.davr desc limit 1) as oylik
    from yop y
    join enrollments e on e.id = y.eid
    join groups g on g.id = e.group_id
  ),
  sab as (
    select sabab from ket
    union all
    select sabab from fanket
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
    'fan_jami', (select count(*) from fanket),
    'boshida', (select n from bosh),
    'yangi', (select n from yangi),
    'koeffitsient', round(100.0 * (select count(*) from ket) / nullif((select n from bosh) + (select n from yangi), 0), 1),
    'yoqotilgan', coalesce((select sum(oylik) from yopg), 0),
    'orta_oy', round((select avg((k.arxiv_sana - k.qoshilgan_sana) / 30.4) from ket k where k.qoshilgan_sana is not null), 1),
    'sabablar', coalesce((select jsonb_agg(jsonb_build_object('sabab', sabab, 'soni', n) order by n desc)
                          from (select sabab, count(*) n from sab group by sabab) x), '[]'::jsonb),
    'ustozlar', coalesce((select jsonb_agg(jsonb_build_object('ism', coalesce(t.ism, '—'), 'soni', n) order by n desc)
                          from (select teacher_id, count(distinct student_id) n from yopg group by teacher_id) x
                          left join teachers t on t.id = x.teacher_id), '[]'::jsonb),
    'fanlar', coalesce((select jsonb_agg(jsonb_build_object('nom', coalesce(f.nom, '—'), 'soni', n) order by n desc)
                        from (select subject_id, count(distinct student_id) n from yopg group by subject_id) x
                        left join subjects f on f.id = x.subject_id), '[]'::jsonb),
    'royxat', coalesce((select jsonb_agg(r order by r ->> 'sana' desc)
                        from (
                          select jsonb_build_object('id', k.id, 'fish', k.fish, 'sana', k.arxiv_sana,
                                                    'sabab', k.sabab, 'izoh', k.arxiv_sabab, 'fan', null) as r
                          from ket k
                          union all
                          select jsonb_build_object('id', f.student_id, 'fish', f.fish, 'sana', f.sana,
                                                    'sabab', f.sabab, 'izoh', f.izoh, 'fan', f.fan)
                          from fanket f
                        ) z), '[]'::jsonb)
  ) into v_r;
  return v_r;
end;
$$;
revoke execute on function ketish_tahlili(date, date) from public, anon;
grant execute on function ketish_tahlili(date, date) to authenticated, service_role;


/*
 * Qayta o'qish (0124, Jamshid 14.11).
 * Bola SHU FANdan ketgan oyining o'zida qaytsa, eski yozuvda o'sha oy
 * hisobi (tuzatish bilan, masalan 2 dars) qoladi; yangi yozuvda o'sha oy
 * uchun qancha to'lashini admin QO'LDA kiritadi (masalan qolgan 4 dars).
 * Yangi yozuvning shu oyi o'sha summaga tuzatish bilan tushiriladi —
 * oy ikki marta to'liq hisoblanmaydi. Keyingi oylar odatdagidek.
 * Kamaytirish = tuzatish, shuning uchun faqat admin/direktor.
 */
create or replace function qayta_shu_oy_tuzat(p_yangi uuid, p_summa numeric, p_izoh text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  e      enrollments%rowtype;
  v_fan  text;
  v_eski date;
  v_davr text;
  v_inv  numeric;
begin
  select * into e from enrollments where id = p_yangi;
  select subject_id into v_fan from groups where id = e.group_id;
  select max(x.tugadi) into v_eski
    from enrollments x join groups g on g.id = x.group_id
   where x.student_id = e.student_id and x.id <> e.id and x.holat = 'tugagan'
     and g.subject_id is not distinct from v_fan;
  v_davr := to_char(e.boshlandi, 'YYYY-MM');
  if v_eski is null or to_char(v_eski, 'YYYY-MM') <> v_davr then
    return;   -- ketgan oyida emas — odatdagi to'liq hisob
  end if;
  if p_summa is null then
    raise exception 'Bu fandan % da ketgan va shu oyda qaytyapti — shu oy uchun to''laydigan summani kiriting.', to_char(v_eski, 'DD.MM.YYYY');
  end if;

  select summa into v_inv from invoices where enrollment_id = p_yangi and davr = v_davr and holat <> 'bekor';
  if v_inv is null then
    return;
  end if;
  if p_summa < 0 or p_summa > v_inv then
    raise exception 'Shu oy summasi 0 dan % gacha bo''lsin.', trim(to_char(v_inv, '999 999 999'));
  end if;
  if p_summa = v_inv then
    return;
  end if;
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Shu oy summasini kamaytirish (tuzatish) faqat admin yoki direktorda.';
  end if;

  insert into tuzatishlar (enrollment_id, davr, summa, sabab, kiritdi)
  values (p_yangi, v_davr, v_inv - p_summa,
          'Qayta o''qish: ketgan oyida qaytdi, shu oy uchun ' || trim(to_char(p_summa, '999 999 999')) || ' so''m'
            || coalesce(' · ' || nullif(trim(p_izoh), ''), ''),
          auth.uid());
  perform tuzatish_hisobla(p_yangi, v_davr);
end;
$$;
revoke execute on function qayta_shu_oy_tuzat(uuid, numeric, text) from public, anon, authenticated;
grant  execute on function qayta_shu_oy_tuzat(uuid, numeric, text) to service_role;


/* Arxivdagi fanni qayta o'qish: shu fanning faol guruhiga, tanlangan kundan */
create or replace function fan_qayta(
  p_enrollment uuid,
  p_group      text,
  p_sana       date default null,
  p_chegirma   jsonb default '{}'::jsonb,
  p_shu_oy     numeric default null,
  p_izoh       text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sana date := coalesce(p_sana, bugun_toshkent());
  e      enrollments%rowtype;
  v_fan  text;
  v_id   uuid;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Qayta biriktirish huquqingiz yo''q.';
  end if;
  select * into e from enrollments where id = p_enrollment and holat = 'tugagan';
  if not found then
    raise exception 'Arxivdagi fan topilmadi.';
  end if;
  select subject_id into v_fan from groups where id = e.group_id;
  if not exists (select 1 from groups where id = p_group and holat = 'faol' and subject_id is not distinct from v_fan) then
    raise exception 'Guruh topilmadi, yopilgan yoki boshqa fanga tegishli.';
  end if;
  if exists (select 1 from enrollments x join groups g on g.id = x.group_id
              where x.student_id = e.student_id and x.holat <> 'tugagan' and g.subject_id is not distinct from v_fan) then
    raise exception 'Bu fanni hozir o''qiyapti.';
  end if;
  if v_sana <= e.tugadi then
    raise exception 'Bu fandan % da chiqqan — qaytish kuni undan keyin bo''lsin.', to_char(e.tugadi, 'DD.MM.YYYY');
  end if;

  -- O'quvchi butunlay arxivda bo'lsa — faol bo'ladi
  update students set holat = 'faol', arxiv_sana = null, arxiv_sabab = null, ketish_sababi = null
   where id = e.student_id and holat = 'ketgan';

  v_id := guruhga_biriktir(e.student_id, p_group, v_sana, coalesce(p_chegirma, '{}'::jsonb));
  perform qayta_shu_oy_tuzat(v_id, p_shu_oy, p_izoh);
  return v_id;
end;
$$;
revoke execute on function fan_qayta(uuid, text, date, jsonb, numeric, text) from public, anon;
grant  execute on function fan_qayta(uuid, text, date, jsonb, numeric, text) to authenticated, service_role;


/* Arxivdan qaytarish ustasi (0120) + ketgan oyida qaytsa shu oy summasi */
drop function if exists oquvchi_qaytar(text, text, date, jsonb);
create or replace function oquvchi_qaytar(
  p_student  text,
  p_group    text default null,
  p_sana     date default null,
  p_chegirma jsonb default '{}'::jsonb,
  p_shu_oy   numeric default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sana date := coalesce(p_sana, bugun_toshkent());
  v_oxir date;
  v_id   uuid;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Arxivdan qaytarish huquqingiz yo''q.';
  end if;
  if not exists (select 1 from students where id = p_student and holat = 'ketgan') then
    raise exception 'O''quvchi arxivda emas.';
  end if;

  if p_group is not null then
    if not exists (select 1 from groups where id = p_group and holat = 'faol') then
      raise exception 'Guruh topilmadi yoki yopilgan.';
    end if;
    select max(tugadi) into v_oxir from enrollments where student_id = p_student and group_id = p_group;
    if v_oxir is not null and v_sana <= v_oxir then
      raise exception 'Bu guruhdan % da chiqqan — qaytish kuni undan keyin bo''lsin.', to_char(v_oxir, 'DD.MM.YYYY');
    end if;
  end if;

  update students set holat = 'faol', arxiv_sana = null, arxiv_sabab = null, ketish_sababi = null
   where id = p_student;

  if p_group is not null then
    v_id := guruhga_biriktir(p_student, p_group, v_sana, coalesce(p_chegirma, '{}'::jsonb));
    perform qayta_shu_oy_tuzat(v_id, p_shu_oy, null);
  end if;
  return v_id;
end;
$$;
revoke execute on function oquvchi_qaytar(text, text, date, jsonb, numeric) from public, anon;
grant  execute on function oquvchi_qaytar(text, text, date, jsonb, numeric) to authenticated, service_role;
