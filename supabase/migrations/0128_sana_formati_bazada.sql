-- ============================================================
-- 0128 — Bazadagi xabar/xato matnlarida sana kun/oy/yil: DD.MM(.YYYY) -> DD/MM/YYYY (Jamshid, 16.11.2026)
--   Funksiyalar prod'dagi joriy ko'rinishidan (pg_get_functiondef) olingan; faqat to_char formati o'zgardi.
-- ============================================================

-- dars_kochir(text,date,date,text)
CREATE OR REPLACE FUNCTION public.dars_kochir(p_group text, p_eski date, p_yangi date, p_sabab text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_g     groups%rowtype;
  v_eski  lessons%rowtype;
  v_id    uuid;
  v_bugun date := bugun_toshkent();
begin
  select * into v_g from groups where id = p_group;
  if not found then
    raise exception 'Guruh topilmadi.';
  end if;
  if auth.uid() is not null and not app_is_admin() then
    if v_g.teacher_id is distinct from app_teacher_id() then
      raise exception 'Darsni faqat guruh ustozi yoki admin ko''chiradi.';
    end if;
    if p_eski < v_bugun or (p_yangi is not null and p_yangi < v_bugun) then
      raise exception 'O''tgan kunlarni faqat admin o''zgartiradi.';
    end if;
  end if;
  if maosh_oy_qulfmi(to_char(p_eski, 'YYYY-MM'))
     or (p_yangi is not null and maosh_oy_qulfmi(to_char(p_yangi, 'YYYY-MM'))) then
    raise exception 'Bu oy maoshi tasdiqlangan — darsni ko''chirib bo''lmaydi.';
  end if;

  select * into v_eski from lessons where group_id = p_group and sana = p_eski;

  -- Bekor qilish
  if p_yangi is null then
    if v_eski.kochirildi_ga is null then
      return null;
    end if;
    if exists (select 1 from lessons where group_id = p_group and sana = v_eski.kochirildi_ga and otkazildi) then
      raise exception 'Yangi kundagi dars allaqachon o''tilgan — bekor qilib bo''lmaydi.';
    end if;
    delete from lessons where group_id = p_group and sana = v_eski.kochirildi_ga and kochirilgan_dan = p_eski;
    update lessons set kochirildi_ga = null, kochirish_sabab = null where id = v_eski.id;
    -- Bo'sh qolgan eski yozuv (davomati yo'q) — tozalanadi
    delete from lessons l where l.id = v_eski.id and not l.otkazildi and l.zamena_teacher_id is null
      and l.mavzu is null and not exists (select 1 from attendance a where a.lesson_id = l.id);
    return null;
  end if;

  -- Eski kun: jadval kuni (dam kuni bo'lsa ham) yoki ochilgan dars; hali o'tilmagan
  if v_eski.id is null and not (extract(isodow from p_eski)::smallint = any (guruh_kunlari(v_g.id, p_eski))) then
    raise exception 'Eski sana guruhning dars kuni emas.';
  end if;
  if v_eski.otkazildi then
    raise exception 'Bu dars allaqachon o''tilgan — ko''chirib bo''lmaydi.';
  end if;
  if v_eski.kochirildi_ga is not null then
    raise exception 'Bu dars allaqachon %ga ko''chirilgan.', to_char(v_eski.kochirildi_ga, 'DD/MM/YYYY');
  end if;
  if v_eski.kochirilgan_dan is not null then
    raise exception 'Bu dars o''zi ko''chirib kelingan — avval uni bekor qiling.';
  end if;

  -- Yangi kun: guruhda o'sha kuni dars bo'lmasin, dam kuni bo'lmasin
  if p_yangi = p_eski then
    raise exception 'Yangi sana boshqa kun bo''lsin.';
  end if;
  if guruh_dars_kuni(p_group, p_yangi) or exists (select 1 from lessons where group_id = p_group and sana = p_yangi) then
    raise exception 'Bu kuni guruhda allaqachon dars bor.';
  end if;
  if exists (select 1 from dam_kunlar where sana = p_yangi) then
    raise exception 'Yangi sana dam olish kuni.';
  end if;

  if v_eski.id is null then
    insert into lessons (group_id, sana, kochirildi_ga, kochirish_sabab)
    values (p_group, p_eski, p_yangi, nullif(trim(p_sabab), ''));
  else
    -- Zamena yangi kunga o'tadi (pastda), eski kunda qolmasin
    update lessons set kochirildi_ga = p_yangi, kochirish_sabab = nullif(trim(p_sabab), ''),
                       zamena_teacher_id = null, zamena_sabab = null
    where id = v_eski.id;
  end if;

  insert into lessons (group_id, sana, kochirilgan_dan, kochirish_sabab, zamena_teacher_id, zamena_sabab)
  values (p_group, p_yangi, p_eski, nullif(trim(p_sabab), ''), v_eski.zamena_teacher_id, v_eski.zamena_sabab)
  returning id into v_id;
  return v_id;
end;
$function$;

-- ertangi_maslahat(date)
CREATE OR REPLACE FUNCTION public.ertangi_maslahat(p_kun date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with e as (select p_kun + 1 as k)
  select jsonb_build_object(
    'ertaga', (select k from e),
    'vazifalar', coalesce((
      select jsonb_agg(jsonb_build_object('nom', v.nom,
               'vaqt', to_char(v.muddat at time zone 'Asia/Tashkent', 'DD/MM/YYYY HH24:MI'),
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
$function$;

-- fan_qayta(uuid,text,date,jsonb,numeric,text)
CREATE OR REPLACE FUNCTION public.fan_qayta(p_enrollment uuid, p_group text, p_sana date DEFAULT NULL::date, p_chegirma jsonb DEFAULT '{}'::jsonb, p_shu_oy numeric DEFAULT NULL::numeric, p_izoh text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    raise exception 'Bu fandan % da chiqqan — qaytish kuni undan keyin bo''lsin.', to_char(e.tugadi, 'DD/MM/YYYY');
  end if;

  -- O'quvchi butunlay arxivda bo'lsa — faol bo'ladi
  update students set holat = 'faol', arxiv_sana = null, arxiv_sabab = null, ketish_sababi = null
   where id = e.student_id and holat = 'ketgan';

  v_id := guruhga_biriktir(e.student_id, p_group, v_sana, coalesce(p_chegirma, '{}'::jsonb));
  perform qayta_shu_oy_tuzat(v_id, p_shu_oy, p_izoh);
  return v_id;
end;
$function$;

-- guruh_almashtir(uuid,text,date)
CREATE OR REPLACE FUNCTION public.guruh_almashtir(p_enrollment uuid, p_group text, p_sana date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e        enrollments%rowtype;
  v_yangi  uuid;
  v_davr   text := to_char(p_sana, 'YYYY-MM');
  v_k      int;        -- yangi guruhgacha o'tgan oylar (chegirma uchun)
  v_d1     int;
  v_d2     int;
  v_n1     int;
  v_n2     int;
  v_kunlar smallint[];
  v_tolov  int;
  v_davomat int := 0;
  v_qoldi  int := 0;
  v_woblar int;
  r        record;
  v_dars   uuid;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Guruhni almashtirish huquqingiz yo''q.';
  end if;

  select * into e from enrollments where id = p_enrollment for update;
  if not found or e.holat = 'tugagan' then
    raise exception 'Yozilish topilmadi yoki allaqachon yopilgan.';
  end if;
  if e.group_id = p_group then
    raise exception 'Bola allaqachon shu guruhda.';
  end if;
  if not exists (select 1 from groups where id = p_group and holat = 'faol') then
    raise exception 'Yangi guruh topilmadi yoki yopilgan.';
  end if;
  if p_sana is null or p_sana <= e.boshlandi then
    raise exception 'O''tish sanasi guruhga qo''shilgan kundan (%) keyin bo''lsin.', to_char(e.boshlandi, 'DD/MM/YYYY');
  end if;
  if p_sana > bugun_toshkent() then
    raise exception 'Kelasi sanaga o''tkazib bo''lmaydi — o''sha kuni almashtiring.';
  end if;
  if exists (
    select 1 from enrollments
    where student_id = e.student_id and group_id = p_group and holat <> 'tugagan'
  ) then
    raise exception 'Bu o''quvchi yangi guruhda allaqachon o''qiyapti.';
  end if;

  -- Chegirma: asl boshlanishdan v_k oy o'tgan — qolgan muddat yangi yozilishga
  v_k  := oy_raqami(e.boshlandi, v_davr) - 1;
  v_d1 := case when e.chegirma_summa > 0 then coalesce(e.chegirma_oy, 999999) else 0 end;
  v_d2 := case when e.chegirma2_summa > 0 then coalesce(e.chegirma2_oy, 999999) else 0 end;
  v_n1 := greatest(v_d1 - v_k, 0);
  v_n2 := greatest(v_d2 - greatest(v_k - v_d1, 0), 0);

  -- 1) Eski yozilish yopiladi (Sheets ID bo'shaydi — yangisiga o'tadi)
  update enrollments
     set tugadi = p_sana - 1,
         holat = 'tugagan',
         sheets_id = case when sheets_id is null then null
                          else sheets_id || '~' || to_char(boshlandi, 'YYYY-MM-DD') end
   where id = e.id;

  -- 2) Yangi yozilish (hisoblarsiz — avval to'lov va tuzatishlar ko'chadi)
  insert into enrollments (
    student_id, group_id, boshlandi, sheets_id,
    chegirma_summa, chegirma_oy, chegirma2_summa, chegirma2_oy, chegirma_sabab,
    vip, vip_dan
  ) values (
    e.student_id, p_group, p_sana, e.sheets_id,
    case when v_n1 > 0 then e.chegirma_summa else 0 end,
    case when v_n1 > 0 and e.chegirma_oy is not null then v_n1 else (case when v_n1 > 0 then null else 0 end) end,
    case when v_n2 > 0 then e.chegirma2_summa else 0 end,
    case when v_n2 > 0 and e.chegirma2_oy is not null then v_n2 else (case when v_n2 > 0 then null else 0 end) end,
    e.chegirma_sabab,
    e.vip,
    case when e.vip_dan is not null and e.vip_dan > v_davr then e.vip_dan end
  )
  returning id into v_yangi;

  -- 3) O'tish oyi va keyingilari — yangi guruhniki
  delete from invoices where enrollment_id = e.id and davr >= v_davr;
  update tuzatishlar set enrollment_id = v_yangi where enrollment_id = e.id and davr >= v_davr;
  update payments set enrollment_id = v_yangi where enrollment_id = e.id and davr >= v_davr;
  get diagnostics v_tolov = row_count;

  perform yozilish_hisoblari(v_yangi);
  perform yozilish_qayta_hisobla(v_yangi);

  -- 4) Sanadan keyin eski guruhda qo'yilgan davomat — yangi guruhning o'sha kunidagi darsiga
  select kunlar into v_kunlar from groups where id = p_group;
  for r in
    select a.id, a.lesson_id, a.holat, a.belgiladi, l.sana
    from attendance a join lessons l on l.id = a.lesson_id
    where a.student_id = e.student_id and l.group_id = e.group_id and l.sana >= p_sana
  loop
    select id into v_dars from lessons where group_id = p_group and sana = r.sana;
    if v_dars is null and guruh_dars_kunimi(guruh_kunlari(p_group, r.sana), r.sana) then
      insert into lessons (group_id, sana, otkazildi) values (p_group, r.sana, true)
      on conflict (group_id, sana) do update set otkazildi = true
      returning id into v_dars;
    end if;
    if v_dars is null then
      v_qoldi := v_qoldi + 1;
      continue;
    end if;
    insert into attendance (lesson_id, student_id, holat, belgiladi)
    values (v_dars, e.student_id, r.holat, r.belgiladi)
    on conflict (lesson_id, student_id) do nothing;
    delete from attendance where id = r.id;
    v_davomat := v_davomat + 1;
  end loop;

  -- 5) Woblar — qaysi guruh hisobidan (ustoz limiti) — sanadan keyingilari yangi guruhga
  update woblr set group_id = p_group
   where student_id = e.student_id and group_id = e.group_id
     and (created_at at time zone 'Asia/Tashkent')::date >= p_sana;
  get diagnostics v_woblar = row_count;

  return jsonb_build_object(
    'eski', e.id, 'yangi', v_yangi,
    'tolovlar', v_tolov, 'davomat', v_davomat, 'davomat_qoldi', v_qoldi, 'woblar', v_woblar
  );
end;
$function$;

-- guruh_jadval_ozgartir(text,smallint[],date)
CREATE OR REPLACE FUNCTION public.guruh_jadval_ozgartir(p_group text, p_kunlar smallint[], p_dan date)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kunlar smallint[];
  v_bosh date[];
begin
  if not app_is_admin() then
    raise exception 'Dars kunlarini faqat admin o''zgartiradi.';
  end if;
  if not exists (select 1 from groups where id = p_group) then
    raise exception 'Guruh topilmadi.';
  end if;
  v_kunlar := array(select distinct x from unnest(p_kunlar) x order by x);
  if cardinality(v_kunlar) = 0 then
    raise exception 'Dars kunlarini tanlang — kamida bitta kun.';
  end if;
  if p_dan is null then
    raise exception 'Yangi jadval qaysi sanadan boshlanishini tanlang.';
  end if;

  -- O'zgarish yo'q: shu sanadagi jadval bir xil va undan keyin rejalangan boshqasi yo'q
  if guruh_kunlari(p_group, p_dan) = v_kunlar
     and not exists (select 1 from guruh_jadvali where group_id = p_group and dan > p_dan) then
    return false;
  end if;

  v_bosh := guruh_belgilanmagan_kunlar(p_group, p_dan);
  if cardinality(v_bosh) > 0 then
    raise exception 'Dars kunlari o''zgarmadi: avval eski darslar davomatini belgilang (%).',
      (select string_agg(to_char(d, 'DD/MM/YYYY'), ', ' order by d) from unnest(v_bosh) d);
  end if;

  delete from guruh_jadvali where group_id = p_group and dan >= p_dan;
  insert into guruh_jadvali (group_id, dan, kunlar, yozdi) values (p_group, p_dan, v_kunlar, auth.uid());

  -- Yangi jadvalga tushmaydigan, hali o'tilmagan bo'sh darslar ustun bo'lib qolmasin
  delete from lessons l
  where l.group_id = p_group and l.sana >= p_dan and not l.otkazildi
    and l.kochirilgan_dan is null and l.kochirildi_ga is null and l.zamena_teacher_id is null
    and not guruh_dars_kunimi(v_kunlar, l.sana)
    and not exists (select 1 from attendance a where a.lesson_id = l.id);

  update groups set kunlar = guruh_kunlari(p_group, bugun_toshkent()) where id = p_group;
  return true;
end;
$function$;

-- kechikish_jarima_yoz(ustoz_kechikish)
CREATE OR REPLACE FUNCTION public.kechikish_jarima_yoz(k ustoz_kechikish)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if maosh_oy_qulfmi(to_char(k.sana, 'YYYY-MM')) then
    return;  -- tasdiqlangan oyga tegilmaydi
  end if;
  insert into maosh_harakatlar (teacher_id, davr, turi, summa, izoh, kechikish_id, kiritgan)
  values (k.teacher_id, to_char(k.sana, 'YYYY-MM'), 'jarima', k.daqiqa * kechikish_jarima_stavka(),
          format('Kechikish: %s, %s daqiqa × %s%s', to_char(k.sana, 'DD/MM/YYYY'), k.daqiqa,
                 kechikish_jarima_stavka()::bigint,
                 coalesce(' · ' || (select g.nom from groups g where g.id = k.group_id), '')),
          k.id, k.kiritdi)
  on conflict do nothing;
end;
$function$;

-- lead_avto_vazifa()
CREATE OR REPLACE FUNCTION public.lead_avto_vazifa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Yopilgan lid (o'quvchi bo'ldi yoki rad/kelmadi) — ochiq avto-vazifa bekor
  if new.student_id is not null or new.holat in ('yozildi', 'rad', 'kelmadi', 'xato') or new.keyingi_aloqa is null then
    update crm_vazifalar set holat = 'bekor'
     where lead_id = new.id and avto and holat in ('yangi', 'jarayonda');
    return new;
  end if;

  if tg_op = 'INSERT' or new.keyingi_aloqa is distinct from old.keyingi_aloqa then
    insert into crm_vazifalar (nom, turi, muddat, lead_id, izoh, avto, yaratdi)
    values (
      'Lid bilan bog''lanish: ' || new.ism,
      case when new.sinov_sana is not null then 'sinov_chaqirish'::vazifa_turi else 'qongiroq'::vazifa_turi end,
      new.keyingi_aloqa,
      new.id,
      'Avtomatik eslatma: ' || to_char(new.keyingi_aloqa at time zone 'Asia/Tashkent', 'DD/MM/YYYY HH24:MI') || ' da ' || new.ism || ' (' || new.telefon || ') bilan bog''laning.',
      true,
      auth.uid()
    )
    on conflict (lead_id) where avto and holat in ('yangi', 'jarayonda')
    do update set muddat = excluded.muddat, nom = excluded.nom, izoh = excluded.izoh, turi = excluded.turi;
  end if;
  return new;
end $function$;

-- lessons_kochirilgan_qulf()
CREATE OR REPLACE FUNCTION public.lessons_kochirilgan_qulf()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.kochirildi_ga is not null and new.otkazildi then
    raise exception 'Bu dars %ga ko''chirilgan — davomat o''sha kuni qilinadi.', to_char(new.kochirildi_ga, 'DD/MM/YYYY');
  end if;
  return new;
end;
$function$;

-- lid_boglanildi(uuid,date,text)
CREATE OR REPLACE FUNCTION public.lid_boglanildi(p_lead uuid, p_keyingi date DEFAULT NULL::date, p_izoh text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if not app_is_staff() then
    raise exception 'Ruxsat yo''q.';
  end if;

  update leads
     set aloqa_soni   = aloqa_soni + 1,
         oxirgi_aloqa = now(),
         holat        = case when holat = 'yangi' then 'qongiroq'::lead_status else holat end,
         keyingi_aloqa = case when p_keyingi is null then null
                              else (p_keyingi + time '09:00') at time zone 'Asia/Tashkent' end,
         izoh = case when nullif(btrim(p_izoh), '') is null then izoh
                     else concat_ws(E'\n', izoh, to_char(now() at time zone 'Asia/Tashkent', 'DD/MM/YYYY HH24:MI') || ' — ' || btrim(p_izoh)) end
   where id = p_lead and student_id is null;

  if not found then
    raise exception 'Lid topilmadi yoki allaqachon o''quvchi.';
  end if;

  -- Joriy ochiq avto-vazifa bajarildi (yangi sana bo'lsa trigger yangisini ochadi)
  update crm_vazifalar set holat = 'bajarildi'
   where lead_id = p_lead and avto and holat in ('yangi', 'jarayonda')
     and (p_keyingi is null or muddat < (p_keyingi + time '09:00') at time zone 'Asia/Tashkent');
end $function$;

-- maosh_tasdiqla(text)
CREATE OR REPLACE FUNCTION public.maosh_tasdiqla(p_davr text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_r     record;
  v_oxir  date;
  v_soni  int := 0;
  v_xid   bigint;
  v_gross numeric;
begin
  if auth.uid() is not null and not app_is_direktor() then
    raise exception 'Maoshni faqat direktor tasdiqlaydi.';
  end if;
  if p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy YYYY-MM ko''rinishida bo''lsin.';
  end if;
  v_oxir := (to_date(p_davr || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;
  if v_oxir >= bugun_toshkent() then
    raise exception 'Oy hali tugamagan — maosh oy tugagach tasdiqlanadi.';
  end if;

  perform pg_advisory_xact_lock(hashtext('maosh-tasdiq:' || p_davr));
  if maosh_oy_qulfmi(p_davr) then
    raise exception 'Bu oy allaqachon tasdiqlangan.';
  end if;
  if exists (
    select 1 from lessons l
    where to_char(l.kochirilgan_dan, 'YYYY-MM') = p_davr and l.sana > v_oxir and not l.otkazildi
  ) then
    raise exception 'Bu oyning ko''chirilgan darsi hali o''tilmagan: % — o''tilgach tasdiqlang.', (
      select string_agg(g.nom || ' — ' || to_char(l.sana, 'DD/MM/YYYY'), '; ' order by l.sana)
      from lessons l join groups g on g.id = l.group_id
      where to_char(l.kochirilgan_dan, 'YYYY-MM') = p_davr and l.sana > v_oxir and not l.otkazildi);
  end if;
  if exists (select 1 from maosh_jonli(p_davr) u where u.aniqmas) then
    raise exception 'Ba''zi ustozlarga stavka belgilanmagan — avval stavkani kiriting.';
  end if;

  insert into maosh_oylar (davr) values (p_davr);

  for v_r in select * from maosh_jonli(p_davr) u where u.hisob <> 0 or u.yakuniy <> 0 or u.avans <> 0 loop
    v_xid := null;
    v_gross := v_r.yakuniy + v_r.avans;
    if false then  -- 0112: xarajat to'lov bilan yoziladi
      insert into xarajatlar (sana, toifa, summa, izoh)
      values (v_oxir, 'maosh', v_gross,
              format('Ustoz maoshi · %s · %s%s', p_davr, v_r.ism,
                     case when v_r.avans > 0 then format(' (avans %s oldin berilgan)', v_r.avans) else '' end))
      returning id into v_xid;
    end if;

    insert into maosh_tasdiq (davr, teacher_id, ism, stavka, oquvchilar, hisob, avans, bonus, jarima, tuzatish, yakuniy, tafsilot, xarajat_id, doimiy, doimiy_tafsilot)
    values (p_davr, v_r.teacher_id, v_r.ism, v_r.stavka, v_r.oquvchilar, v_r.hisob, v_r.avans, v_r.bonus,
            v_r.jarima, v_r.tuzatish, v_r.yakuniy,
            (select coalesce(jsonb_agg(jsonb_build_object(
               'group_id', x.group_id, 'guruh', x.guruh, 'student_id', x.student_id, 'fish', x.fish,
               'stavka', x.stavka, 'n', x.n, 'darslar', x.darslar, 'ayirildi', x.ayirildi,
               'hisob_darslar', x.hisob_darslar, 'summa', x.summa, 'zamena', x.zamena
             ) order by x.zamena, x.guruh, x.fish), '[]'::jsonb)
             from maosh_qatorlari(p_davr) x where x.teacher_id = v_r.teacher_id),
            v_xid, v_r.doimiy, v_r.doimiy_tafsilot);
    v_soni := v_soni + 1;
  end loop;

  for v_r in select * from xodim_maosh_jonli(p_davr) u where u.oylik is not null or u.yakuniy <> 0 or u.avans <> 0 loop
    v_xid := null;
    v_gross := v_r.yakuniy + v_r.avans;
    if false then  -- 0112: xarajat to'lov bilan yoziladi
      insert into xarajatlar (sana, toifa, summa, izoh)
      values (v_oxir, 'maosh', v_gross,
              format('Xodim maoshi · %s · %s%s', p_davr, v_r.ism,
                     case when v_r.avans > 0 then format(' (avans %s oldin berilgan)', v_r.avans) else '' end))
      returning id into v_xid;
    end if;
    insert into maosh_tasdiq_xodim (davr, profile_id, ism, oylik, avans, bonus, jarima, tuzatish, yakuniy, xarajat_id)
    values (p_davr, v_r.profile_id, v_r.ism, v_r.oylik, v_r.avans, v_r.bonus, v_r.jarima, v_r.tuzatish, v_r.yakuniy, v_xid);
    v_soni := v_soni + 1;
  end loop;

  return v_soni;
end;
$function$;

-- nazorat_yig()
CREATE OR REPLACE FUNCTION public.nazorat_yig()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bugun date := bugun_toshkent();
  v_soat  time := (now() at time zone 'Asia/Tashkent')::time;
  v_davr  text := to_char(bugun_toshkent(), 'YYYY-MM');
  v_oxir  date := (date_trunc('month', bugun_toshkent()) + interval '1 month' - interval '1 day')::date;
  v_soni  int := 0;
  v_n     int;
begin
  if auth.uid() is not null and not app_is_manager() then
    raise exception 'Nazoratni faqat tizim yoki manager yurgizadi.';
  end if;

  -- Ustoz kechikdi (oxirgi 3 kun)
  insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, tafsilot, kalit)
  select 'ustoz_kechikdi', k.sana, k.teacher_id, k.group_id,
         format('%s daqiqa kechikdi%s', k.daqiqa, coalesce(' · ' || k.sabab, '')),
         'kech:' || k.id
  from ustoz_kechikish k
  where k.sana >= v_bugun - 3
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- Kun oxiri (21:00 dan keyin): davomat qilinmadi, woblar berilmadi
  if v_soat >= time '21:00' then
    insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, tafsilot, kalit)
    select 'davomat_qilinmadi', v_bugun, dars_ustozi(g.id, v_bugun), g.id,
           format('%s — bugungi dars davomati qilinmadi', g.nom),
           'dav:' || g.id || ':' || v_bugun
    from groups g
    where g.holat = 'faol' and guruh_dars_kuni(g.id, v_bugun)
      and exists (select 1 from enrollments e where e.group_id = g.id and e.holat = 'faol' and e.boshlandi <= v_bugun)
      and not exists (select 1 from lessons l where l.group_id = g.id and l.sana = v_bugun and l.otkazildi)
      and dars_ustozi(g.id, v_bugun) is not null
    on conflict (kalit) do nothing;
    get diagnostics v_n = row_count; v_soni := v_soni + v_n;

    insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, tafsilot, kalit)
    select 'woblar_berilmadi', v_bugun, coalesce(l.zamena_teacher_id, g.teacher_id), g.id,
           format('%s — dars o''tdi, lekin birorta ham woblar berilmadi', g.nom),
           'wob:' || g.id || ':' || v_bugun
    from lessons l join groups g on g.id = l.group_id
    where l.sana = v_bugun and l.otkazildi
      and not exists (select 1 from woblr w where w.group_id = g.id
                        and (w.created_at at time zone 'Asia/Tashkent')::date = v_bugun)
      and not exists (select 1 from probniy_woblar w where w.group_id = g.id
                        and (w.created_at at time zone 'Asia/Tashkent')::date = v_bugun)
      and coalesce(l.zamena_teacher_id, g.teacher_id) is not null
    on conflict (kalit) do nothing;
    get diagnostics v_n = row_count; v_soni := v_soni + v_n;
  end if;

  -- O'quvchi ketma-ket 3 dars kelmadi (oxirgi 3 belgisi "kelmadi", oxirgisi 3 kun ichida)
  insert into nazorat_hodisalar (turi, sana, teacher_id, group_id, student_id, tafsilot, kalit)
  select 'oquvchi_3_kelmadi', x.oxirgi, g.teacher_id, g.id, x.student_id,
         format('%s — ketma-ket 3 dars kelmadi (%s guruhi). Bog''lanish kerak.', s.fish, g.nom),
         'kel3:' || x.group_id || ':' || x.student_id || ':' || x.oxirgi
  from (
    select l.group_id, a.student_id,
           max(l.sana) as oxirgi,
           bool_and(a.holat in ('kelmadi', 'sababli')) as hammasi_yoq,
           count(*) as n
    from (
      select a.*, row_number() over (partition by l.group_id, a.student_id order by l.sana desc) as rn
      from attendance a join lessons l on l.id = a.lesson_id
      where l.sana > v_bugun - 45
    ) a
    join lessons l on l.id = a.lesson_id
    where a.rn <= 3
    group by l.group_id, a.student_id
  ) x
  join groups g on g.id = x.group_id
  join students s on s.id = x.student_id
  join enrollments e on e.group_id = x.group_id and e.student_id = x.student_id and e.holat = 'faol'
  where x.n = 3 and x.hammasi_yoq and x.oxirgi >= v_bugun - 3
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- Lid qo'ng'irog'i va vazifa muddati o'tdi (1 soatdan ortiq)
  insert into nazorat_hodisalar (turi, sana, profile_id, lead_id, vazifa_id, tafsilot, kalit)
  select case when v.lead_id is not null then 'lid_qongiroq' else 'vazifa_muddati' end,
         (v.muddat at time zone 'Asia/Tashkent')::date, v.masul, v.lead_id, v.id,
         format('%s — muddati %s edi', v.nom, to_char(v.muddat at time zone 'Asia/Tashkent', 'DD/MM/YYYY HH24:MI')),
         'vaz:' || v.id
  from crm_vazifalar v
  where v.holat in ('yangi', 'jarayonda') and v.muddat < now() - interval '1 hour'
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- To'lov kech kiritildi (saytda, to'lov sanasidan 1 kundan ko'p keyin)
  insert into nazorat_hodisalar (turi, sana, profile_id, student_id, payment_id, tafsilot, kalit)
  select 'tolov_kech', (p.created_at at time zone 'Asia/Tashkent')::date, p.qabul_qildi, p.student_id, p.id,
         format('%s so''m · to''lov sanasi %s, kiritilgan %s', p.summa, to_char(p.sana, 'DD/MM/YYYY'),
                to_char(p.created_at at time zone 'Asia/Tashkent', 'DD/MM/YYYY HH24:MI')),
         'tolk:' || p.id
  from payments p
  where p.manba = 'crm' and not p.bekor
    and p.created_at > now() - interval '3 days'
    and (p.created_at at time zone 'Asia/Tashkent')::date - p.sana > 1
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- To'lov 2 kundan beri tasdiqlanmagan
  insert into nazorat_hodisalar (turi, sana, profile_id, student_id, payment_id, tafsilot, kalit)
  select 'tolov_tasdiqlanmadi', v_bugun, p.qabul_qildi, p.student_id, p.id,
         format('%s so''m · %s dan beri tasdiqlanmagan', p.summa, to_char(p.created_at at time zone 'Asia/Tashkent', 'DD/MM/YYYY')),
         'tast:' || p.id
  from payments p
  where p.manba = 'crm' and not p.bekor and not p.tasdiqlangan
    and p.created_at < now() - interval '2 days'
  on conflict (kalit) do nothing;
  get diagnostics v_n = row_count; v_soni := v_soni + v_n;

  -- Oy oxiri (oxirgi kun 20:00 dan keyin): qarzdorga oy ichida eslatma qilinmadi
  if v_bugun = v_oxir and v_soat >= time '20:00' then
    insert into nazorat_hodisalar (turi, sana, student_id, tafsilot, kalit)
    select 'qarzdor_eslatilmadi', v_bugun, b.student_id,
           format('%s — qarz %s so''m, oy davomida "To''lov eslatish" bajarilmadi', b.fish, b.qarz),
           'qarz:' || b.student_id || ':' || v_davr
    from v_student_balance b
    join students s on s.id = b.student_id and s.holat = 'faol'
    where b.qarz > 0
      and not exists (
        select 1 from crm_vazifalar v
        where v.student_id = b.student_id and v.turi = 'tolov_eslatish' and v.holat = 'bajarildi'
          and to_char(v.bajarildi_at at time zone 'Asia/Tashkent', 'YYYY-MM') = v_davr)
    on conflict (kalit) do nothing;
    get diagnostics v_n = row_count; v_soni := v_soni + v_n;
  end if;

  return v_soni;
end;
$function$;

-- oquvchi_qaytar(text,text,date,jsonb,numeric)
CREATE OR REPLACE FUNCTION public.oquvchi_qaytar(p_student text, p_group text DEFAULT NULL::text, p_sana date DEFAULT NULL::date, p_chegirma jsonb DEFAULT '{}'::jsonb, p_shu_oy numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      raise exception 'Bu guruhdan % da chiqqan — qaytish kuni undan keyin bo''lsin.', to_char(v_oxir, 'DD/MM/YYYY');
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
$function$;

-- qayta_shu_oy_tuzat(uuid,numeric,text)
CREATE OR REPLACE FUNCTION public.qayta_shu_oy_tuzat(p_yangi uuid, p_summa numeric, p_izoh text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    raise exception 'Bu fandan % da ketgan va shu oyda qaytyapti — shu oy uchun to''laydigan summani kiriting.', to_char(v_eski, 'DD/MM/YYYY');
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
$function$;

-- qoshilgan_sana_ozgartir(uuid,date)
CREATE OR REPLACE FUNCTION public.qoshilgan_sana_ozgartir(p_enrollment uuid, p_sana date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e         enrollments%rowtype;
  v_fan     text;
  v_davr    text := to_char(p_sana, 'YYYY-MM');
  v_olindi  int := 0;
  v_qoshildi int := 0;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Qo''shilgan sanani o''zgartirish huquqingiz yo''q.';
  end if;

  select * into e from enrollments where id = p_enrollment for update;
  if not found then
    raise exception 'Yozilish topilmadi.';
  end if;
  if p_sana is null then
    raise exception 'Sanani tanlang.';
  end if;
  if p_sana = e.boshlandi then
    return jsonb_build_object('olindi', 0, 'qoshildi', 0);
  end if;
  if p_sana > bugun_toshkent() then
    raise exception 'Kelasi sanani qo''yib bo''lmaydi.';
  end if;
  if e.tugadi is not null and p_sana > e.tugadi then
    raise exception 'Sana guruhdan chiqqan kundan (%) keyin bo''lmasin.', to_char(e.tugadi, 'DD/MM/YYYY');
  end if;

  -- Shu fan bo'yicha boshqa yozilish bilan ustma-ust tushmasin (guruh almashtirish zanjiri)
  select subject_id into v_fan from groups where id = e.group_id;
  if exists (
    select 1 from enrollments o join groups g on g.id = o.group_id
    where o.student_id = e.student_id and o.id <> e.id
      and (o.group_id = e.group_id or (v_fan is not null and g.subject_id = v_fan))
      and o.boshlandi <= coalesce(e.tugadi, 'infinity'::date)
      and coalesce(o.tugadi, 'infinity'::date) >= p_sana
      and o.boshlandi < e.boshlandi
  ) then
    raise exception 'Bu sanada o''quvchi shu fanning boshqa guruhida o''qigan — avval o''sha yozilishni tekshiring.';
  end if;

  -- Olib tashlanadigan oylarga to'lov bo'lsa — to'xtatamiz
  if exists (
    select 1 from payments
    where enrollment_id = e.id and not bekor and davr < v_davr
  ) then
    raise exception 'Yangi sanadan oldingi oylarga to''lov bor — avval to''lovning oyini o''zgartiring yoki bekor qiling.';
  end if;

  update enrollments set boshlandi = p_sana where id = e.id;

  delete from invoices where enrollment_id = e.id and davr < v_davr;
  get diagnostics v_olindi = row_count;

  v_qoshildi := yozilish_hisoblari(e.id);
  perform yozilish_qayta_hisobla(e.id);

  update students s
     set qoshilgan_sana = (select min(boshlandi) from enrollments where student_id = s.id)
   where s.id = e.student_id;

  return jsonb_build_object('olindi', v_olindi, 'qoshildi', v_qoshildi);
end;
$function$;

-- sinov_guruh_almashtir(uuid,text,date)
CREATE OR REPLACE FUNCTION public.sinov_guruh_almashtir(p_lead uuid, p_group text, p_sana date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l        leads%rowtype;
  v_ochdi  int := 0;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Guruhni almashtirish huquqingiz yo''q.';
  end if;
  select * into l from leads where id = p_lead for update;
  if not found then
    raise exception 'Lid topilmadi.';
  end if;
  if l.student_id is not null then
    raise exception 'Bu bola rasmiy o''quvchi — guruhini o''quvchi profilidan almashtiring.';
  end if;
  if not lid_sinovdami(l) then
    raise exception 'Bola sinov darsida emas.';
  end if;
  if p_group is null or not exists (select 1 from groups where id = p_group and holat = 'faol') then
    raise exception 'Guruh topilmadi yoki yopilgan.';
  end if;
  if p_sana is null then
    raise exception 'Sanani tanlang.';
  end if;
  if p_sana > bugun_toshkent() then
    raise exception 'Kelasi sanani qo''yib bo''lmaydi — sinov kunini o''zgartiring.';
  end if;
  if p_sana < (l.created_at at time zone 'Asia/Tashkent')::date then
    raise exception 'Sana lid kiritilgan kundan (%) oldin bo''lmasin.', to_char(l.created_at at time zone 'Asia/Tashkent', 'DD/MM/YYYY');
  end if;

  -- Eski guruh jurnalidagi belgilar o'chadi
  if l.group_id is not null and l.group_id <> p_group then
    delete from probniy_davomat pd
     using lessons ls
     where ls.id = pd.lesson_id and pd.lead_id = p_lead and ls.group_id = l.group_id;
    get diagnostics v_ochdi = row_count;
    -- Yangi guruhda sanadan oldingi belgilar (avval shu guruhda bo'lgan bo'lsa) — o'chadi
    delete from probniy_davomat pd
     using lessons ls
     where ls.id = pd.lesson_id and pd.lead_id = p_lead and ls.group_id = p_group and ls.sana < p_sana;
  end if;

  update leads
     set group_id = p_group,
         guruh_dan = p_sana,
         sinov_sana = case when sinov_sana is null or sinov_sana > p_sana or l.group_id is distinct from p_group
                           then p_sana else sinov_sana end
   where id = p_lead;

  return jsonb_build_object('ochirildi', v_ochdi);
end;
$function$;

-- tuzatish_qosh(uuid,text,numeric,text)
CREATE OR REPLACE FUNCTION public.tuzatish_qosh(p_enrollment uuid, p_davr text, p_summa numeric, p_sabab text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
  e    enrollments%rowtype;
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Tuzatishni faqat admin yoki direktor kiritadi.';
  end if;
  if p_davr is null or p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy noto''g''ri (masalan 2026-10).';
  end if;
  if p_summa is null or p_summa <= 0 then
    raise exception 'Ayiriladigan summa 0 dan katta bo''lsin.';
  end if;
  if coalesce(trim(p_sabab), '') = '' then
    raise exception 'Sababini yozing (masalan: kasal, 3 dars).';
  end if;
  select * into e from enrollments where id = p_enrollment;
  if not found then
    raise exception 'Yozilish topilmadi.';
  end if;
  if p_davr < to_char(e.boshlandi, 'YYYY-MM') or (e.tugadi is not null and p_davr > to_char(e.tugadi, 'YYYY-MM')) then
    raise exception 'Bu oyda bola shu guruhda o''qimagan (% — %).',
      to_char(e.boshlandi, 'DD/MM/YYYY'), coalesce(to_char(e.tugadi, 'DD/MM/YYYY'), 'hozir');
  end if;

  insert into tuzatishlar (enrollment_id, davr, summa, sabab, kiritdi)
  values (p_enrollment, p_davr, p_summa, trim(p_sabab), auth.uid())
  returning id into v_id;

  perform tuzatish_hisobla(p_enrollment, p_davr);
  return v_id;
end;
$function$;
