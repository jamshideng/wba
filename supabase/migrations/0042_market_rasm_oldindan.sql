-- ============================================================
--  0042 — Woblar Market: bir nechta rasm + oldindan buyurtma
--
--  1. rasmlar — tartib bilan (birinchisi — asosiy). rasm_url esa
--     rasmlar[1] ning nusxasi bo'lib qoladi: vitrina va chek undan o'qiydi.
--     Rasmlarni admin brauzerdan to'g'ridan-to'g'ri 'market' bucketiga
--     yuklaydi (0040 qoidasi: yozish faqat app_is_admin()).
--
--  2. OLDINDAN BUYURTMA (Jamshid, 01.10). Markazda an'anaviy "bozor"
--     bo'ladi (odatda oy oxirida, sanani admin belgilaydi). Tovar vitrinaga
--     OLDINDAN qo'yiladi — o'quvchi ko'radi va zakaz beradi (woblari darhol
--     band qilinadi). Tovar kelganda (bozor kuni yoki undan oldin) admin
--     "Keldi" deydi → buyurtma olib ketishga tayyor, o'quvchiga xabar boradi.
--
--     woblr_rewards.rejim:    sotuvda  — hozir bor, olgan zahoti beriladi
--                             oldindan — keyin keladi (kelish_sana yoki bozor kuni)
--     woblr_redemptions.holat: buyurtma   — oldindan zakaz, tovar hali kelmagan
--                             kutilmoqda — tayyor, olib ketilmagan
--                             berildi / bekor
-- ============================================================

-- 1. Rasmlar ------------------------------------------------------------

alter table woblr_rewards add column if not exists rasmlar text[] not null default '{}';

alter table woblr_rewards drop constraint if exists woblr_rewards_rasmlar_soni;
alter table woblr_rewards add constraint woblr_rewards_rasmlar_soni
  check (coalesce(array_length(rasmlar, 1), 0) <= 8);

update woblr_rewards set rasmlar = array[rasm_url]
 where rasm_url is not null and rasmlar = '{}';

comment on column woblr_rewards.rasmlar is 'Mahsulot rasmlari (8 tagacha), birinchisi asosiy = rasm_url.';

-- 2. Oldindan buyurtma ----------------------------------------------------

alter table woblr_rewards add column if not exists rejim text not null default 'sotuvda';
alter table woblr_rewards drop constraint if exists woblr_rewards_rejim_check;
alter table woblr_rewards add constraint woblr_rewards_rejim_check check (rejim in ('sotuvda', 'oldindan'));
alter table woblr_rewards add column if not exists kelish_sana date;

comment on column woblr_rewards.rejim is 'sotuvda — hozir bor; oldindan — oldindan buyurtma, keyin keladi.';
comment on column woblr_rewards.kelish_sana is 'Oldindan buyurtma tovari qachon keladi. Bo''sh — keyingi bozor kuni (settings market.bozor_sana).';

alter table woblr_redemptions drop constraint if exists woblr_redemptions_holat_check;
alter table woblr_redemptions add constraint woblr_redemptions_holat_check
  check (holat in ('buyurtma', 'kutilmoqda', 'berildi', 'bekor'));
alter table woblr_redemptions add column if not exists keldi_vaqt timestamptz;

insert into settings (kalit, qiymat, tavsif)
values ('market.bozor_sana', 'null'::jsonb, 'Woblar market: keyingi bozor kuni (YYYY-MM-DD). Oldindan buyurtmalar shu kuni beriladi.')
on conflict (kalit) do nothing;

-- Buyurtma: oldindan tovar — "buyurtma" holatida (kelganda tayyor bo'ladi)
create or replace function market_buyurtma(p_reward uuid, p_soni int default 1)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_oquvchi text := app_student_id();
  v_m       woblr_rewards;
  v_jami    int;
  v_balans  int;
  v_kod     text;
begin
  if v_oquvchi is null then
    raise exception 'Buyurtmani faqat o''quvchi o''z hisobidan beradi.';
  end if;
  if p_soni is null or p_soni < 1 or p_soni > 20 then
    raise exception 'Soni 1 dan 20 gacha bo''lsin.';
  end if;

  -- Bir o'quvchining buyurtmalari navbat bilan (ikki marta bosish ortiqcha sarflamaydi)
  perform pg_advisory_xact_lock(hashtext('market:' || v_oquvchi));

  select * into v_m from woblr_rewards where id = p_reward for update;
  if v_m.id is null or v_m.holat <> 'faol' then
    raise exception 'Bu mahsulot hozir sotuvda yo''q.';
  end if;
  if not v_m.cheksiz and v_m.qolgan_soni < p_soni then
    raise exception 'Yetarli emas: % ta qolgan.', v_m.qolgan_soni;
  end if;

  v_jami := v_m.narx_ball * p_soni;
  v_balans := woblar_balansi(v_oquvchi);
  if v_balans < v_jami then
    raise exception 'Woblar yetmaydi: kerak %, sizda %.', v_jami, v_balans;
  end if;

  v_kod := market_kod();
  insert into woblr_redemptions (student_id, reward_id, ball, soni, kod, holat, mahsulot_nomi)
  values (v_oquvchi, v_m.id, v_jami, p_soni, v_kod,
          case when v_m.rejim = 'oldindan' then 'buyurtma' else 'kutilmoqda' end, v_m.nom);

  if not v_m.cheksiz then
    update woblr_rewards set qolgan_soni = qolgan_soni - p_soni, updated_at = now() where id = v_m.id;
  end if;

  return v_kod;
end;
$$;

-- Berish: tayyor yoki oldindan buyurtma (tovar kelgan kuni to'g'ridan-to'g'ri beriladi)
create or replace function market_berildi(p_kod text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Buyurtmani faqat xodim beradi.';
  end if;
  update woblr_redemptions
     set holat = 'berildi', berdi = auth.uid(), berildi_vaqt = now(),
         keldi_vaqt = coalesce(keldi_vaqt, now())
   where kod = upper(trim(p_kod)) and holat in ('kutilmoqda', 'buyurtma');
  if not found then
    raise exception 'Kod topilmadi yoki buyurtma allaqachon yopilgan.';
  end if;
end;
$$;

create or replace function market_bekor(p_kod text, p_sabab text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_b woblr_redemptions;
begin
  select * into v_b from woblr_redemptions where kod = upper(trim(p_kod)) for update;
  if v_b.id is null or v_b.holat not in ('kutilmoqda', 'buyurtma') then
    raise exception 'Kod topilmadi yoki buyurtma allaqachon yopilgan.';
  end if;
  -- Xodim istalganini, o'quvchi faqat o'zinikini bekor qiladi
  if auth.uid() is not null and not app_is_staff() and v_b.student_id is distinct from app_student_id() then
    raise exception 'Bu buyurtmani bekor qila olmaysiz.';
  end if;

  update woblr_redemptions
     set holat = 'bekor', bekor_sabab = nullif(trim(p_sabab), ''), bekor_qildi = auth.uid()
   where id = v_b.id;

  update woblr_rewards
     set qolgan_soni = qolgan_soni + v_b.soni, updated_at = now()
   where id = v_b.reward_id and not cheksiz;
end;
$$;

-- Bitta oldindan buyurtma keldi → tayyor. Qaytadi: o'quvchi ID (xabar uchun)
create or replace function market_keldi(p_kod text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_oquvchi text;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Faqat xodim belgilaydi.';
  end if;
  update woblr_redemptions
     set holat = 'kutilmoqda', keldi_vaqt = now()
   where kod = upper(trim(p_kod)) and holat = 'buyurtma'
  returning student_id into v_oquvchi;
  if v_oquvchi is null then
    raise exception 'Kod topilmadi yoki buyurtma allaqachon tayyor.';
  end if;
  return v_oquvchi;
end;
$$;

-- Mahsulot keldi: uning barcha oldindan buyurtmalari tayyor bo'ladi.
-- p_sotuvga = true — mahsulot endi oddiy sotuvda (hamma bemalol oladi).
-- Qaytadi: tayyor bo'lgan buyurtmalar (o'quvchi, kod) — xabar uchun.
create or replace function market_mahsulot_keldi(p_reward uuid, p_sotuvga boolean default true)
returns table (student_id text, kod text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Faqat admin yoki direktor belgilaydi.';
  end if;
  if p_sotuvga then
    update woblr_rewards set rejim = 'sotuvda', kelish_sana = null, updated_at = now() where id = p_reward;
  end if;
  return query
    update woblr_redemptions r
       set holat = 'kutilmoqda', keldi_vaqt = now()
     where r.reward_id = p_reward and r.holat = 'buyurtma'
    returning r.student_id, r.kod;
end;
$$;

revoke execute on function market_keldi(text) from public, anon;
grant execute on function market_keldi(text) to authenticated;
revoke execute on function market_mahsulot_keldi(uuid, boolean) from public, anon;
grant execute on function market_mahsulot_keldi(uuid, boolean) to authenticated;
