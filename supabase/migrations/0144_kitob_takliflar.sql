-- ============================================================
--  World Bridge Academy
--  0144_kitob_takliflar.sql · USTOZ KITOB TAKLIFI (Jamshid, 23.11)
--
--  Woblar market takliflari (0065) naqshi: ustoz katalogda yo'q kitobni
--  so'raydi — nom, fan, kerakli soni, sabab, muqova rasmi (majburiy,
--  fayl), havola (ixtiyoriy).
--    yangi → buyurtma_qilindi → keldi        (rahbariyat)
--          ↘ rad_etildi (sabab majburiy)     (rahbariyat)
--    yangi → bekor_qilindi                   (ustozning o'zi)
--  "Keldi" — bitta amal bilan katalogga (nom, fan, rasm) va xohlasa
--  darhol kirim. Bir xil kitob (nom + fan) bo'yicha takliflar guruhlanadi,
--  holat guruhga bittada o'zgartiriladi.
--  Har holat o'zgarishida ustozga sayt bildirishnomasi + Telegram
--  (funksiya Telegram manzillarini qaytaradi, yuborishni ilova qiladi).
--  Hech narsa o'chirilmaydi; audit_log — audit_trigger.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Katalogga muqova
-- ------------------------------------------------------------

alter table kitoblar add column if not exists rasm_url text
  check (rasm_url is null or (length(rasm_url) <= 500 and rasm_url ~ '/storage/v1/object/public/kitoblar/'));


-- ------------------------------------------------------------
-- 2. Takliflar
-- ------------------------------------------------------------

create table if not exists kitob_takliflar (
  id               uuid primary key default gen_random_uuid(),
  teacher_id       text not null references teachers (id) on delete restrict,
  nom              text not null check (length(trim(nom)) between 2 and 200),
  subject_id       text not null references subjects (id) on delete restrict,
  soni             int  not null check (soni between 1 and 500),
  sabab            text not null check (length(trim(sabab)) between 3 and 1000),
  rasm_url         text not null check (length(rasm_url) <= 500 and rasm_url ~ '/storage/v1/object/public/kitoblar/takliflar/'),
  havola           text check (havola is null or (havola ~* '^https?://' and length(havola) <= 500)),
  holat            text not null default 'yangi'
                   check (holat in ('yangi', 'buyurtma_qilindi', 'keldi', 'rad_etildi', 'bekor_qilindi')),
  javob            text check (javob is null or length(javob) <= 500),
  kitob_id         uuid references kitoblar (id) on delete restrict,
  /* Bir xil kitob: nom (katta-kichik harf, bo'shliqlarsiz) + fan */
  kalit            text generated always as (lower(regexp_replace(trim(nom), '\s+', ' ', 'g')) || '|' || subject_id) stored,
  created_by       uuid references profiles (id) on delete set null default auth.uid(),
  ozgartirdi       uuid references profiles (id) on delete set null,
  ozgartirish_vaqt timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists kitob_takliflar_ustoz_idx on kitob_takliflar (teacher_id, created_at desc);
create index if not exists kitob_takliflar_holat_idx on kitob_takliflar (holat, created_at desc);
create index if not exists kitob_takliflar_kalit_idx on kitob_takliflar (kalit);
comment on table kitob_takliflar is 'Ustoz kitob takliflari (0144). O''chirilmaydi — holat + kim + qachon + sabab.';

alter table kitob_takliflar enable row level security;
alter table kitob_takliflar force row level security;

/* O'qish: rahbariyat — hammasi; ustoz — faqat o'ziniki. Yozish — faqat funksiyalar. */
drop policy if exists kitob_takliflar_read on kitob_takliflar;
create policy kitob_takliflar_read on kitob_takliflar for select to authenticated
  using (app_is_admin() or (app_teacher_id() is not null and teacher_id = app_teacher_id()));
revoke all on kitob_takliflar from anon;

drop trigger if exists kitob_takliflar_audit on kitob_takliflar;
create trigger kitob_takliflar_audit after insert or update or delete on kitob_takliflar
  for each row execute function audit_trigger();
drop trigger if exists kitob_takliflar_ochirilmaydi on kitob_takliflar;
create trigger kitob_takliflar_ochirilmaydi before delete on kitob_takliflar
  for each row execute function kitob_ochirilmaydi();


-- ------------------------------------------------------------
-- 3. Rasmlar — Storage "kitoblar" (ommaviy o'qish)
--    ustoz: faqat takliflar/<o'z uid>/ ga; rahbariyat: istalgan joyga
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage yo''q — kitoblar bucketi o''tkazib yuborildi';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('kitoblar', 'kitoblar', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute $p$ drop policy if exists kitoblar_rasm_oqish on storage.objects $p$;
  execute $p$ create policy kitoblar_rasm_oqish on storage.objects for select
              using (bucket_id = 'kitoblar') $p$;
  execute $p$ drop policy if exists kitoblar_rasm_yozish on storage.objects $p$;
  execute $p$ create policy kitoblar_rasm_yozish on storage.objects for insert to authenticated
              with check (bucket_id = 'kitoblar' and (
                public.app_is_admin()
                or (public.app_teacher_id() is not null and name like 'takliflar/' || auth.uid()::text || '/%')
              )) $p$;
end $$;


-- ------------------------------------------------------------
-- 4. Xabar: sayt bildirishnomasi + Telegram manzillari
-- ------------------------------------------------------------

create or replace function kitob_taklif_xabar(p_taklif kitob_takliflar) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sar  text;
  v_matn text;
  v_hav  constant text := '/crm/kitoblar?tab=takliflarim';
begin
  v_sar := left(format('Kitob taklifingiz: %s', case p_taklif.holat
             when 'buyurtma_qilindi' then 'buyurtma qilindi'
             when 'keldi'            then 'kitob keldi'
             when 'rad_etildi'       then 'rad etildi'
             else p_taklif.holat end), 120);
  v_matn := left(p_taklif.nom || coalesce(E'\nIzoh: ' || p_taklif.javob, ''), 2000);

  insert into bildirishnomalar (turi, sarlavha, matn, havola, havola_matn, kimga, filtr, tugash, yaratdi, manba)
  values ('eslatma', v_sar, v_matn, v_hav, 'Ko''rish', array['ustoz'],
          jsonb_build_object('ustoz', p_taklif.teacher_id), now() + interval '14 days', auth.uid(), 'kitob_taklif');

  return coalesce((
    select jsonb_agg(x || jsonb_build_object('havola', v_hav))
    from jsonb_array_elements(ustoz_tg_chatlar(p_taklif.teacher_id, v_sar, v_matn)) x
  ), '[]'::jsonb);
end;
$$;
revoke execute on function kitob_taklif_xabar(kitob_takliflar) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 5. Ustoz: yuborish, tahrir, bekor
-- ------------------------------------------------------------

create or replace function kitob_taklif_tekshir(p_nom text, p_fan text, p_soni int, p_sabab text, p_rasm text, p_havola text) returns void
language plpgsql stable set search_path = public as $$
begin
  if length(trim(coalesce(p_nom, ''))) < 2 then raise exception 'Kitob nomini yozing.'; end if;
  if p_fan is null or not exists (select 1 from subjects where id = p_fan) then raise exception 'Fanni tanlang.'; end if;
  if p_soni is null or p_soni < 1 or p_soni > 500 then raise exception 'Kerakli soni 1 dan 500 gacha bo''lsin.'; end if;
  if length(trim(coalesce(p_sabab, ''))) < 3 then raise exception 'Nima uchun kerakligini yozing.'; end if;
  -- p_rasm null — tahrirda rasm almashtirilmadi (eskisi qoladi); yuborishda alohida majburiy
  if p_rasm is not null and p_rasm !~ ('/storage/v1/object/public/kitoblar/takliflar/' || auth.uid()::text || '/') then
    raise exception 'Muqova rasmini yuklang.';
  end if;
  if p_havola is not null and p_havola !~* '^https?://' then raise exception 'Havola http:// yoki https:// bilan boshlansin.'; end if;
end;
$$;

create or replace function kitob_taklif_yubor(p_nom text, p_fan text, p_soni int, p_sabab text, p_rasm text, p_havola text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ustoz text := app_teacher_id();
  v_id    uuid;
begin
  if v_ustoz is null then raise exception 'Kitob taklifini ustoz yuboradi.'; end if;
  if p_rasm is null then raise exception 'Muqova rasmini yuklang (majburiy).'; end if;
  perform kitob_taklif_tekshir(p_nom, p_fan, p_soni, p_sabab, p_rasm, nullif(trim(p_havola), ''));
  if (select count(*) from kitob_takliflar where teacher_id = v_ustoz and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Bir kunda 10 tadan ko''p taklif yuborib bo''lmaydi.';
  end if;
  insert into kitob_takliflar (teacher_id, nom, subject_id, soni, sabab, rasm_url, havola)
  values (v_ustoz, trim(p_nom), p_fan, p_soni, trim(p_sabab), p_rasm, nullif(trim(p_havola), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function kitob_taklif_tahrir(p_id uuid, p_nom text, p_fan text, p_soni int, p_sabab text, p_rasm text, p_havola text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t kitob_takliflar;
begin
  select * into v_t from kitob_takliflar where id = p_id for update;
  if v_t.id is null or app_teacher_id() is null or v_t.teacher_id <> app_teacher_id() then
    raise exception 'Taklif topilmadi.';
  end if;
  if v_t.holat <> 'yangi' then raise exception 'Faqat "Yangi" taklifni tahrirlash mumkin.'; end if;
  -- Rasm almashtirilmasa (null yoki o'sha) — eskisi qoladi
  perform kitob_taklif_tekshir(p_nom, p_fan, p_soni, p_sabab,
    case when p_rasm is distinct from v_t.rasm_url then p_rasm end, nullif(trim(p_havola), ''));
  update kitob_takliflar
     set nom = trim(p_nom), subject_id = p_fan, soni = p_soni, sabab = trim(p_sabab), rasm_url = coalesce(p_rasm, rasm_url),
         havola = nullif(trim(p_havola), ''), updated_at = now(), ozgartirdi = auth.uid(), ozgartirish_vaqt = now()
   where id = p_id;
end;
$$;

create or replace function kitob_taklif_bekor(p_id uuid, p_sabab text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t kitob_takliflar;
begin
  select * into v_t from kitob_takliflar where id = p_id for update;
  if v_t.id is null or app_teacher_id() is null or v_t.teacher_id <> app_teacher_id() then
    raise exception 'Taklif topilmadi.';
  end if;
  if v_t.holat <> 'yangi' then raise exception 'Faqat "Yangi" taklifni bekor qilish mumkin.'; end if;
  update kitob_takliflar
     set holat = 'bekor_qilindi', javob = nullif(trim(p_sabab), ''), updated_at = now(), ozgartirdi = auth.uid(), ozgartirish_vaqt = now()
   where id = p_id;
end;
$$;


-- ------------------------------------------------------------
-- 6. Rahbariyat: holat (guruhga bittada ham) va "Keldi" → katalog
-- ------------------------------------------------------------

/* p_idlar — bitta yoki bir nechta (bir xil kitob guruhi). Qaytaradi: {"soni", "tg": [...]} */
create or replace function kitob_taklif_holat(p_idlar uuid[], p_holat text, p_javob text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_t   kitob_takliflar;
  v_tg  jsonb := '[]'::jsonb;
  v_n   int := 0;
begin
  if not app_is_admin() then raise exception 'Taklif holatini direktor, admin yoki manager o''zgartiradi.'; end if;
  if p_holat not in ('buyurtma_qilindi', 'rad_etildi') then raise exception 'Noto''g''ri holat.'; end if;
  if p_holat = 'rad_etildi' and nullif(trim(p_javob), '') is null then raise exception 'Rad etish sababini yozing.'; end if;
  if coalesce(array_length(p_idlar, 1), 0) = 0 then raise exception 'Taklif tanlanmadi.'; end if;

  for v_t in
    select * from kitob_takliflar where id = any (p_idlar) order by created_at for update
  loop
    -- Ruxsat etilgan o'tishlar
    if not ((v_t.holat = 'yangi' and p_holat in ('buyurtma_qilindi', 'rad_etildi'))
         or (v_t.holat = 'buyurtma_qilindi' and p_holat = 'rad_etildi')) then
      continue;
    end if;
    update kitob_takliflar
       set holat = p_holat, javob = coalesce(nullif(trim(p_javob), ''), javob), updated_at = now(),
           ozgartirdi = auth.uid(), ozgartirish_vaqt = now()
     where id = v_t.id
     returning * into v_t;
    v_tg := v_tg || kitob_taklif_xabar(v_t);
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'Bu takliflarning holatini bunday o''zgartirib bo''lmaydi.'; end if;
  return jsonb_build_object('soni', v_n, 'tg', v_tg);
end;
$$;

/* "Keldi": katalogga yangi kitob (yoki mavjudiga bog'lash) + xohlasa kirim */
create or replace function kitob_taklif_keldi(
  p_idlar uuid[], p_kitob uuid, p_nom text, p_fan text, p_rasm text, p_kirim_soni int, p_kirim_sana date, p_javob text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_t     kitob_takliflar;
  v_kitob uuid := p_kitob;
  v_tg    jsonb := '[]'::jsonb;
  v_n     int := 0;
begin
  if not app_is_admin() then raise exception '"Keldi"ni direktor, admin yoki manager bosadi.'; end if;
  if coalesce(array_length(p_idlar, 1), 0) = 0 then raise exception 'Taklif tanlanmadi.'; end if;
  if exists (select 1 from kitob_takliflar where id = any (p_idlar) and holat not in ('yangi', 'buyurtma_qilindi')) then
    raise exception 'Yopilgan taklifni "Keldi" qilib bo''lmaydi.';
  end if;
  if p_kirim_soni is not null and (p_kirim_soni < 1 or p_kirim_soni > 10000) then
    raise exception 'Kirim soni 1 dan 10000 gacha bo''lsin.';
  end if;

  if v_kitob is null then
    if length(trim(coalesce(p_nom, ''))) < 2 then raise exception 'Kitob nomini yozing.'; end if;
    insert into kitoblar (nom, subject_id, rasm_url, izoh)
    values (trim(p_nom), p_fan, p_rasm, 'Ustoz taklifidan')
    returning id into v_kitob;
  elsif not exists (select 1 from kitoblar where id = v_kitob) then
    raise exception 'Katalogdagi kitob topilmadi.';
  else
    -- Mavjud kitobda muqova bo'lmasa — taklifdagini qo'yamiz
    update kitoblar set rasm_url = coalesce(rasm_url, p_rasm), holat = 'faol', updated_at = now() where id = v_kitob;
  end if;

  if p_kirim_soni is not null then
    insert into kitob_kirim (kitob_id, soni, sana, izoh)
    values (v_kitob, p_kirim_soni, coalesce(p_kirim_sana, current_date), 'Ustoz taklifi bo''yicha keldi');
  end if;

  for v_t in
    select * from kitob_takliflar where id = any (p_idlar) order by created_at for update
  loop
    update kitob_takliflar
       set holat = 'keldi', kitob_id = v_kitob, javob = coalesce(nullif(trim(p_javob), ''), javob),
           updated_at = now(), ozgartirdi = auth.uid(), ozgartirish_vaqt = now()
     where id = v_t.id
     returning * into v_t;
    v_tg := v_tg || kitob_taklif_xabar(v_t);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('soni', v_n, 'kitob_id', v_kitob, 'tg', v_tg);
end;
$$;


-- ------------------------------------------------------------
-- 7. Huquqlar
-- ------------------------------------------------------------

revoke execute on function kitob_taklif_tekshir(text, text, int, text, text, text) from public, anon, authenticated;
revoke execute on function kitob_taklif_yubor(text, text, int, text, text, text) from public, anon;
grant  execute on function kitob_taklif_yubor(text, text, int, text, text, text) to authenticated, service_role;
revoke execute on function kitob_taklif_tahrir(uuid, text, text, int, text, text, text) from public, anon;
grant  execute on function kitob_taklif_tahrir(uuid, text, text, int, text, text, text) to authenticated, service_role;
revoke execute on function kitob_taklif_bekor(uuid, text) from public, anon;
grant  execute on function kitob_taklif_bekor(uuid, text) to authenticated, service_role;
revoke execute on function kitob_taklif_holat(uuid[], text, text) from public, anon;
grant  execute on function kitob_taklif_holat(uuid[], text, text) to authenticated, service_role;
revoke execute on function kitob_taklif_keldi(uuid[], uuid, text, text, text, int, date, text) from public, anon;
grant  execute on function kitob_taklif_keldi(uuid[], uuid, text, text, text, int, date, text) to authenticated, service_role;
