-- ============================================================
--  0074 — Guruhni almashtirish (sana bilan) — Jamshid, 16.10
-- ============================================================
--  Bola shu fanning ichida boshqa guruhga o'tadi. Admin sanani tanlaydi:
--    * o'sha sanagacha bo'lgan tarix ESKI guruhda qoladi (yozilish
--      sana − 1 kunda yopiladi);
--    * o'sha sanadan YANGI yozilish ochiladi;
--    * o'tilgan oy YANGI guruhniki (07.10 qarori, migrate-from-sheets bilan
--      bir xil): eski yozilishning shu oy va keyingi hisoblari o'chadi,
--      to'lov va tuzatishlar yangi yozilishga o'tadi;
--    * chegirma muddati asl boshlanishdan sanaladi (Sheets'da qator bitta);
--    * sanadan keyin eski guruhda qo'yilgan davomat va woblar yangi guruhga
--      o'tadi (yangi guruhda o'sha kuni dars bo'lmasa — joyida qoladi).
--  Sheets bilan: yangi yozilish Sheets qator ID'sini oladi, eskisi
--  "ID~boshlanish" — migrate-from-sheets dagi bo'linish bilan bir xil.
--  Sinxron (scripts/sinxron.ts) ham shu funksiyani chaqiradi.
-- ============================================================

create or replace function guruh_almashtir(p_enrollment uuid, p_group text, p_sana date)
returns jsonb
language plpgsql security definer set search_path = public as $$
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
    raise exception 'O''tish sanasi guruhga qo''shilgan kundan (%) keyin bo''lsin.', to_char(e.boshlandi, 'DD.MM.YYYY');
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
    if v_dars is null and guruh_dars_kunimi(v_kunlar, r.sana) then
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
$$;

revoke execute on function guruh_almashtir(uuid, text, date) from public, anon;
grant execute on function guruh_almashtir(uuid, text, date) to authenticated, service_role;

comment on function guruh_almashtir(uuid, text, date) is
  'Shu fan ichida guruhni sana bilan almashtiradi: eski davr eski guruhda, o''tish oyidan boshlab yangi guruhda (0074).';
