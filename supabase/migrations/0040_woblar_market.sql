-- ============================================================
--  World Bridge Academy
--  0040_woblar_market.sql · WOBLAR MARKET (Jamshid, 01.10)
--
--  O'quvchi yig'gan woblariga admin qo'ygan narsalarni "sotib oladi"
--  (Uzum / Yandex Market kabi). Oqim:
--    1. admin mahsulot qo'shadi: rasm, nom, tavsif, toifa, narx (woblar), soni
--    2. o'quvchi buyurtma beradi → woblari darhol kamayadi, unga chek
--       kodi beriladi (masalan WM-7K4P2X)
--    3. o'quvchi kodni adminga ko'rsatadi → admin narsani beradi va
--       "Berildi" bosadi; yoki bekor qiladi → woblar va soni qaytadi
--
--  Mavjud jadvallar kengaytiriladi (0001 da tayyor turgan edi):
--    woblr_rewards     — mahsulotlar
--    woblr_redemptions — buyurtmalar (kod, holat, soni, nom/narx nusxasi)
--  Balans = berilgan woblar − bekor qilinmagan buyurtmalar (v_woblr_balance).
--
--  Xavfsizlik: o'quvchi buyurtmani faqat market_buyurtma() orqali beradi —
--  balans va soni bazada, qulf ostida tekshiriladi (bir vaqtda ikki bosish
--  ham ortiqcha sarflay olmaydi). Berish/bekor — xodim (o'quvchi o'z
--  kutilayotgan buyurtmasini bekor qila oladi).
-- ============================================================


-- ------------------------------------------------------------
-- 1. Mahsulotlar
-- ------------------------------------------------------------

alter table woblr_rewards add column if not exists toifa      text;
alter table woblr_rewards add column if not exists rasm_url   text;
alter table woblr_rewards add column if not exists cheksiz    boolean not null default false;
alter table woblr_rewards add column if not exists tartib     int not null default 0;
alter table woblr_rewards add column if not exists updated_at timestamptz not null default now();

comment on table woblr_rewards is 'Woblar Market mahsulotlari. Narx — woblarda. cheksiz=true bo''lsa soni hisoblanmaydi.';
comment on column woblr_rewards.qolgan_soni is 'Omborda qolgan dona (cheksiz=false bo''lsa). Buyurtmada kamayadi, bekorda qaytadi.';


-- ------------------------------------------------------------
-- 2. Buyurtmalar
-- ------------------------------------------------------------

alter table woblr_redemptions add column if not exists kod          text;
alter table woblr_redemptions add column if not exists soni         int not null default 1 check (soni between 1 and 20);
alter table woblr_redemptions add column if not exists holat        text not null default 'kutilmoqda'
  check (holat in ('kutilmoqda', 'berildi', 'bekor'));
alter table woblr_redemptions add column if not exists mahsulot_nomi text;
alter table woblr_redemptions add column if not exists berildi_vaqt timestamptz;
alter table woblr_redemptions add column if not exists bekor_sabab  text;
alter table woblr_redemptions add column if not exists bekor_qildi  uuid references profiles (id) on delete set null;

create unique index if not exists woblr_redemptions_kod_uniq on woblr_redemptions (kod) where kod is not null;
create index if not exists woblr_redemptions_holat_idx on woblr_redemptions (holat, created_at desc);

comment on column woblr_redemptions.kod is 'Chek kodi (WM-XXXXXX) — o''quvchi adminga ko''rsatadi.';
comment on column woblr_redemptions.ball is 'Jami sarflangan woblar (narx × soni) — buyurtma paytidagi narx bilan.';

drop trigger if exists woblr_redemptions_audit on woblr_redemptions;
create trigger woblr_redemptions_audit after insert or update or delete on woblr_redemptions
  for each row execute function audit_trigger();
drop trigger if exists woblr_rewards_audit on woblr_rewards;
create trigger woblr_rewards_audit after insert or update or delete on woblr_rewards
  for each row execute function audit_trigger();


-- ------------------------------------------------------------
-- 3. Balans — bekor qilingan buyurtma hisobga kirmaydi
-- ------------------------------------------------------------

create or replace view v_woblr_balance
with (security_invoker = on) as
select
  s.id                                                   as student_id,
  s.fish,
  coalesce(w.jami, 0)                                    as jami_ball,
  coalesce(r.sarflangan, 0)                              as sarflangan,
  coalesce(w.jami, 0) - coalesce(r.sarflangan, 0)        as balans,
  w.oxirgi
from students s
left join lateral (
  select sum(ball) as jami, max(created_at) as oxirgi
  from woblr where student_id = s.id
) w on true
left join lateral (
  select sum(ball) as sarflangan
  from woblr_redemptions where student_id = s.id and holat <> 'bekor'
) r on true;

/* Balans — RLS'siz, faqat funksiyalar ichida (qulf ostida) */
create or replace function woblar_balansi(p_student text) returns int
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(ball) from woblr where student_id = p_student), 0)
        - coalesce((select sum(ball) from woblr_redemptions where student_id = p_student and holat <> 'bekor'), 0))::int
$$;
revoke execute on function woblar_balansi(text) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 4. Buyurtma berish / berildi / bekor
-- ------------------------------------------------------------

/* WM-XXXXXX: chalkashtiradigan belgilarsiz (0/O, 1/I yo'q) */
create or replace function market_kod() returns text
language plpgsql volatile set search_path = public as $$
declare
  v_harflar constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_kod text;
begin
  loop
    v_kod := 'WM-';
    for i in 1..6 loop
      v_kod := v_kod || substr(v_harflar, 1 + floor(random() * length(v_harflar))::int, 1);
    end loop;
    exit when not exists (select 1 from woblr_redemptions where kod = v_kod);
  end loop;
  return v_kod;
end;
$$;

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
    raise exception 'Omborda yetarli emas: % ta qolgan.', v_m.qolgan_soni;
  end if;

  v_jami := v_m.narx_ball * p_soni;
  v_balans := woblar_balansi(v_oquvchi);
  if v_balans < v_jami then
    raise exception 'Woblar yetmaydi: kerak %, sizda %.', v_jami, v_balans;
  end if;

  v_kod := market_kod();
  insert into woblr_redemptions (student_id, reward_id, ball, soni, kod, holat, mahsulot_nomi)
  values (v_oquvchi, v_m.id, v_jami, p_soni, v_kod, 'kutilmoqda', v_m.nom);

  if not v_m.cheksiz then
    update woblr_rewards set qolgan_soni = qolgan_soni - p_soni, updated_at = now() where id = v_m.id;
  end if;

  return v_kod;
end;
$$;

create or replace function market_berildi(p_kod text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Buyurtmani faqat xodim beradi.';
  end if;
  update woblr_redemptions
     set holat = 'berildi', berdi = auth.uid(), berildi_vaqt = now()
   where kod = upper(trim(p_kod)) and holat = 'kutilmoqda';
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
  if v_b.id is null or v_b.holat <> 'kutilmoqda' then
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

revoke execute on function market_kod() from public, anon, authenticated;
revoke execute on function market_buyurtma(uuid, int) from public, anon;
grant  execute on function market_buyurtma(uuid, int) to authenticated, service_role;
revoke execute on function market_berildi(text) from public, anon;
grant  execute on function market_berildi(text) to authenticated, service_role;
revoke execute on function market_bekor(text, text) from public, anon;
grant  execute on function market_bekor(text, text) to authenticated, service_role;

/* Buyurtmani faqat funksiyalar yozadi: to'g'ridan yozish xodimga ham yopiq
   (balans va ombor tekshiruvini chetlab o'tmaslik uchun). O'qish — o'zgarmagan. */
drop policy if exists redemptions_staff on woblr_redemptions;
drop policy if exists redemptions_staff_read on woblr_redemptions;
create policy redemptions_staff_read on woblr_redemptions for select to authenticated
  using (app_is_staff());


-- ------------------------------------------------------------
-- 5. Rasmlar — Storage "market" (ommaviy o'qish, yozish faqat admin)
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage yo''q — market bucketi o''tkazib yuborildi';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('market', 'market', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute $p$ drop policy if exists market_rasm_oqish on storage.objects $p$;
  execute $p$ create policy market_rasm_oqish on storage.objects for select
              using (bucket_id = 'market') $p$;
  execute $p$ drop policy if exists market_rasm_yozish on storage.objects $p$;
  execute $p$ create policy market_rasm_yozish on storage.objects for insert to authenticated
              with check (bucket_id = 'market' and public.app_is_admin()) $p$;
  execute $p$ drop policy if exists market_rasm_ozgartirish on storage.objects $p$;
  execute $p$ create policy market_rasm_ozgartirish on storage.objects for update to authenticated
              using (bucket_id = 'market' and public.app_is_admin()) $p$;
  execute $p$ drop policy if exists market_rasm_ochirish on storage.objects $p$;
  execute $p$ create policy market_rasm_ochirish on storage.objects for delete to authenticated
              using (bucket_id = 'market' and public.app_is_admin()) $p$;
end $$;
